// QY4-TBYT: bộ đọc XLSX chịu lỗi cho màn Nhập Excel.
// Một số workbook hợp lệ (đặc biệt file sinh bởi thư viện khác ExcelJS) làm ExcelJS 4.4
// lỗi nội bộ "Cannot read properties of undefined (reading 'sheets')". Vì màn import chỉ
// cần dữ liệu ô, ta đọc trực tiếp cấu trúc ZIP/XML của .xlsx bằng API chuẩn của trình duyệt.

(function () {
  const td = new TextDecoder('utf-8');

  function u16(view, offset) {
    return view.getUint16(offset, true);
  }

  function u32(view, offset) {
    return view.getUint32(offset, true);
  }

  function normalizeZipPath(value) {
    const out = [];
    String(value || '').replace(/\\/g, '/').split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') out.pop();
      else out.push(part);
    });
    return out.join('/');
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Trình duyệt không hỗ trợ giải nén XLSX. Hãy dùng Chrome/Edge phiên bản mới.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzipXlsx(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    if (bytes.length < 22) throw new Error('File XLSX quá nhỏ hoặc không hợp lệ.');

    // EOCD nằm trong 65.557 byte cuối của ZIP.
    const min = Math.max(0, bytes.length - 65557);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= min; i--) {
      if (u32(view, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('Không tìm thấy cấu trúc ZIP của file XLSX.');

    const totalEntries = u16(view, eocd + 10);
    let ptr = u32(view, eocd + 16);
    const entries = new Map();

    for (let i = 0; i < totalEntries; i++) {
      if (ptr + 46 > bytes.length || u32(view, ptr) !== 0x02014b50) {
        throw new Error('Cấu trúc thư mục ZIP của XLSX không hợp lệ.');
      }
      const method = u16(view, ptr + 10);
      const compressedSize = u32(view, ptr + 20);
      const nameLen = u16(view, ptr + 28);
      const extraLen = u16(view, ptr + 30);
      const commentLen = u16(view, ptr + 32);
      const localOffset = u32(view, ptr + 42);
      const nameStart = ptr + 46;
      const name = normalizeZipPath(td.decode(bytes.subarray(nameStart, nameStart + nameLen)));

      if (localOffset + 30 > bytes.length || u32(view, localOffset) !== 0x04034b50) {
        throw new Error(`Entry XLSX không hợp lệ: ${name || '(không tên)'}.`);
      }
      const localNameLen = u16(view, localOffset + 26);
      const localExtraLen = u16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error(`Entry XLSX bị thiếu dữ liệu: ${name}.`);

      const compressed = bytes.subarray(dataStart, dataEnd);
      let data;
      if (method === 0) data = compressed.slice();
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`XLSX dùng kiểu nén chưa hỗ trợ (${method}).`);

      entries.set(name, data);
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function xmlText(entries, name, required = true) {
    const data = entries.get(normalizeZipPath(name));
    if (!data) {
      if (required) throw new Error(`Thiếu thành phần XLSX: ${name}.`);
      return '';
    }
    return td.decode(data).replace(/^\uFEFF/, '');
  }

  function decodeXml(value) {
    return String(value || '').replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, token => {
      const key = token.slice(1, -1).toLowerCase();
      if (key === 'lt') return '<';
      if (key === 'gt') return '>';
      if (key === 'amp') return '&';
      if (key === 'quot') return '"';
      if (key === 'apos') return "'";
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return token;
    });
  }

  function escRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function xmlAttr(tag, name) {
    const re = new RegExp(`(?:^|\\s)${escRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
    const m = String(tag || '').match(re);
    return m ? decodeXml(m[2]) : '';
  }

  function tagTexts(xml, tagName) {
    const out = [];
    const re = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${tagName}>`, 'gi');
    let m;
    while ((m = re.exec(String(xml || '')))) out.push(decodeXml(m[1].replace(/<[^>]+>/g, '')));
    return out;
  }

  function parseSharedStrings(xml) {
    if (!xml) return [];
    const values = [];
    const re = /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi;
    let m;
    while ((m = re.exec(xml))) values.push(tagTexts(m[1], 't').join(''));
    return values;
  }

  function colIndex(cellRef) {
    const m = String(cellRef || '').toUpperCase().match(/^([A-Z]+)/);
    if (!m) return 0;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64;
    return n;
  }

  function parseCellValue(cellTag, body, sharedStrings) {
    const type = xmlAttr(cellTag, 't').toLowerCase();
    if (type === 'inlinestr') return tagTexts(body, 't').join('');

    const vm = String(body || '').match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i);
    const raw = vm ? decodeXml(vm[1].replace(/<[^>]+>/g, '')) : '';
    if (type === 's') {
      const index = Number(raw);
      return Number.isInteger(index) && index >= 0 ? (sharedStrings[index] ?? '') : '';
    }
    if (type === 'str' || type === 'e') return raw;
    if (type === 'b') return raw === '1';
    if (raw === '') return '';
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }

  function parseWorksheet(xml, sharedStrings) {
    const parsedRows = [];
    const rowRe = /<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/gi;
    let rm;
    let sequence = 0;
    while ((rm = rowRe.exec(xml))) {
      sequence += 1;
      const rowTag = rm[0].slice(0, rm[0].indexOf('>') + 1);
      const rowNumber = Number(xmlAttr(rowTag, 'r')) || sequence;
      const cells = new Map();
      const cellRe = /<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/gi;
      let cm;
      let fallbackCol = 0;
      while ((cm = cellRe.exec(rm[2]))) {
        const cellTag = cm[0].slice(0, cm[0].indexOf('>') + 1);
        const ref = xmlAttr(cellTag, 'r');
        const col = colIndex(ref) || (++fallbackCol);
        fallbackCol = Math.max(fallbackCol, col);
        cells.set(col, parseCellValue(cellTag, cm[2], sharedStrings));
      }
      parsedRows.push({ rowNumber, cells });
      if (parsedRows.length > 5001) throw new Error('File có quá 5.000 dòng dữ liệu; vui lòng chia nhỏ trước khi nhập.');
    }
    return parsedRows;
  }

  function parseWorkbookSheet(entries) {
    const workbookXml = xmlText(entries, 'xl/workbook.xml');
    const relsXml = xmlText(entries, 'xl/_rels/workbook.xml.rels');
    const sheets = [];
    const sheetRe = /<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*\/?>/gi;
    let sm;
    while ((sm = sheetRe.exec(workbookXml))) {
      const tag = sm[0];
      const name = xmlAttr(tag, 'name');
      const relId = xmlAttr(tag, 'r:id') || xmlAttr(tag, 'id');
      if (name && relId) sheets.push({ name, relId });
    }
    if (!sheets.length) throw new Error('Workbook không có sheet dữ liệu.');

    const rels = new Map();
    const relRe = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*\/?>/gi;
    let rr;
    while ((rr = relRe.exec(relsXml))) {
      const tag = rr[0];
      const id = xmlAttr(tag, 'Id');
      const target = xmlAttr(tag, 'Target');
      if (!id || !target) continue;
      const path = target.startsWith('/') ? normalizeZipPath(target.slice(1)) : normalizeZipPath(`xl/${target}`);
      rels.set(id, path);
    }

    const wanted = sheets.find(s => s.name === 'IMPORT_READY')
      || sheets.find(s => s.name === 'NHAP_THIET_BI')
      || sheets[0];
    const path = rels.get(wanted.relId);
    if (!path) throw new Error(`Không xác định được dữ liệu của sheet ${wanted.name}.`);
    return { name: wanted.name, path };
  }

  async function parseXlsxRaw(arrayBuffer) {
    const entries = await unzipXlsx(arrayBuffer);
    const selected = parseWorkbookSheet(entries);
    const shared = parseSharedStrings(xmlText(entries, 'xl/sharedStrings.xml', false));
    const worksheetXml = xmlText(entries, selected.path);
    const parsedRows = parseWorksheet(worksheetXml, shared);
    if (!parsedRows.length) throw new Error(`Sheet ${selected.name} không có dữ liệu.`);

    const headerRow = parsedRows.find(r => r.rowNumber === 1) || parsedRows[0];
    const headers = new Map();
    headerRow.cells.forEach((value, col) => {
      const header = String(value ?? '').trim();
      if (header) headers.set(col, header);
    });
    if (!headers.size) throw new Error('Không đọc được hàng tiêu đề của file Excel.');

    const rows = [];
    parsedRows.forEach(row => {
      if (row === headerRow) return;
      const obj = {};
      let hasData = false;
      headers.forEach((header, col) => {
        const value = row.cells.has(col) ? row.cells.get(col) : '';
        obj[header] = value;
        if (value !== '' && value != null) hasData = true;
      });
      if (hasData) rows.push(obj);
    });
    return { sheetName: selected.name, rows };
  }

  async function readViaServer(file) {
    const form = new FormData();
    form.append('file', file, file.name || 'import.xlsx');
    const response = await fetch('/api/import/devices/preview', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return { sheetName: normalizeText(data?.sheetName || 'IMPORT_READY'), rows: Array.isArray(data?.rows) ? data.rows : [] };
  }

  readExcelFile = async function readExcelFileResilient(file) {
    if (!file) throw new Error('Chưa chọn file Excel.');
    if (!/\.xlsx$/i.test(String(file.name || ''))) throw new Error('Chỉ hỗ trợ file Excel định dạng .xlsx.');
    if (Number(file.size || 0) > 25 * 1024 * 1024) throw new Error('File Excel vượt quá 25 MB.');

    let parsed;
    let rawError = null;
    try {
      parsed = await parseXlsxRaw(await file.arrayBuffer());
    } catch (e) {
      rawError = e;
      try {
        parsed = await readViaServer(file);
      } catch (serverError) {
        throw new Error(`Không đọc được file Excel. Bộ đọc XLSX: ${rawError?.message || 'lỗi không xác định'}; dự phòng server: ${serverError?.message || 'lỗi không xác định'}`);
      }
    }

    const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    if (rawRows.length > 5000) throw new Error('File có quá 5.000 dòng dữ liệu; vui lòng chia nhỏ trước khi nhập.');
    const rows = [];
    rawRows.forEach((obj, index) => {
      const candidate = parseRowObject(obj || {}, index + 2);
      if ([candidate.departmentCode, candidate.groupCode, candidate.name, candidate.serial].some(Boolean)) rows.push(candidate);
    });

    return {
      sheetName: normalizeText(parsed?.sheetName || 'IMPORT_READY'),
      rows
    };
  };

  // Hook phục vụ kiểm thử tự động; không chứa dữ liệu người dùng.
  window.__QY4_XLSX_RAW_READER__ = { parseXlsxRaw };
})();

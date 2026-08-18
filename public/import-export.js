const IMPORT_STATE = {
  user: null,
  file: null,
  sheetName: '',
  rows: [],
  existingDevices: [],
  meta: { departments: [], groups: [] },
  analysis: null,
  importing: false
};

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[*_:\/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excelValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return excelValue(value.result);
    if (Array.isArray(value.richText)) return value.richText.map(x => x.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text ?? '';
    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) return value.text || value.hyperlink || '';
  }
  return value;
}

function pick(row, aliases) {
  const keys = Object.keys(row);
  const normalized = new Map(keys.map(k => [normalizeHeader(k), k]));
  for (const alias of aliases) {
    const key = normalized.get(normalizeHeader(alias));
    if (key !== undefined) return excelValue(row[key]);
  }
  return '';
}

function numberValue(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = normalizeText(value).replace(/\./g, '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function yearValue(value) {
  const n = Math.trunc(numberValue(value, 0));
  return n >= 1900 && n <= 2200 ? n : null;
}

function dateValue(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
  }
  const s = normalizeText(value);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return '';
}

function qualityValue(value) {
  const raw = normalizeText(value);
  const n = Number(raw.match(/[1-5]/)?.[0] || value || 3);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
}

function departmentCodeFromLabel(label) {
  const s = normalizeText(label);
  const m = s.match(/^([A-Za-z]\d+)\s*[-–—]/);
  return m ? m[1].toUpperCase() : '';
}

function cleanDepartmentName(code, label) {
  const c = normalizeText(code);
  let s = normalizeText(label);
  if (c) s = s.replace(new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i'), '').trim();
  return s;
}

function appendTraceNote(note, registration, sourceId) {
  const parts = [];
  const current = normalizeText(note);
  if (current) parts.push(current);
  const reg = normalizeText(registration);
  const sid = normalizeText(sourceId);
  if (reg && !current.toLowerCase().includes('số lưu hành')) parts.push(`Số lưu hành: ${reg}`);
  if (sid && !current.toLowerCase().includes('id nguồn')) parts.push(`ID nguồn/HIS: ${sid}`);
  return parts.join(' | ');
}

function parseRowObject(obj, rowNumber) {
  const departmentLabel = normalizeText(pick(obj, ['Khoa/Phòng', 'Khoa/Phòng *']));
  const departmentCode = normalizeText(pick(obj, ['Mã khoa', 'Mã khoa (tự động)'])) || departmentCodeFromLabel(departmentLabel);
  const groupName = normalizeText(pick(obj, ['Nhóm thiết bị', 'Nhóm thiết bị *']));
  const groupCode = normalizeText(pick(obj, ['Mã nhóm', 'Mã nhóm máy', 'Mã nhóm máy (tự động)'])).toUpperCase();
  const name = normalizeText(pick(obj, ['Tên thiết bị', 'Tên thiết bị *']));
  const serial = normalizeText(pick(obj, ['Serial Number', 'Serial Number *']));
  const registration = normalizeText(pick(obj, ['Số lưu hành']));
  const sourceId = normalizeText(pick(obj, ['ID nguồn/HIS', 'ID']));
  const note = appendTraceNote(pick(obj, ['Ghi chú']), registration, sourceId);

  return {
    rowNumber,
    sourceStt: normalizeText(pick(obj, ['STT nguồn', 'STT'])) || String(rowNumber - 1),
    departmentLabel,
    departmentCode: departmentCode.toUpperCase(),
    departmentName: cleanDepartmentName(departmentCode, departmentLabel),
    groupName,
    groupCode,
    name,
    serial,
    payload: {
      department_code: departmentCode.toUpperCase(),
      group_code: groupCode,
      name,
      manufacturer: normalizeText(pick(obj, ['Hãng sản xuất', 'Hãng SX'])),
      model: normalizeText(pick(obj, ['Model', 'Ký hiệu / Model', 'Ký hiệu'])),
      year_in_use: yearValue(pick(obj, ['Năm sử dụng', 'Năm SD'])),
      warranty_end: dateValue(pick(obj, ['Hạn bảo hành đến', 'Hạn bảo hành', 'Hạn BH'])),
      status: normalizeText(pick(obj, ['Tình trạng'])) || 'Đang hoạt động',
      quality_level: qualityValue(pick(obj, ['Cấp chất lượng'])),
      serial,
      country: normalizeText(pick(obj, ['Nước sản xuất', 'Nước SX'])),
      year_manufactured: yearValue(pick(obj, ['Năm sản xuất', 'Năm SX'])),
      cost: Math.max(0, numberValue(pick(obj, ['Nguyên giá (VNĐ)', 'Nguyên giá']), 0)),
      funding: normalizeText(pick(obj, ['Nguồn kinh phí'])),
      location: normalizeText(pick(obj, ['Vị trí đặt máy', 'Vị trí'])),
      note,
      device_code: '',
      insurance_code: normalizeText(pick(obj, ['Mã máy BHXH / mã quản lý', 'Mã máy BHXH', 'Mã quản lý']))
    }
  };
}

async function readExcelFile(file) {
  if (!window.ExcelJS) throw new Error('Không tải được bộ đọc ExcelJS.');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.getWorksheet('IMPORT_READY') || book.getWorksheet('NHAP_THIET_BI') || book.worksheets[0];
  if (!sheet) throw new Error('File Excel không có sheet dữ liệu.');

  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = normalizeText(cell.text || excelValue(cell.value));
  });
  if (!headers.some(Boolean)) throw new Error('Không đọc được hàng tiêu đề của file Excel.');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    headers.forEach((header, col) => {
      if (header) obj[header] = excelValue(row.getCell(col).value);
    });
    const candidate = parseRowObject(obj, rowNumber);
    if ([candidate.departmentCode, candidate.groupCode, candidate.name, candidate.serial].some(Boolean)) rows.push(candidate);
  });
  return { sheetName: sheet.name, rows };
}

function normalizedName(value) {
  return normalizeText(value).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function isImportUser(user) {
  const role = normalizeText(user?.role);
  return /quản trị/i.test(role) || /khoa trang bị|trang bị|ttbyt|kỹ thuật|ky thuat/i.test(role);
}

async function refreshServerState() {
  const [devices, meta] = await Promise.all([api('/api/devices'), api('/api/meta')]);
  IMPORT_STATE.existingDevices = Array.isArray(devices) ? devices : [];
  IMPORT_STATE.meta = meta || { departments: [], groups: [] };
}

function analyzeRows(rows) {
  const existingSerials = new Set(
    IMPORT_STATE.existingDevices.map(x => normalizeText(x.serial).toLowerCase()).filter(Boolean)
  );
  const uploadSerialCounts = new Map();
  rows.forEach(r => {
    const key = r.serial.toLowerCase();
    if (key) uploadSerialCounts.set(key, (uploadSerialCounts.get(key) || 0) + 1);
  });

  const departments = new Map((IMPORT_STATE.meta.departments || []).map(x => [normalizeText(x.code).toUpperCase(), x]));
  const groups = new Map((IMPORT_STATE.meta.groups || []).map(x => [normalizeText(x.code).toUpperCase(), x]));
  const autoCreate = q('autoCreateCatalogs').checked;

  let ready = 0, errors = 0, existing = 0;
  const missingDepartments = new Map();
  const missingGroups = new Map();

  rows.forEach(r => {
    const issues = [];
    let state = 'ready';
    if (!r.departmentCode) issues.push('Thiếu Khoa/Phòng');
    if (!r.groupCode || !r.groupName) issues.push('Thiếu Nhóm thiết bị');
    if (!r.name) issues.push('Thiếu Tên thiết bị');
    if (!r.serial) issues.push('Thiếu Serial Number');

    const serialKey = r.serial.toLowerCase();
    if (serialKey && (uploadSerialCounts.get(serialKey) || 0) > 1) issues.push('Trùng Serial trong file');

    const existingDept = r.departmentCode ? departments.get(r.departmentCode) : null;
    if (r.departmentCode && !existingDept) {
      if (autoCreate && r.departmentName) missingDepartments.set(r.departmentCode, { code:r.departmentCode, name:r.departmentName });
      else issues.push(`Khoa ${r.departmentCode} chưa có trong hệ thống`);
    }

    const existingGroup = r.groupCode ? groups.get(r.groupCode) : null;
    if (r.groupCode && !existingGroup) {
      if (autoCreate && r.groupName) missingGroups.set(r.groupCode, { code:r.groupCode, name:r.groupName });
      else issues.push(`Nhóm ${r.groupCode} chưa có trong hệ thống`);
    }

    if (issues.length) {
      state = 'error';
      errors++;
    } else if (serialKey && existingSerials.has(serialKey)) {
      state = 'existing';
      existing++;
    } else {
      ready++;
    }
    r.validation = { state, issues };
  });

  return {
    total: rows.length,
    ready,
    errors,
    existing,
    missingDepartments: [...missingDepartments.values()],
    missingGroups: [...missingGroups.values()]
  };
}

function stateLabel(row) {
  const s = row.validation?.state;
  if (s === 'ready') return '<span class="tag green">Sẵn sàng</span>';
  if (s === 'existing') return '<span class="tag yellow">Đã tồn tại</span>';
  return '<span class="tag red">Cần sửa</span>';
}

function renderAnalysis() {
  const a = IMPORT_STATE.analysis || { total:0, ready:0, errors:0, existing:0, missingDepartments:[], missingGroups:[] };
  q('statTotal').textContent = a.total;
  q('statReady').textContent = a.ready;
  q('statExisting').textContent = a.existing;
  q('statError').textContent = a.errors;
  q('sheetInfo').textContent = IMPORT_STATE.sheetName ? `Đang đọc sheet: ${IMPORT_STATE.sheetName}` : 'Chưa chọn file.';

  const catalogParts = [];
  if (a.missingDepartments.length) catalogParts.push(`sẽ bổ sung ${a.missingDepartments.length} khoa/phòng`);
  if (a.missingGroups.length) catalogParts.push(`sẽ bổ sung ${a.missingGroups.length} nhóm thiết bị`);
  q('catalogInfo').textContent = catalogParts.length
    ? `Khi nhập chính thức, hệ thống ${catalogParts.join(' và ')} từ file.`
    : 'Danh mục Khoa/Phòng và Nhóm thiết bị đã khớp với hệ thống.';

  q('importBtn').disabled = IMPORT_STATE.importing || a.ready === 0;
  const rows = IMPORT_STATE.rows;
  q('previewRows').innerHTML = rows.map((r, i) => {
    const issue = r.validation?.issues?.join('; ') || (r.validation?.state === 'existing' ? 'Serial đã có trong hệ thống — sẽ bỏ qua' : '');
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.sourceStt)}</td>
      <td>${escHtml(r.departmentCode)}</td>
      <td>${escHtml(r.groupCode)}</td>
      <td>${escHtml(r.name)}</td>
      <td class="device-code">${escHtml(r.serial)}</td>
      <td>${stateLabel(r)}</td>
      <td class="import-issue">${escHtml(issue || '—')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="center-empty">Chưa có dữ liệu để xem trước.</td></tr>';
}

async function validateCurrentFile() {
  if (!IMPORT_STATE.file) {
    alert('Anh chọn file Excel trước.');
    return;
  }
  setMessage('Đang đọc và kiểm tra file...', 'info');
  try {
    const parsed = await readExcelFile(IMPORT_STATE.file);
    IMPORT_STATE.sheetName = parsed.sheetName;
    IMPORT_STATE.rows = parsed.rows;
    await refreshServerState();
    IMPORT_STATE.analysis = analyzeRows(IMPORT_STATE.rows);
    renderAnalysis();
    setMessage(`Đã kiểm tra ${IMPORT_STATE.analysis.total} dòng. Có ${IMPORT_STATE.analysis.ready} dòng sẵn sàng nhập.`, 'success');
  } catch (e) {
    IMPORT_STATE.rows = [];
    IMPORT_STATE.analysis = null;
    renderAnalysis();
    setMessage(e?.message || 'Không đọc được file Excel.', 'error');
  }
}

async function ensureCatalogs(analysis) {
  for (const d of analysis.missingDepartments || []) {
    try {
      await api('/api/departments', { method:'POST', body:JSON.stringify(d) });
    } catch (e) {
      const fresh = await api('/api/meta');
      if (!(fresh.departments || []).some(x => normalizeText(x.code).toUpperCase() === d.code)) throw e;
    }
  }
  for (const g of analysis.missingGroups || []) {
    try {
      await api('/api/device-groups', { method:'POST', body:JSON.stringify(g) });
    } catch (e) {
      const fresh = await api('/api/meta');
      if (!(fresh.groups || []).some(x => normalizeText(x.code).toUpperCase() === g.code)) throw e;
    }
  }
}

function allocateDeviceCodes(rows, existingDevices) {
  const used = new Set(existingDevices.map(x => normalizeText(x.device_code)).filter(Boolean));
  const maxByPrefix = new Map();

  function existingMax(prefix) {
    if (maxByPrefix.has(prefix)) return maxByPrefix.get(prefix);
    let max = 0;
    used.forEach(code => {
      if (!code.startsWith(prefix)) return;
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
    });
    maxByPrefix.set(prefix, max);
    return max;
  }

  rows.forEach(r => {
    const prefix = `${r.departmentCode}.${r.groupCode}.`;
    let n = existingMax(prefix);
    let code = '';
    do {
      n += 1;
      code = `${prefix}${String(n).padStart(4, '0')}`;
    } while (used.has(code));
    maxByPrefix.set(prefix, n);
    used.add(code);
    r.payload.device_code = code;
  });
}

function setProgress(done, total) {
  const pct = total ? Math.round(done * 100 / total) : 0;
  q('progressBar').style.width = `${pct}%`;
  q('progressText').textContent = total ? `${done}/${total} (${pct}%)` : '0/0';
}

function setMessage(text, type = 'info') {
  const el = q('importMessage');
  el.textContent = text || '';
  el.className = `import-message ${type}`;
}

async function importValidatedRows() {
  if (IMPORT_STATE.importing) return;
  if (!IMPORT_STATE.rows.length) {
    alert('Chưa có dữ liệu đã kiểm tra.');
    return;
  }
  if (!confirm('Nhập chính thức các thiết bị đang ở trạng thái “Sẵn sàng” vào phần mềm?')) return;

  IMPORT_STATE.importing = true;
  q('importBtn').disabled = true;
  setProgress(0, 0);
  setMessage('Đang kiểm tra lại dữ liệu hiện tại của hệ thống...', 'info');

  try {
    await refreshServerState();
    IMPORT_STATE.analysis = analyzeRows(IMPORT_STATE.rows);
    renderAnalysis();

    let candidates = IMPORT_STATE.rows.filter(r => r.validation?.state === 'ready');
    if (!candidates.length) {
      setMessage('Không còn dòng nào cần nhập. Các Serial có thể đã tồn tại trong hệ thống.', 'info');
      return;
    }

    await ensureCatalogs(IMPORT_STATE.analysis);
    await refreshServerState();
    IMPORT_STATE.analysis = analyzeRows(IMPORT_STATE.rows);
    candidates = IMPORT_STATE.rows.filter(r => r.validation?.state === 'ready');
    allocateDeviceCodes(candidates, IMPORT_STATE.existingDevices);

    let success = 0;
    const failures = [];
    setProgress(0, candidates.length);

    for (let i = 0; i < candidates.length; i++) {
      const row = candidates[i];
      try {
        await api('/api/devices', { method:'POST', body:JSON.stringify(row.payload) });
        success++;
      } catch (e) {
        failures.push({ stt: row.sourceStt, name: row.name, error: e?.message || 'Lỗi không xác định' });
      }
      setProgress(i + 1, candidates.length);
      if ((i + 1) % 10 === 0 || i + 1 === candidates.length) {
        setMessage(`Đang nhập: ${i + 1}/${candidates.length} — thành công ${success}, lỗi ${failures.length}.`, 'info');
      }
    }

    await refreshServerState();
    IMPORT_STATE.analysis = analyzeRows(IMPORT_STATE.rows);
    renderAnalysis();

    if (failures.length) {
      const brief = failures.slice(0, 5).map(x => `STT ${x.stt}: ${x.name}`).join('; ');
      setMessage(`Đã nhập ${success} thiết bị; ${failures.length} dòng lỗi. ${brief}${failures.length > 5 ? '…' : ''}`, 'error');
    } else {
      setMessage(`Hoàn tất: đã nhập ${success} thiết bị. Những Serial đã tồn tại được tự động bỏ qua.`, 'success');
    }
  } catch (e) {
    setMessage(e?.message || 'Không thể hoàn tất nhập dữ liệu.', 'error');
  } finally {
    IMPORT_STATE.importing = false;
    q('importBtn').disabled = !(IMPORT_STATE.analysis?.ready > 0);
  }
}

function resetImport() {
  IMPORT_STATE.file = null;
  IMPORT_STATE.sheetName = '';
  IMPORT_STATE.rows = [];
  IMPORT_STATE.analysis = null;
  q('excelFile').value = '';
  setProgress(0, 0);
  setMessage('', 'info');
  renderAnalysis();
}

async function exportCurrentCsv() {
  const rows = await api('/api/devices');
  const csv = [[
    'Mã thiết bị','Tên thiết bị','Nhóm','Khoa/Phòng','Hãng SX','Model',
    'Serial Number','Năm SD','Tình trạng','Vị trí'
  ]];
  rows.forEach(r => csv.push([
    r.device_code, r.name, r.group_name, r.department_name, r.manufacturer,
    r.model, r.serial, r.year_in_use, r.status, r.location
  ]));
  exportCsv('thiet_bi_qy4.csv', csv);
}

document.addEventListener('DOMContentLoaded', async () => {
  setLayout('devices', 'Nhập Excel', 'Kiểm tra → xem trước → nhập thiết bị vào QY4-TBYT');
  try {
    const me = await api('/api/auth/me');
    IMPORT_STATE.user = me?.user || null;
  } catch {
    window.location.href = '/login.html?next=%2Fimport-export.html';
    return;
  }
  if (!isImportUser(IMPORT_STATE.user)) {
    alert('Chỉ Quản trị viên hoặc Khoa Trang bị được nhập dữ liệu thiết bị.');
    window.location.href = '/index.html';
    return;
  }

  q('excelFile').addEventListener('change', () => {
    IMPORT_STATE.file = q('excelFile').files?.[0] || null;
    IMPORT_STATE.rows = [];
    IMPORT_STATE.analysis = null;
    renderAnalysis();
    if (IMPORT_STATE.file) validateCurrentFile();
  });
  q('checkBtn').onclick = validateCurrentFile;
  q('importBtn').onclick = importValidatedRows;
  q('resetImportBtn').onclick = resetImport;
  q('exportCurrentBtn').onclick = exportCurrentCsv;
  q('autoCreateCatalogs').addEventListener('change', () => {
    if (!IMPORT_STATE.rows.length) return;
    IMPORT_STATE.analysis = analyzeRows(IMPORT_STATE.rows);
    renderAnalysis();
  });

  renderAnalysis();
});

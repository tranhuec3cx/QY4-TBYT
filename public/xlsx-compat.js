(() => {
  if (!window.ExcelJS) {
    console.error('[P3 Excel] Không tìm thấy ExcelJS browser bundle.');
    return;
  }

  function excelSerialToDate(serial) {
    const n = Number(serial);
    if (!Number.isFinite(n)) return null;
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return null;
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  function jsonToSheet(rows) {
    return { __qy4Rows: Array.isArray(rows) ? rows : [] };
  }

  function bookNew() {
    return { SheetNames: [], Sheets: {} };
  }

  function bookAppendSheet(workbook, sheet, name) {
    const safeName = String(name || 'Sheet1').slice(0, 31) || 'Sheet1';
    workbook.SheetNames.push(safeName);
    workbook.Sheets[safeName] = sheet || { __qy4Rows: [] };
  }

  function sheetToJson(sheet, options = {}) {
    if (Array.isArray(sheet?.__qy4Rows)) return sheet.__qy4Rows;
    if (sheet && typeof sheet.eachRow === 'function') {
      const values = [];
      let headers = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells = Array.isArray(row.values) ? row.values.slice(1) : [];
        if (rowNumber === 1) {
          headers = cells.map((v, i) => String(v ?? `Cột ${i + 1}`).trim());
          return;
        }
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? options.defval ?? ''; });
        values.push(obj);
      });
      return values;
    }
    return [];
  }

  async function writeFile(workbook, filename) {
    const out = new ExcelJS.Workbook();
    for (const name of workbook.SheetNames || []) {
      const descriptor = workbook.Sheets?.[name] || {};
      const rows = Array.isArray(descriptor.__qy4Rows) ? descriptor.__qy4Rows : [];
      const ws = out.addWorksheet(String(name || 'Sheet1').slice(0, 31));
      const keys = [];
      rows.forEach(row => Object.keys(row || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
      if (!keys.length) keys.push('Thông báo');
      ws.columns = keys.map(k => ({ header: k, key: k, width: Math.min(45, Math.max(12, String(k).length + 4)) }));
      rows.forEach(row => ws.addRow(row));
      if (!rows.length) ws.addRow({ 'Thông báo': 'Chưa có dữ liệu' });
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}1` };
    }
    const buffer = await out.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'bao_cao.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  window.XLSX = {
    SSF: { parse_date_code: excelSerialToDate },
    utils: {
      json_to_sheet: jsonToSheet,
      book_new: bookNew,
      book_append_sheet: bookAppendSheet,
      sheet_to_json: sheetToJson
    },
    writeFile
  };
})();

// QY4-TBYT: thay thế bộ đọc Excel chạy trong trình duyệt bằng endpoint server-side.
// ExcelJS 4.4 browser bundle có thể lỗi với một số workbook thực tế; server reader
// dùng ExcelJS document mode để đọc ổn định hơn rồi trả dữ liệu JSON về giao diện.

readExcelFile = async function readExcelFileViaServer(file) {
  if (!file) throw new Error('Chưa chọn file Excel.');

  const form = new FormData();
  form.append('file', file, file.name || 'import.xlsx');

  const response = await fetch('/api/import/devices/preview', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' }
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Không đọc được file Excel (HTTP ${response.status}).`);
  }

  const rawRows = Array.isArray(data?.rows) ? data.rows : [];
  const rows = [];
  rawRows.forEach((obj, index) => {
    const candidate = parseRowObject(obj || {}, index + 2);
    if ([candidate.departmentCode, candidate.groupCode, candidate.name, candidate.serial].some(Boolean)) {
      rows.push(candidate);
    }
  });

  return {
    sheetName: normalizeText(data?.sheetName || 'IMPORT_READY'),
    rows
  };
};

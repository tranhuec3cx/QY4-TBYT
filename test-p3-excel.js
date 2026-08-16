const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ExcelJS = require('exceljs');

(async () => {
  global.window = global;
  global.ExcelJS = ExcelJS;
  window.ExcelJS = ExcelJS;

  let clicked = false;
  global.document = {
    createElement: () => ({
      href: '',
      download: '',
      click() { clicked = true; },
      remove() {}
    }),
    body: { appendChild() {} }
  };
  global.URL = {
    createObjectURL: () => 'blob:qy4-test',
    revokeObjectURL: () => {}
  };

  const code = fs.readFileSync(path.join(__dirname, 'public', 'xlsx-compat.js'), 'utf8');
  vm.runInThisContext(code, { filename: 'xlsx-compat.js' });

  assert.ok(global.XLSX, 'Phải tạo global XLSX compatibility');
  const d = XLSX.SSF.parse_date_code(45292);
  assert.ok(d && d.y >= 2023, 'Phải đọc được Excel serial date');

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet([
    { 'Mã TB': 'C7.CT.0001', 'Tên thiết bị': 'Máy CT' },
    { 'Mã TB': 'C7.XQ.0001', 'Tên thiết bị': 'Máy X-quang' }
  ]);
  const ws2 = XLSX.utils.json_to_sheet([{ 'Thông báo': 'Kiểm thử P3' }]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Thiết bị');
  XLSX.utils.book_append_sheet(wb, ws2, 'Báo cáo');

  assert.deepEqual(XLSX.utils.sheet_to_json(ws1), ws1.__qy4Rows);
  await XLSX.writeFile(wb, 'p3-test.xlsx');
  assert.equal(clicked, true, 'Xuất Excel phải kích hoạt tải file');

  console.log('[P3 EXCEL] PASS - compatibility shim tạo workbook nhiều sheet bằng ExcelJS.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

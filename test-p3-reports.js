const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const reportSource = fs.readFileSync('public/reports.js', 'utf8');
const fixSource = fs.readFileSync('public/reports-p3-fix.js', 'utf8');
const maintenanceSource = fs.readFileSync('public/inspection.js', 'utf8');
const inspectionsSource = fs.readFileSync('public/inspections.js', 'utf8');
const devicesSource = fs.readFileSync('public/devices.js', 'utf8');
const deviceDetailFixSource = fs.readFileSync('public/device-detail-p3-fix.js', 'utf8');
const p3StartSource = fs.readFileSync('p3-start.js', 'utf8');

// Parse-only checks for the browser scripts touched in P3.
new Function(reportSource);
new Function(fixSource);
new Function(maintenanceSource);
new Function(inspectionsSource);
new Function(devicesSource);
new Function(deviceDetailFixSource);
assert.ok(!devicesSource.includes('extractSerialFromHisCode'), 'Màn hình thiết bị không được còn hàm suy Serial từ mã HIS/BHXH.');
assert.ok(!devicesSource.includes('autoFillSerialFromHis'), 'Màn hình thiết bị không được tự điền Serial từ mã HIS/BHXH.');
assert.ok(!devicesSource.includes('serialInput").value.trim() ||'), 'Payload thiết bị phải giữ Serial hãng độc lập, không fallback sang mã khác.');
assert.ok(deviceDetailFixSource.includes('p3SaveGeneralStrictSerial'), 'Hồ sơ thiết bị phải có lớp cập nhật Serial độc lập.');
assert.ok(deviceDetailFixSource.includes('p3CancelMaintenance') && deviceDetailFixSource.includes('p3CancelInspection'), 'Hồ sơ thiết bị phải dùng hủy mềm cho Bảo dưỡng/Kiểm định.');
assert.ok(p3StartSource.includes("requestPath === '/device-detail.js'"), 'Runtime P3 phải phục vụ lớp đồng bộ cùng device-detail.js hiện hữu.');

const controls = {
  deptFilter: { value: 'C2' },
  groupFilter: { value: 'SH' },
  fromDate: { value: '2026-01-01' },
  toDate: { value: '2026-12-31' },
  searchInput: { value: '' },
  reportType: { value: 'assetOverview' },
  reportGroup: { value: 'tonghop' }
};

const xlsxCalls = [];
const context = vm.createContext({
  console,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  __controls: controls,
  document: { addEventListener() {} },
  XLSX: {
    utils: {
      book_new: () => ({ sheets: [] }),
      json_to_sheet: rows => ({ rows }),
      book_append_sheet: (wb, ws, name) => wb.sheets.push({ ws, name })
    },
    writeFile: (_wb, filename) => xlsxCalls.push(filename)
  }
});
context.window = context;
context.window.location = {};
context.window.print = () => {};

vm.runInContext(`
  function q(id) { return __controls[id] || { value: '', innerHTML: '', textContent: '', addEventListener() {} }; }
  function inDateRange(value, from, to) {
    if (!value) return true;
    const d = String(value).slice(0,10);
    return (!from || d >= from) && (!to || d <= to);
  }
  function formatDateVN(value) {
    if (!value) return '';
    const s = String(value).slice(0,10);
    const p = s.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
  }
  function formatDateTimeVN(value) { return formatDateVN(value); }
  function todayISO() { return '2026-08-17'; }
  function firstDayOfYearISO() { return '2026-01-01'; }
  function setLayout() {}
  function setDefaultDateRange() {}
  async function api() { return []; }
`, context);

vm.runInContext(reportSource, context);
vm.runInContext(fixSource, context);

const data = {
  devices: [
    { id:1, device_code:'C2.SH.0001', name:'Máy sinh hóa 1', department_code:'C2', group_code:'SH', status:'Đang hoạt động', cost:100, funding:'Ngân sách Quốc phòng' },
    { id:2, device_code:'C2.HH.0001', name:'Máy huyết học', department_code:'C2', group_code:'HH', status:'Ngừng hoạt động', cost:200 },
    { id:3, device_code:'A10.SH.0001', name:'Máy sinh hóa A10', department_code:'A10', group_code:'SH', status:'Hoạt động hạn chế', cost:300 },
    { id:4, device_code:'C2.SH.0002', name:'Máy sinh hóa 2', department_code:'C2', group_code:'SH', status:'Chờ sửa chữa', cost:400 }
  ],
  repairs: [
    { id:1, device_id:1, repair_date:'2025-12-31', received_at:'2026-08-01', device_code:'C2.SH.0001', device_name:'Máy sinh hóa 1', department_code:'C2', cost:10, processing_status:'Đã hoàn thành' },
    { id:2, device_id:2, repair_date:'2026-08-02', received_at:'2026-08-02', device_code:'C2.HH.0001', device_name:'Máy huyết học', department_code:'C2', cost:20, processing_status:'Đã hoàn thành' },
    { id:3, device_id:3, repair_date:'2026-08-03', received_at:'2026-08-03', device_code:'A10.SH.0001', device_name:'Máy sinh hóa A10', department_code:'A10', cost:30, processing_status:'Đã hoàn thành' }
  ],
  maintenances: [
    { id:1, device_id:1, maintenance_date:'2026-01-01', next_date:'2027-01-01', device_code:'C2.SH.0001', device_name:'Máy sinh hóa 1', department_code:'C2', type:'Định kỳ' },
    { id:2, device_id:1, maintenance_date:'2026-08-01', next_date:'2026-09-01', device_code:'C2.SH.0001', device_name:'Máy sinh hóa 1', department_code:'C2', type:'Định kỳ' },
    { id:3, device_id:3, maintenance_date:'2026-08-01', next_date:'2026-09-02', device_code:'A10.SH.0001', device_name:'Máy sinh hóa A10', department_code:'A10', type:'Định kỳ' }
  ],
  inspections: [
    { id:1, device_id:1, inspection_date:'2026-07-01', next_date:'2026-09-15', device_code:'C2.SH.0001', device_name:'Máy sinh hóa 1', department_code:'C2', organization:'Đơn vị KĐ' },
    { id:2, device_id:3, inspection_date:'2026-07-01', next_date:'2026-09-20', device_code:'A10.SH.0001', device_name:'Máy sinh hóa A10', department_code:'A10', organization:'Đơn vị KĐ' }
  ],
  incidents: [
    { id:1, device_id:1, incident_datetime:'2026-08-05', device_code:'C2.SH.0001', device_name:'Máy sinh hóa 1', department_code:'C2', description:'Lỗi 1', status:'Mới báo' },
    { id:2, device_id:2, incident_datetime:'2026-08-05', device_code:'C2.HH.0001', device_name:'Máy huyết học', department_code:'C2', description:'Lỗi 2', status:'Mới báo' },
    { id:3, device_id:3, incident_datetime:'2026-08-05', device_code:'A10.SH.0001', device_name:'Máy sinh hóa A10', department_code:'A10', description:'Lỗi 3', status:'Mới báo' }
  ],
  spareParts: []
};

vm.runInContext(`RAW = ${JSON.stringify(data)}; META = { departments:[{code:'C2',name:'Xét nghiệm'},{code:'A10',name:'Khoa A10'}], groups:[{code:'SH',name:'Sinh hóa'},{code:'HH',name:'Huyết học'}] };`, context);

function run(expr) { return vm.runInContext(expr, context); }

const overview = run(`reportData('assetOverview')`);
assert.strictEqual(overview.rows[0][3], 2, 'Phạm vi C2 + SH phải có đúng 2 thiết bị');
assert.strictEqual(overview.rows[1][3], 1, '"Đang hoạt động" không được tính Chờ sửa chữa/Ngừng hoạt động/Hoạt động hạn chế');

const incidents = run(`reportData('incidents')`);
assert.strictEqual(incidents.rows.length, 1, 'Bộ lọc khoa + nhóm phải áp dụng cho báo cáo sự cố');
assert.strictEqual(incidents.rows[0][2], 'C2.SH.0001');

const repairCost = run(`reportData('repairCostByDept')`);
assert.strictEqual(repairCost.rows.length, 1, 'Chi phí sửa chữa phải tuân theo bộ lọc nhóm thiết bị');
assert.strictEqual(repairCost.rows[0][3], 1);
assert.strictEqual(repairCost.rows[0][4], 10);

const repairs = run(`reportData('repairs')`);
assert.strictEqual(repairs.rows.length, 1, 'Ngày tiếp nhận phải được ưu tiên khi lọc sửa chữa thay vì ngày kỹ thuật cũ');

const due = run(`reportData('maintenanceDue')`);
assert.strictEqual(due.rows.length, 1, 'Báo cáo đến hạn bảo dưỡng chỉ lấy thiết bị trong phạm vi lọc');
assert.strictEqual(due.rows[0][5], '01/09/2026', 'Phải lấy hạn của bản ghi bảo dưỡng mới nhất theo ngày thực hiện');

const replace = run(`reportData('devicesNeedReplace')`);
assert.ok(replace.rows.every(r => r.length === replace.columns.length), 'Số cột và dữ liệu devicesNeedReplace phải khớp nhau');
const deviceList = run(`reportData('deviceListTemplate')`);
assert.ok(deviceList.rows.every(r => r.length === deviceList.columns.length), 'Danh sách thiết bị không được dư cột dữ liệu');
const cqy = run(`reportData('cqySupplied')`);
assert.strictEqual(cqy.rows.length, 1, 'Fixture phải có một thiết bị nguồn Quốc phòng');
assert.ok(cqy.rows.every(r => r.length === cqy.columns.length), 'Danh sách Cục Quân y cấp hiện vật không được dư cột dữ liệu');

const annual = run(`reportData('annualUsage')`);
assert.strictEqual(annual.rows.length, 1);
assert.strictEqual(annual.rows[0][2], 2, 'C2 + SH có 2 thiết bị');
assert.strictEqual(annual.rows[0][3], 1, 'Đang sử dụng chỉ có 1 thiết bị hoạt động');
assert.strictEqual(annual.rows[0][4], 1, 'Chờ sửa chữa phải được tính là không sử dụng');
assert.strictEqual(annual.rows[0][5], 1, 'Sửa chữa trong năm phải theo ngày tiếp nhận và đúng phạm vi lọc');

run(`CURRENT_COLUMNS=['A']; CURRENT=[[1]]; CURRENT_TITLE='Báo cáo thử'; exportExcel();`);
assert.strictEqual(xlsxCalls.length, 1, 'Xuất Excel báo cáo đang xem phải gọi XLSX.writeFile');
assert.ok(xlsxCalls[0].endsWith('_2026-08-17.xlsx'));

console.log('[P3 REPORT] PASS - Serial/BHXH độc lập ở danh sách + hồ sơ; vòng đời hủy mềm; lọc, trạng thái, ngày tiếp nhận, hạn gần nhất, căn cột và xuất Excel đúng logic.');

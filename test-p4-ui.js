const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const devicesSource = fs.readFileSync('public/devices.js', 'utf8');
const detailFixSource = fs.readFileSync('public/device-detail-p3-fix.js', 'utf8');
const categoriesSource = fs.readFileSync('public/categories.js', 'utf8');
const p7ClientSource = fs.readFileSync('public/p7-qr-client.js', 'utf8');
const scopeGuardSource = fs.readFileSync('p2-scope-guard.js', 'utf8');
const settingsHtml = fs.readFileSync('public/settings.html', 'utf8');
const devicesHtml = fs.readFileSync('public/index.html', 'utf8');
const settingsCss = fs.readFileSync('public/settings-ui.css', 'utf8');

new Function(devicesSource);
new Function(detailFixSource);
new Function(categoriesSource);
new Function(p7ClientSource);
new Function(scopeGuardSource);

// Bảng Thiết bị: dữ liệu nhập có HTML không được trở thành thẻ thực thi.
const deviceNodes = {
  deviceRows: { innerHTML: '' },
  listCount: { textContent: '' }
};
const deviceCtx = vm.createContext({
  console,
  document: { addEventListener() {}, body: { scrollHeight: 0 } },
  window: { scrollTo() {} },
  q: id => deviceNodes[id] || { value:'', innerHTML:'', textContent:'', addEventListener() {} },
  statusTagClass: () => 'red',
  formatDateVN: v => String(v || ''),
  exportCsv() {},
  exportA4Report() {},
  opt: () => '',
  optDepartmentFilter: () => '',
  applyFieldLabels() {},
  setLayout() {},
  api: async () => [],
  alert() {},
  confirm: () => true,
  showDeviceQrModal() {}
});
vm.runInContext(devicesSource, deviceCtx);
vm.runInContext(`
  FILTERED = [{
    id: 1,
    device_code: '<img src=x onerror=boom()>',
    name: '<svg onload=boom()>Máy A',
    department_code: 'C2<script>boom()</script>',
    model: '<b>M1</b>',
    serial: '<img src=x>',
    year_in_use: '2026',
    location: '<iframe src=x></iframe>',
    status: '<img src=x onerror=boom()>'
  }];
  renderRows();
`, deviceCtx);
const renderedDevices = deviceNodes.deviceRows.innerHTML;
assert.ok(renderedDevices.includes('&lt;img'), 'Bảng thiết bị phải encode thẻ HTML.');
assert.ok(renderedDevices.includes('&lt;svg'), 'Tên thiết bị phải encode HTML.');
assert.ok(!renderedDevices.includes('<script>boom()</script>'), 'Khoa sử dụng không được render script thô.');
assert.ok(!renderedDevices.includes('<iframe src=x>'), 'Vị trí không được render iframe thô.');

// Hồ sơ thiết bị: các mảng legacy được tạo bản sao escape chỉ trong lúc render,
// sau đó DEVICE phải được trả về dữ liệu gốc để form chỉnh sửa không bị double-encode.
let capturedDuringRender = null;
const detailNodes = { detailStatus: { innerHTML:'' } };
const detailCtx = vm.createContext({
  console,
  DEVICE_ID: 1,
  DEVICE: {
    id: 1,
    status: '<img src=x onerror=boom()>',
    accessories: [{ id:1, name:'<img src=x>', code:'<b>C</b>', maker_country:'<i>VN</i>', serial:'<svg>', note:'<script>x</script>' }],
    operation_logs: [{ id:1, log_datetime:'2026', user_name:'<img>', department_code:'C2', usage_count:'1', status_before:'<b>A</b>', status_after:'<b>B</b>', note:'<script>x</script>' }],
    documents: [{ id:1, name:'<img>', type:'<b>PDF</b>', updated_by:'<svg>', note:'<script>x</script>', file_path:'/uploads/a.pdf' }]
  },
  renderAll: () => { capturedDuringRender = detailCtx.DEVICE; },
  autoFillGeneralSerial() {},
  saveGeneral() {},
  deleteMaint() {},
  deleteInspection() {},
  infoItem() {},
  docFileLabel() {},
  q: id => detailNodes[id] || { value:'', innerHTML:'', textContent:'' },
  esc: value => String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  statusTagClass: () => 'red',
  document: { querySelectorAll: () => [] },
  api: async () => ({}),
  toggleGeneral() {},
  loadDevice: async () => {},
  alert() {},
  prompt: () => 'Lý do'
});
const originalDevice = detailCtx.DEVICE;
vm.runInContext(detailFixSource, detailCtx);
vm.runInContext('renderAll();', detailCtx);
assert.ok(capturedDuringRender.accessories[0].name.includes('&lt;img'), 'Phụ kiện phải được escape trước khi render legacy.');
assert.ok(capturedDuringRender.operation_logs[0].note.includes('&lt;script'), 'Nhật ký vận hành phải được escape trước khi render legacy.');
assert.ok(capturedDuringRender.documents[0].name.includes('&lt;img'), 'Tên tài liệu phải được escape trước khi render legacy.');
assert.strictEqual(detailCtx.DEVICE, originalDevice, 'Sau render phải trả DEVICE về dữ liệu gốc.');
assert.ok(detailNodes.detailStatus.innerHTML.includes('&lt;img'), 'Trạng thái chi tiết phải được escape.');

// Cài đặt v5: ba nhóm chức năng, quyền quản trị tài khoản và bộ lọc Thiết bị hai hàng.
assert.ok(settingsHtml.includes('data-tab="departments"'), 'Cài đặt phải có tab Khoa/Phòng.');
assert.ok(settingsHtml.includes('data-tab="groups"'), 'Cài đặt phải có tab Nhóm thiết bị.');
assert.ok(settingsHtml.includes('data-tab="users"'), 'Cài đặt phải có tab Tài khoản người dùng.');
assert.ok(settingsHtml.includes('id="userForm"') && settingsHtml.includes('id="userRole"'), 'Cài đặt phải có form tài khoản.');
assert.ok(categoriesSource.includes("api('/api/users')") && categoriesSource.includes('/reset-password'), 'Giao diện tài khoản phải dùng API bảo vệ và hỗ trợ cấp lại mật khẩu.');
assert.ok(categoriesSource.includes('cleanDepartmentName') && categoriesSource.includes('departmentLabel'), 'Phải chuẩn hóa hiển thị mã/tên khoa, tránh A1 - A1.');
assert.ok(p7ClientSource.includes('settingsMenuLink') && p7ClientSource.includes('optDepartmentFilter'), 'Menu chung phải có Cài đặt theo quyền và khóa lỗi tên khoa.');
assert.ok(scopeGuardSource.includes('Chỉ Quản trị viên được quản lý tài khoản người dùng.'), 'API tài khoản phải giới hạn Quản trị viên.');
assert.ok(scopeGuardSource.includes("crypto.scryptSync") && scopeGuardSource.includes('password_salt,password_hash'), 'Tài khoản mới phải lưu mật khẩu dạng salt/hash.');
assert.ok(scopeGuardSource.includes('Không xóa tài khoản để bảo toàn nhật ký'), 'Không được xóa cứng tài khoản người dùng.');
assert.ok(devicesHtml.includes('device-filter-grid-v2') && devicesHtml.includes('/settings-ui.css'), 'Màn Thiết bị phải dùng bộ lọc mới có nhãn.');
assert.ok(settingsCss.includes('grid-template-areas') && settingsCss.includes('search search search search'), 'Bộ lọc Thiết bị phải được bố trí theo hai hàng desktop.');

console.log('[P4 UI] PASS - escape dữ liệu, Cài đặt v5 và bộ lọc Thiết bị đã được khóa bằng test.');

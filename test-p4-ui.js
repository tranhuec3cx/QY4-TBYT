const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const devicesSource = fs.readFileSync('public/devices.js', 'utf8');
const detailFixSource = fs.readFileSync('public/device-detail-p3-fix.js', 'utf8');
new Function(devicesSource);
new Function(detailFixSource);

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

console.log('[P4 UI] PASS - bảng Thiết bị và các vùng legacy của Hồ sơ máy không render HTML thô từ dữ liệu nhập.');

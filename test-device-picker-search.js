const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const device = {
  id: 17,
  device_code: 'C2.SH.0001',
  name: 'Máy xét nghiệm',
  model: 'DXC',
  serial: 'SN-01',
  department_code: 'C2',
  department_name: 'Khoa Xét nghiệm',
  location: 'Phòng 2'
};

function loadScript(file) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', classList: { toggle() {}, remove() {} } });
    return nodes.get(id);
  };
  const context = vm.createContext({
    console,
    q: node,
    document: { addEventListener() {}, readyState: 'loading', getElementById: node },
    window: { location: { pathname: '/', search: '' } },
    URLSearchParams,
    setTimeout() {},
    clearTimeout() {}
  });
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  vm.runInContext(`DEVICES = ${JSON.stringify([device])}`, context);
  return { context, node };
}

{
  const { context, node } = loadScript('public/tickets.js');
  node('deviceSearch').value = 'xét nghiệm';
  assert.strictEqual(vm.runInContext('resolveIncidentDevice()', context), null, 'Sự cố không được tự chọn kết quả đầu tiên khi đang gõ.');
  node('deviceSearch').value = 'C2.SH.0001 - Máy xét nghiệm - SN-01';
  assert.strictEqual(vm.runInContext('resolveIncidentDevice().id', context), 17, 'Sự cố phải nhận đúng lựa chọn đầy đủ từ datalist.');
}

{
  const { context, node } = loadScript('public/inspection.js');
  node('deviceSearch').value = 'xét nghiệm';
  assert.strictEqual(vm.runInContext('resolveMaintDevice()', context), null, 'Bảo dưỡng không được tự chọn kết quả đầu tiên khi đang gõ.');
  assert.strictEqual(node('deviceId').value, '', 'Bảo dưỡng phải xóa ID cũ khi nội dung chưa phải một lựa chọn đầy đủ.');
  node('deviceSearch').value = 'C2.SH.0001 - Máy xét nghiệm (DXC • SN-01)';
  assert.strictEqual(vm.runInContext('resolveMaintDevice().id', context), 17, 'Bảo dưỡng phải nhận đúng lựa chọn đầy đủ từ datalist.');
  assert.strictEqual(node('deviceId').value, 17);
}

{
  const { context } = loadScript('public/inspections.js');
  assert.strictEqual(vm.runInContext(`findDeviceBySearch('xét nghiệm')`, context), null, 'Kiểm định không được tự chọn kết quả đầu tiên khi đang gõ.');
  assert.strictEqual(vm.runInContext(`findDeviceBySearch('C2.SH.0001 - Máy xét nghiệm - DXC - SN: SN-01 - C2').id`, context), 17, 'Kiểm định phải nhận đúng lựa chọn đầy đủ từ datalist.');
}

const pickerFix = fs.readFileSync('public/rc1-device-picker-fix.js', 'utf8');
assert.ok(pickerFix.includes('findExactDevice'), 'Bản vá dùng chung phải chỉ chốt lựa chọn khớp đầy đủ.');
assert.ok(pickerFix.includes('syncSelection(false)'), 'Khi đang gõ phải giữ nguyên từ khóa để datalist tiếp tục hiển thị.');
assert.ok(!pickerFix.includes('genericFind'), 'Không được khôi phục cách tìm mơ hồ rồi tự chọn dòng đầu tiên.');

console.log('[DEVICE PICKER] PASS - gõ để lọc, chỉ chốt thiết bị sau khi chọn đúng một gợi ý.');

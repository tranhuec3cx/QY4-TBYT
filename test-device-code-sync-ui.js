const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('public/device-code-sync-ui.js', 'utf8');
const detailFix = fs.readFileSync('public/device-detail-p3-fix.js', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');

new Function(source);
new Function(detailFix);

const ctx = vm.createContext({
  console,
  alert() {},
  confirm: () => false,
  document: {
    addEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
    createElement() { return {}; }
  },
  window: {
    location: { pathname: '/test' },
    api: async () => []
  }
});
vm.runInContext(source, ctx);

const sync = ctx.window.qy4DeviceCodeSync;
assert.ok(sync, 'Phải công khai helper đồng bộ mã để test.');
assert.strictEqual(sync.expectedPrefix('A10', 'ĐC'), 'A10.ĐC.', 'Mã nhóm có chữ Đ phải được giữ nguyên.');

const devices = [
  { id: 1, department_code: 'A9', group_code: 'SXK', device_code: 'A10.SXK.0001' },
  { id: 2, department_code: 'A9', group_code: 'SXK', device_code: 'A9.SXK.0002' }
];
assert.strictEqual(
  sync.allocateCode(devices[0], 'A9', 'SXK', devices),
  'A9.SXK.0001',
  'Khi chuyển A10 -> A9 phải giữ số cuối nếu mã đích chưa trùng.'
);

const collision = [
  { id: 1, department_code: 'A9', group_code: 'SXK', device_code: 'A10.SXK.0001' },
  { id: 2, department_code: 'A9', group_code: 'SXK', device_code: 'A9.SXK.0001' },
  { id: 3, department_code: 'A9', group_code: 'SXK', device_code: 'A9.SXK.0004' }
];
assert.strictEqual(
  sync.allocateCode(collision[0], 'A9', 'SXK', collision),
  'A9.SXK.0005',
  'Nếu số cũ bị trùng phải cấp số tiếp theo an toàn.'
);

assert.ok(indexHtml.includes('/device-code-sync-ui.js'), 'Màn Thiết bị phải nạp bộ đồng bộ mã Khoa/Nhóm.');
assert.ok(detailFix.includes('p3DeviceCodeForClassification'), 'Hồ sơ thiết bị phải đồng bộ mã khi đổi Khoa/Nhóm.');
assert.ok(detailFix.includes("replace(/[^A-Z0-9Đ]/g, '')"), 'Hồ sơ thiết bị phải giữ chữ Đ trong mã nhóm.');

console.log('[DEVICE CODE SYNC] PASS - đổi Khoa/Nhóm tự đồng bộ tiền tố, giữ Đ và tránh trùng mã.');

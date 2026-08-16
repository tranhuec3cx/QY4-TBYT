const fs = require('fs');
const assert = require('assert');

const inspectSource = fs.readFileSync('public/inspect.js', 'utf8');
const securitySource = fs.readFileSync('p2-security.js', 'utf8');
const startSource = fs.readFileSync('p3-start.js', 'utf8');
const p2TestSource = fs.readFileSync('test-p2-security.js', 'utf8');

new Function(inspectSource);
new Function(startSource);
new Function(p2TestSource);

assert.ok(inspectSource.includes('publicParam("code")') || inspectSource.includes("publicParam('code')"), 'Trang QR phải đọc tham số code từ /q/<device_code>.');
assert.ok(inspectSource.includes('/api/public/device-code/'), 'Trang QR phải tra cứu thiết bị theo device_code ổn định.');
assert.ok(inspectSource.includes('/api/public/device/'), 'Trang QR vẫn phải tương thích đường dẫn ID cũ.');

assert.ok(securitySource.includes('P5_SAFE_PUBLIC_DEVICE'), 'P2 security phải có payload QR public tối thiểu.');
assert.ok(securitySource.includes('SELECT dv.id,dv.device_code,dv.name,dv.department_code'), 'Payload public chỉ chọn trường nhận diện cần thiết.');
assert.ok(!securitySource.includes('pathname.startsWith("/qr/device/") || pathname.startsWith("/qr/device-code/")'), 'Payload QR kỹ thuật đầy đủ không được nằm trong allowlist public.');

const publicApiStart = securitySource.indexOf('function publicApi(pathname)');
assert.ok(publicApiStart >= 0, 'Phải có publicApi allowlist.');
const publicApiEnd = securitySource.indexOf('function qrPostRateAllowed', publicApiStart);
const publicApiBlock = securitySource.slice(publicApiStart, publicApiEnd);
assert.ok(publicApiBlock.includes('pathname === "/qr/checks"'), 'Gửi kết quả kiểm tra QR phải còn public.');
assert.ok(publicApiBlock.includes('pathname.startsWith("/public/")'), 'Payload thiết bị tối thiểu phải còn public.');
assert.ok(!publicApiBlock.includes('/qr/png'), 'QR PNG generator phải yêu cầu đăng nhập.');
assert.ok(!publicApiBlock.includes('/system/qr-origins'), 'Thông tin IP LAN/QR origins không được public.');
assert.ok(!publicApiBlock.includes('/system/public-qr-check'), 'Kiểm tra cấu hình QR không được public.');

assert.ok(startSource.includes('QR công khai (tự khai) - ${inspectorInput}'), 'Dữ liệu người kiểm tra từ QR phải được đánh dấu là tự khai.');
assert.ok(startSource.includes('.trim().slice(0, 120)'), 'Tên người kiểm tra QR phải được giới hạn server-side.');
assert.ok(startSource.includes('.trim().slice(0, 40)'), 'Số điện thoại QR phải được giới hạn server-side.');
assert.ok(startSource.includes('.trim().slice(0, 2000)'), 'Mô tả/ghi chú QR phải được giới hạn server-side.');

assert.ok(p2TestSource.includes("assert.equal(r.status, 401, 'Payload QR đầy đủ không được public khi chưa đăng nhập')"), 'Integration test phải khóa endpoint QR đầy đủ.');
assert.ok(p2TestSource.includes("assert.equal(r.status, 401, 'QR PNG generator không được public')"), 'Integration test phải khóa QR generator.');
assert.ok(p2TestSource.includes("assert.equal(r.status, 401, 'Danh sách IP LAN/QR origins không được public')"), 'Integration test phải khóa thông tin LAN.');
assert.ok(p2TestSource.includes('/api/public/device-code/A10.DT.0001'), 'Integration test phải kiểm tra tra cứu QR bằng device_code.');

console.log('[P5 QR] PASS - device_code hoạt động; public payload tối thiểu; endpoint kỹ thuật/QR generator/LAN bị khóa; dữ liệu tự khai được đánh dấu và giới hạn.');

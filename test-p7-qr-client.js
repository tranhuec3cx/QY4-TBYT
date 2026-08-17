const fs = require('fs');
const assert = require('assert');

const qrPage = fs.readFileSync('public/qr-check.js', 'utf8');
const qrClient = fs.readFileSync('public/p7-qr-client.js', 'utf8');
const startup = fs.readFileSync('p7-start.js', 'utf8');

assert.ok(qrPage.includes('/api/public/device/'), 'Trang QR phải dùng payload public tối thiểu theo ID');
assert.ok(qrPage.includes('/api/public/device-code/'), 'Trang QR phải dùng payload public tối thiểu theo device_code');
assert.ok(!qrPage.includes('/api/qr/device/${'), 'Trang QR public không được gọi payload kỹ thuật đầy đủ');
assert.ok(qrPage.includes('qr_kind') && qrPage.includes('qr_key') && qrPage.includes('token'), 'POST QR phải gửi khóa + token đã ký');
assert.ok(qrPage.includes('getParam("id") || getParam("device_id")'), 'Trang QR phải nhận cả id mới và device_id legacy');
assert.ok(qrPage.includes('getParam("code") || getParam("device_code")'), 'Trang QR phải nhận cả code và device_code');
assert.ok(qrClient.includes('/api/qr/sign?device_id='), 'Client nội bộ phải xin token từ server trước khi in QR');
assert.ok(qrClient.includes('__qy4QrToken'), 'Client phải gắn token vào URL QR');
assert.ok(startup.includes('attachPublicGuard'), 'P7 startup phải gắn public guard trước endpoint public');
assert.ok(startup.includes('req.qy4QrDeviceId || 0'), 'Backend QR check phải dùng ID đã xác minh từ token');
assert.ok(startup.includes('token = String(req.query.token'), 'Redirect /q phải bảo toàn token');

console.log('[P7 CLIENT TEST] PASS - trang quét/in QR dùng signed public flow và payload tối thiểu.');

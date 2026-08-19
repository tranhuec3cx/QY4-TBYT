const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('public/settings.html', 'utf8');
const js = fs.readFileSync('public/settings-group-device-hints.js', 'utf8');
const css = fs.readFileSync('public/settings-ui.css', 'utf8');

new Function(js);

assert.ok(html.includes('<th>Model (gợi ý)</th><th>Serial Number</th><th>Thao tác</th>'), 'Serial Number phải nằm ngay sau Model trong bảng Nhóm thiết bị.');
assert.ok(html.includes('/settings-group-device-hints.js'), 'Trang Cài đặt phải nạp bộ hiển thị Model/Serial.');
assert.ok(js.includes("groupDeviceValues(x.code, 'model')"), 'Phải lấy Model từ thiết bị thực tế theo nhóm.');
assert.ok(js.includes("groupDeviceValues(x.code, 'serial')"), 'Phải lấy Serial Number từ thiết bị thực tế theo nhóm.');
assert.ok(js.includes("await api('/api/devices')"), 'Model/Serial phải lấy từ API thiết bị, không nhập tay ở danh mục.');
assert.ok(js.includes("colspan=\"7\""), 'Bảng rỗng phải đúng 7 cột sau khi thêm Serial.');
assert.ok(css.includes('.settings-groups-table') && css.includes('.settings-serial-cell'), 'Bảng nhóm phải có CSS cho cột Serial.');

console.log('[SETTINGS GROUP SERIAL] PASS - cột Serial Number nằm sau Model và lấy từ dữ liệu thiết bị.');

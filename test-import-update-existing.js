const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('public/import-update-existing.js', 'utf8');
const html = fs.readFileSync('public/import-export.html', 'utf8');

new Function(source);

assert.ok(html.includes('id="importMode"'), 'Màn Nhập Excel phải có chọn chế độ xử lý.');
assert.ok(html.includes('value="update"'), 'Phải có chế độ cập nhật thiết bị hiện có.');
assert.ok(html.includes('/import-update-existing.js'), 'Phải nạp module cập nhật thiết bị hiện có.');
assert.ok(source.includes("CAP_NHAT_HIEN_CO"), 'Chế độ cập nhật phải ưu tiên sheet CAP_NHAT_HIEN_CO.');
assert.ok(source.includes("Serial Number"), 'Cập nhật phải dùng Serial Number làm khóa đối chiếu.');
assert.ok(source.includes("department_code: existing.department_code"), 'Không được đổi Khoa khi bổ sung dữ liệu.');
assert.ok(source.includes("group_code: existing.group_code"), 'Không được đổi Nhóm khi bổ sung dữ liệu.');
assert.ok(source.includes("serial: existing.serial || ''"), 'Không được thay Serial khi bổ sung dữ liệu.');
assert.ok(source.includes("device_code: existing.device_code || ''"), 'Không được thay Mã thiết bị khi bổ sung dữ liệu.');
assert.ok(source.includes("cost: has('cost') ? updates.cost"), 'Phải hỗ trợ bổ sung Nguyên giá.');
assert.ok(source.includes("quality_level: has('quality_level') ? updates.quality_level"), 'Phải hỗ trợ bổ sung Cấp chất lượng.');
assert.ok(source.includes("method:'PUT'"), 'Thiết bị đã có phải được cập nhật qua PUT, không POST tạo trùng.');

console.log('[IMPORT UPDATE EXISTING] PASS - cập nhật theo Serial, giữ định danh và hỗ trợ dữ liệu bổ sung.');

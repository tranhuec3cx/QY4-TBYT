const fs = require('fs');
const assert = require('assert');

const server = fs.readFileSync('server.js', 'utf8');
const maintenanceUi = fs.readFileSync('public/inspection.js', 'utf8');
const inspectionUi = fs.readFileSync('public/inspections.js', 'utf8');

new Function(server);
new Function(maintenanceUi);
new Function(inspectionUi);

assert.ok(
  server.includes('Không được đổi thiết bị của phiếu bảo dưỡng đã tạo.'),
  'Cập nhật bảo dưỡng phải khóa thiết bị gốc để bảo toàn lý lịch máy.'
);
assert.ok(
  server.includes('Không được đổi thiết bị của hồ sơ kiểm định/hiệu chuẩn đã tạo.'),
  'Cập nhật kiểm định phải khóa thiết bị gốc để bảo toàn lý lịch máy.'
);
assert.ok(
  server.includes('Thiếu thiết bị, thời gian hoặc nội dung bảo dưỡng.'),
  'Server phải kiểm tra trường bắt buộc của phiếu bảo dưỡng.'
);
assert.ok(
  server.includes('Thiếu thiết bị, thời gian, loại thực hiện hoặc kết quả kiểm định.'),
  'Server phải kiểm tra trường bắt buộc của hồ sơ kiểm định.'
);

const updateMaintenance = server.slice(
  server.indexOf('app.put("/api/maintenances/:id"'),
  server.indexOf('app.delete("/api/maintenances/:id"')
);
assert.ok(updateMaintenance.includes('const tx = db.transaction'), 'Cập nhật bảo dưỡng và tài liệu phải nằm trong một transaction.');
assert.ok(updateMaintenance.includes('if (req.file) safeUnlink(req.file.path);'), 'File mới phải được dọn khi cập nhật bảo dưỡng thất bại.');
assert.ok(
  updateMaintenance.indexOf('tx();') < updateMaintenance.indexOf('if (file && old.file_path) safeUnlink'),
  'Chỉ được xóa file bảo dưỡng cũ sau khi transaction thành công.'
);

const createMaintenance = server.slice(
  server.indexOf('app.post("/api/maintenances"'),
  server.indexOf('function getPublicDevicePayload')
);
assert.ok(createMaintenance.includes('const tx = db.transaction'), 'Tạo phiếu bảo dưỡng, tài liệu và lịch sử phải nguyên tử.');

const inspectionRoutes = server.slice(
  server.indexOf('app.post("/api/inspections"'),
  server.indexOf('app.get("/api/quality-ratings"')
);
assert.ok((inspectionRoutes.match(/db\.transaction/g) || []).length >= 2, 'Tạo và cập nhật kiểm định phải dùng transaction.');
assert.ok(inspectionRoutes.includes('writeHistory("inspection"'), 'Kiểm định phải ghi lịch sử khi tạo/cập nhật.');

assert.ok(maintenanceUi.includes('q("deviceSearch").disabled=true'), 'Giao diện cập nhật bảo dưỡng phải khóa ô đổi thiết bị.');
assert.ok(inspectionUi.includes("q('deviceSearch').disabled=true"), 'Giao diện cập nhật kiểm định phải khóa ô đổi thiết bị.');
assert.ok(inspectionUi.includes('${esc(deviceSearchLabel(d))}'), 'Danh sách gợi ý kiểm định phải escape dữ liệu thiết bị.');

console.log('[OPERATION INTEGRITY] PASS - bảo toàn thiết bị gốc, transaction và tệp hồ sơ bảo dưỡng/kiểm định.');

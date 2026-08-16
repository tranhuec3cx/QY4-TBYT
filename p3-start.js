const fs = require('fs');
const path = require('path');
const express = require('express');

// P3: một bản cài đặt mới phải tự tạo thư mục DB trước khi better-sqlite3 mở file.
fs.mkdirSync(path.join(__dirname, 'db'), { recursive: true });

// Giữ nguyên URL legacy /vendor/xlsx.full.min.js trên các trang hiện có, nhưng phục vụ
// ExcelJS + lớp tương thích QY4 thay cho package SheetJS `xlsx` đang có cảnh báo high.
const excelDist = path.join(__dirname, 'node_modules', 'exceljs', 'dist');
const excelBundle = path.join(excelDist, 'exceljs.min.js');
const legacyAlias = path.join(excelDist, 'xlsx.full.min.js');
const compatPath = path.join(__dirname, 'public', 'xlsx-compat.js');
const publicDir = path.join(__dirname, 'public');
const deviceDetailBasePath = path.join(publicDir, 'device-detail.js');
const deviceDetailP3Path = path.join(publicDir, 'device-detail-p3-fix.js');

if (fs.existsSync(excelBundle) && fs.existsSync(compatPath)) {
  const bundle = fs.readFileSync(excelBundle, 'utf8');
  const compat = fs.readFileSync(compatPath, 'utf8');
  fs.writeFileSync(legacyAlias, `${bundle}\n;${compat}\n`, 'utf8');
}
if (!fs.existsSync(deviceDetailP3Path)) {
  throw new Error('[P3] Thiếu public/device-detail-p3-fix.js; dừng để tránh chạy hồ sơ thiết bị không đồng bộ.');
}

const originalStatic = express.static;
express.static = function qy4Static(root, options) {
  const normalized = path.normalize(String(root || ''));
  const legacyXlsxRoot = path.normalize(path.join(__dirname, 'node_modules', 'xlsx', 'dist'));
  if (normalized === legacyXlsxRoot) root = excelDist;
  const middleware = originalStatic.call(this, root, options);
  if (normalized === path.normalize(publicDir)) {
    return function qy4P3PublicStatic(req, res, next) {
      const requestPath = String(req.path || req.url || '').split('?')[0];
      if (requestPath === '/device-detail.js' && fs.existsSync(deviceDetailBasePath)) {
        const base = fs.readFileSync(deviceDetailBasePath, 'utf8');
        const fix = fs.readFileSync(deviceDetailP3Path, 'utf8');
        res.type('application/javascript').send(`${base}\n\n;${fix}\n`);
        return;
      }
      return middleware(req, res, next);
    };
  }
  return middleware;
};

// P3: server.js cũ dùng chung seedData() cho cả production và demo. Trên DB trắng điều đó
// vừa tạo dữ liệu thiết bị giả, vừa lỗi vì dữ liệu mẫu cũ thiếu một số trường mới.
// Vá nguồn ngay trước khi safe-start kiểm tra/biên dịch để production chỉ tạo danh mục nền + admin,
// còn bộ thiết bị mẫu chỉ được sinh khi DEMO_MODE=true.
const serverPath = path.resolve(__dirname, 'server.js');
const nativeReadFileSync = fs.readFileSync.bind(fs);
function replaceRequired(source, label, before, after) {
  const first = source.indexOf(before);
  const second = first >= 0 ? source.indexOf(before, first + before.length) : -1;
  if (first < 0 || second >= 0) throw new Error(`[P3] Không thể áp dụng vá nguồn an toàn: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
fs.readFileSync = function qy4ReadFileSync(target, ...args) {
  const value = nativeReadFileSync(target, ...args);
  const targetPath = typeof target === 'string' ? path.resolve(target) : '';
  if (targetPath !== serverPath || typeof value !== 'string') return value;

  let source = value;
  source = replaceRequired(
    source,
    'production seed scope',
    '  users.forEach(r => insertUser.run(...r));',
    '  const initialUsers = process.env.DEMO_MODE === "true" ? users : users.filter(r => r[1] === "admin");\n  initialUsers.forEach(r => insertUser.run(...r));\n  if (process.env.DEMO_MODE !== "true") return;'
  );
  source = replaceRequired(
    source,
    'demo device named parameters',
    '      const info = insertDevice.run(device);',
    '      const info = insertDevice.run({ quality_level: 3, device_code: null, insurance_code: "", ...device });'
  );
  source = replaceRequired(
    source,
    'demo repair processing status',
    '      device.repairs.forEach(x => insertRepair.run(deviceId, ...x));',
    '      device.repairs.forEach(x => insertRepair.run(deviceId, ...x, x[7] === "Chờ sửa chữa" ? "Chờ linh kiện" : "Đã hoàn thành"));'
  );

  // Bảo toàn hồ sơ nghiệp vụ: thao tác "Hủy/Xóa" trên bảo dưỡng và kiểm định chỉ ẩn khỏi
  // danh sách/báo cáo hoạt động, không xóa vật lý bản ghi khỏi lý lịch thiết bị.
  source = replaceRequired(
    source,
    'maintenance lifecycle columns',
    '  const deptCount = db.prepare("SELECT COUNT(*) AS c FROM departments").get().c;',
    '  const maintenanceColsP3 = db.prepare("PRAGMA table_info(maintenances)").all().map(x => x.name);\n  if (!maintenanceColsP3.includes("cancelled_at")) db.exec("ALTER TABLE maintenances ADD COLUMN cancelled_at TEXT");\n  if (!maintenanceColsP3.includes("cancel_reason")) db.exec("ALTER TABLE maintenances ADD COLUMN cancel_reason TEXT");\n\n  const deptCount = db.prepare("SELECT COUNT(*) AS c FROM departments").get().c;'
  );
  source = replaceRequired(
    source,
    'inspection lifecycle columns',
    '\ninitExtendedModules();\n',
    '\ninitExtendedModules();\nconst inspectionColsP3 = db.prepare("PRAGMA table_info(inspections)").all().map(x => x.name);\nif (!inspectionColsP3.includes("cancelled_at")) db.exec("ALTER TABLE inspections ADD COLUMN cancelled_at TEXT");\nif (!inspectionColsP3.includes("cancel_reason")) db.exec("ALTER TABLE inspections ADD COLUMN cancel_reason TEXT");\n'
  );
  source = replaceRequired(
    source,
    'active maintenance list',
    '    LEFT JOIN device_groups g ON g.code = dv.group_code\n    ORDER BY m.id DESC',
    '    LEFT JOIN device_groups g ON g.code = dv.group_code\n    WHERE COALESCE(m.cancelled_at,\'\') = \'\'\n    ORDER BY m.id DESC'
  );
  source = replaceRequired(
    source,
    'soft cancel maintenance',
    'app.delete("/api/maintenances/:id", (req, res) => {\n  db.prepare("DELETE FROM maintenances WHERE id=?").run(req.params.id);\n  res.json({ ok: true });\n});',
    'app.delete("/api/maintenances/:id", (req, res) => {\n  const old = db.prepare("SELECT * FROM maintenances WHERE id=?").get(req.params.id);\n  if (!old) return res.status(404).json({ error: "Không tìm thấy bản ghi bảo dưỡng." });\n  const reason = String(req.body?.reason || "Hủy bản ghi nhập nhầm").trim();\n  db.prepare("UPDATE maintenances SET cancelled_at=?, cancel_reason=? WHERE id=?").run(nowSql(), reason, req.params.id);\n  writeHistory("maintenance", Number(req.params.id), old.performer || "Khoa Trang bị", "Hủy bản ghi", old.result || "", "Đã hủy", reason);\n  logAudit("maintenance", Number(req.params.id), "Hủy bản ghi", reason);\n  res.json({ ok: true });\n});'
  );
  source = replaceRequired(
    source,
    'active inspection list',
    '    LEFT JOIN device_groups g ON g.code = dv.group_code\n    ORDER BY COALESCE(i.next_date, i.inspection_date) ASC, i.id DESC',
    '    LEFT JOIN device_groups g ON g.code = dv.group_code\n    WHERE COALESCE(i.cancelled_at,\'\') = \'\'\n    ORDER BY COALESCE(i.next_date, i.inspection_date) ASC, i.id DESC'
  );
  source = replaceRequired(
    source,
    'soft cancel inspection',
    'app.delete("/api/inspections/:id", (req, res) => {\n  db.prepare("DELETE FROM inspections WHERE id=?").run(req.params.id);\n  res.json({ ok: true });\n});',
    'app.delete("/api/inspections/:id", (req, res) => {\n  const old = db.prepare("SELECT * FROM inspections WHERE id=?").get(req.params.id);\n  if (!old) return res.status(404).json({ error: "Không tìm thấy hồ sơ kiểm định." });\n  const reason = String(req.body?.reason || "Hủy hồ sơ nhập nhầm").trim();\n  db.prepare("UPDATE inspections SET cancelled_at=?, cancel_reason=? WHERE id=?").run(nowSql(), reason, req.params.id);\n  writeHistory("inspection", Number(req.params.id), old.organization || "Khoa Trang bị", "Hủy hồ sơ", old.result || "", "Đã hủy", reason);\n  logAudit("inspection", Number(req.params.id), "Hủy hồ sơ", reason);\n  res.json({ ok: true });\n});'
  );
  source = replaceRequired(
    source,
    'maintenance report excludes cancelled',
    'FROM maintenances m LEFT JOIN devices dv ON dv.id=m.device_id WHERE 1=1 ${dw.sql}',
    'FROM maintenances m LEFT JOIN devices dv ON dv.id=m.device_id WHERE COALESCE(m.cancelled_at,\'\')=\'\' ${dw.sql}'
  );
  source = replaceRequired(
    source,
    'inspection report excludes cancelled',
    'FROM inspections ins LEFT JOIN devices dv ON dv.id=ins.device_id WHERE 1=1 ${dw.sql}',
    'FROM inspections ins LEFT JOIN devices dv ON dv.id=ins.device_id WHERE COALESCE(ins.cancelled_at,\'\')=\'\' ${dw.sql}'
  );

  // P5: dữ liệu nhập từ QR công khai là dữ liệu tự khai, không phải danh tính đã xác minh.
  // Giới hạn độ dài ở server và đánh dấu nguồn ngay trong trường người kiểm tra/người báo.
  source = replaceRequired(
    source,
    'public QR self-declared actor',
    '    const inspector = String(p.inspector || "").trim();\n    const reporterPhone = String(p.reporter_phone || "").trim();',
    '    const inspectorInput = String(p.inspector || "").trim().slice(0, 120);\n    const inspector = inspectorInput ? `QR công khai (tự khai) - ${inspectorInput}` : "";\n    const reporterPhone = String(p.reporter_phone || "").trim().slice(0, 40);'
  );
  source = replaceRequired(
    source,
    'public QR text limits',
    '    const normalizedCondition = condition === "Tốt" ? "Bình thường" : condition;\n    if (!["Bình thường", "Có vấn đề"].includes(normalizedCondition)) return res.status(400).json({ error: "Tình trạng kiểm tra không hợp lệ." });\n    const description = String(p.description || "").trim();',
    '    const normalizedCondition = condition === "Tốt" ? "Bình thường" : condition;\n    if (!["Bình thường", "Có vấn đề"].includes(normalizedCondition)) return res.status(400).json({ error: "Tình trạng kiểm tra không hợp lệ." });\n    const description = String(p.description || "").trim().slice(0, 2000);\n    p.note = String(p.note || "").trim().slice(0, 2000);'
  );
  return source;
};

require('./safe-start');

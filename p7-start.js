const fs = require('fs');
const path = require('path');

// Nạp sớm để lỗi cú pháp/mô-đun P7 làm fail-closed trước khi server khởi động.
require('./p7-qr-token');
require('./p7-qr-security');

const serverPath = path.resolve(__dirname, 'server.js');
const publicApiPath = path.resolve(__dirname, 'public', 'api.js');
const p7ClientPath = path.resolve(__dirname, 'public', 'p7-qr-client.js');
const previousReadFileSync = fs.readFileSync.bind(fs);

function replaceRequired(source, label, before, after) {
  const first = source.indexOf(before);
  const second = first >= 0 ? source.indexOf(before, first + before.length) : -1;
  if (first < 0 || second >= 0) throw new Error(`[P7] Không thể áp dụng vá nguồn an toàn: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

fs.readFileSync = function qy4P7ReadFileSync(target, ...args) {
  const value = previousReadFileSync(target, ...args);
  const targetPath = typeof target === 'string' ? path.resolve(target) : '';

  // safe-start đang phục vụ /api.js bằng cách đọc file này tại runtime.
  // Nối lớp P7 ở cuối để không phải sửa hàng loạt trang HTML/call-site QR legacy.
  if (targetPath === publicApiPath && typeof value === 'string') {
    const client = previousReadFileSync(p7ClientPath, 'utf8');
    return `${value}\n\n;${client}\n`;
  }

  if (targetPath !== serverPath || typeof value !== 'string') return value;

  let source = value;

  // Guard QR public phải đứng trước các endpoint public tối thiểu do P2 đăng ký.
  // Giữ nguyên dòng express.json để safe-start vẫn chèn P2 đúng điểm neo.
  source = replaceRequired(
    source,
    'public signed QR guard',
    'app.use(express.json({ limit: "10mb" }));',
    'require("./p7-qr-security").attachPublicGuard({ app, Database, dbPath });\napp.use(express.json({ limit: "10mb" }));'
  );

  // Route phát hành token được đăng ký sau khi safe-start chèn p2Security ở phía trên.
  // Vì vậy request /api/qr/sign phải qua xác thực/phân quyền P2 trước khi tới route P7.
  source = replaceRequired(
    source,
    'authenticated QR signing route',
    'app.use(express.static(path.join(__dirname, "public")));',
    'require("./p7-qr-security").attachAuthenticatedRoutes({ app, Database, dbPath, isTech: p2Security.isTech });\napp.use(express.static(path.join(__dirname, "public")));'
  );

  // Bảo toàn token khi dùng URL ngắn /q/<device_code>?token=...
  source = replaceRequired(
    source,
    'signed QR short redirect',
    'app.get(["/q/:key", "/qr/:key", "/thiet-bi/:key"], (req, res) => {\n  const key = String(req.params.key || "").trim();\n  const encoded = encodeURIComponent(key);\n  if (/^\\d+$/.test(key)) return res.redirect(302, `/qr-check.html?id=${encoded}`);\n  return res.redirect(302, `/qr-check.html?code=${encoded}`);\n});',
    'app.get(["/q/:key", "/qr/:key", "/thiet-bi/:key"], (req, res) => {\n  const key = String(req.params.key || "").trim();\n  const encoded = encodeURIComponent(key);\n  const token = String(req.query.token || req.query.t || "").trim();\n  const signed = token ? `&token=${encodeURIComponent(token)}` : "";\n  if (/^\\d+$/.test(key)) return res.redirect(302, `/qr-check.html?id=${encoded}${signed}`);\n  return res.redirect(302, `/qr-check.html?code=${encoded}${signed}`);\n});'
  );

  // Không tin device_id trong multipart public: P7 guard đã xác minh token và gắn đúng ID thiết bị.
  source = replaceRequired(
    source,
    'bind public QR check to signed device',
    'app.post("/api/qr/checks", uploadIncidentMedia.array("media", 6), (req, res) => {\n  try {\n    const p = req.body || {};\n    const deviceId = Number(p.device_id || 0);',
    'app.post("/api/qr/checks", uploadIncidentMedia.array("media", 6), (req, res) => {\n  try {\n    const p = req.body || {};\n    const deviceId = Number(req.qy4QrDeviceId || 0);'
  );

  return source;
};

require('./p3-start');

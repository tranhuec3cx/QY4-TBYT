
const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const ExcelJS = require("exceljs");
const multer = require("multer");
const os = require("os");
const QRCode = require("qrcode");

// P8_CONSOLIDATED_RUNTIME: cấu hình và hardening chạy trực tiếp, không còn vá source khi runtime.
function loadRootEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach(line => {
    const s = String(line || "").trim();
    if (!s || s.startsWith("#")) return;
    const idx = s.indexOf("=");
    if (idx <= 0) return;
    const key = s.slice(0, idx).trim();
    let value = s.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  });
}
loadRootEnv();
if (process.argv.includes("--demo")) process.env.DEMO_MODE = "true";
fs.mkdirSync(path.join(__dirname, "db"), { recursive: true });

const app = express();
app.set("trust proxy", require("./proxy-config").trustProxySetting(process.env.TRUST_PROXY));
const PORT = process.env.PORT || 5000;
const QR_PUBLIC_BASE_URL = (process.env.QR_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
const dbPath = path.join(__dirname, "db", "qy4_ttbyt.sqlite");
const uploadsDir = path.join(__dirname, "uploads", "documents");
const qrUploadsDir = path.join(__dirname, "uploads", "qr");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(qrUploadsDir, { recursive: true });

require("./p7-qr-security").attachPublicGuard({ app, Database, dbPath });
app.use(express.json({ limit: "10mb" }));
// Với multipart, lớp auth chạy trước multer. Client gửi thêm device_id trong query;
// lớp này chỉ dùng query để kiểm tra sơ bộ, còn route sẽ kiểm tra lại body SAU multer.
app.use("/api/incidents", (req, _res, next) => {
  if (/^multipart\/form-data/i.test(String(req.headers["content-type"] || "")) && req.query?.device_id) {
    req.body = { ...(req.body || {}), device_id: String(req.query.device_id) };
  }
  next();
});
const p2Security = require("./p2-security").attach({
  app, express, Database, dbPath,
  publicDir: path.join(__dirname, "public"),
  uploadsDir, qrUploadsDir
});
require("./p2-scope-guard").attach({
  app, Database, dbPath,
  getUser: p2Security.getUser,
  isTech: p2Security.isTech
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
require("./p7-qr-security").attachAuthenticatedRoutes({ app, Database, dbPath, isTech: p2Security.isTech });
app.get("/api.js", (_req, res) => {
  const base = fs.readFileSync(path.join(__dirname, "public", "api.js"), "utf8");
  const p1 = fs.readFileSync(path.join(__dirname, "public", "p1-incident-repair.js"), "utf8");
  const p7 = fs.readFileSync(path.join(__dirname, "public", "p7-qr-client.js"), "utf8");
  res.type("application/javascript").send(base + "\n\n;" + p1 + "\n\n;" + p7 + "\n");
});
const p8PublicDir = path.join(__dirname, "public");
const p8DeviceDetailBase = path.join(p8PublicDir, "device-detail.js");
const p8DeviceDetailFix = path.join(p8PublicDir, "device-detail-p3-fix.js");
if (!fs.existsSync(p8DeviceDetailFix)) throw new Error("[P8] Thiếu public/device-detail-p3-fix.js; dừng để tránh hồ sơ thiết bị không đồng bộ.");
app.get("/device-detail.js", (_req, res) => {
  const base = fs.readFileSync(p8DeviceDetailBase, "utf8");
  const fix = fs.readFileSync(p8DeviceDetailFix, "utf8");
  res.type("application/javascript").send(base + "\n\n;" + fix + "\n");
});
app.use(express.static(p8PublicDir));
const p8ExcelDist = path.join(__dirname, "node_modules", "exceljs", "dist");
app.get("/vendor/xlsx.full.min.js", (_req, res) => {
  const bundlePath = path.join(p8ExcelDist, "exceljs.min.js");
  const compatPath = path.join(__dirname, "public", "xlsx-compat.js");
  if (!fs.existsSync(bundlePath) || !fs.existsSync(compatPath)) return res.status(500).send("Thiếu ExcelJS compatibility runtime.");
  const bundle = fs.readFileSync(bundlePath, "utf8");
  const compat = fs.readFileSync(compatPath, "utf8");
  res.type("application/javascript").send(bundle + "\n;" + compat + "\n");
});
app.use("/vendor", express.static(p8ExcelDist));
// P2: uploads/documents và uploads/qr được phục vụ qua p2-security với kiểm tra phiên/quyền.

function normalizeOriginUrl(value) {
  let v = String(value || "").trim().replace(/\/$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/$/, "");
}

function isLocalOnlyOrigin(origin) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./i.test(String(origin || ""));
}

function getRequestOrigin(req) {
  const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const xfHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const proto = xfProto || req.protocol || "http";
  const host = xfHost || req.get("host");
  return normalizeOriginUrl(`${proto}://${host}`);
}

function getLanQrOrigins(req) {
  const port = process.env.PORT || PORT || 5000;
  const origins = new Set();
  if (QR_PUBLIC_BASE_URL) origins.add(normalizeOriginUrl(QR_PUBLIC_BASE_URL));
  origins.add(getRequestOrigin(req));
  try {
    const nets = os.networkInterfaces();
    Object.values(nets).flat().filter(Boolean).forEach((net) => {
      if (net.family === "IPv4" && !net.internal) {
        origins.add(`http://${net.address}:${port}`);
      }
    });
  } catch (e) {}
  return Array.from(origins).filter(Boolean);
}


// Short QR routes for labels. Numeric values are treated as DB id; non-numeric values are treated as stable device_code.
// Example: /q/15 or /q/C7.CT.0001. This keeps QR usable after moving database/server.
app.get(["/q/:key", "/qr/:key", "/thiet-bi/:key"], (req, res) => {
  const key = String(req.params.key || "").trim();
  const encoded = encodeURIComponent(key);
  const token = String(req.query.token || req.query.t || "").trim();
  const signed = token ? `&token=${encodeURIComponent(token)}` : "";
  if (/^\d+$/.test(key)) return res.redirect(302, `/qr-check.html?id=${encoded}${signed}`);
  return res.redirect(302, `/qr-check.html?code=${encoded}${signed}`);
});

// Local QR PNG generator. Does not depend on external QR services, so demo works without Internet.
app.get("/api/qr/png", async (req, res) => {
  try {
    const data = String(req.query.data || "").trim();
    const size = Math.max(120, Math.min(800, Number(req.query.size || 280)));
    if (!data) return res.status(400).json({ error: "Thiếu dữ liệu QR." });
    const png = await QRCode.toBuffer(data, { type: "png", width: size, margin: 2, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/system/public-qr-check", (req, res) => {
  const base = normalizeOriginUrl(req.query.base || QR_PUBLIC_BASE_URL || getRequestOrigin(req));
  const localOnly = isLocalOnlyOrigin(base);
  const usesHttps = /^https:\/\//i.test(base);
  const missing = !base;
  let status = "ok";
  let message = "Địa chỉ có thể dùng để tạo QR công khai.";
  if (missing) { status = "missing"; message = "Chưa có địa chỉ công khai cho QR."; }
  else if (localOnly) { status = "local"; message = "Đây là địa chỉ nội bộ/localhost, điện thoại ngoài mạng sẽ không mở được."; }
  else if (!usesHttps) { status = "warning"; message = "Nên dùng HTTPS để điện thoại mở ổn định và an toàn hơn."; }
  res.json({ base, status, is_public_ready: Boolean(base && !localOnly), uses_https: usesHttps, message, sample_url: base ? `${base}/q/1` : "" });
});

app.get("/api/system/qr-origins", (req, res) => {
  const origins = getLanQrOrigins(req);
  const currentOrigin = getRequestOrigin(req);
  const configuredOrigin = normalizeOriginUrl(QR_PUBLIC_BASE_URL);
  const lanOrigins = origins.filter(x => /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(String(x || "")));
  const publicOrigin = origins.find(x => !isLocalOnlyOrigin(x));
  // Ưu tiên IP LAN/WiFi để điện thoại cùng WiFi quét QR được ngay.
  // Không dùng localhost làm QR vì điện thoại sẽ tự trỏ về chính điện thoại.
  const recommended = configuredOrigin || lanOrigins[0] || publicOrigin || currentOrigin || origins[0] || "";
  res.json({
    current_origin: currentOrigin,
    configured_public_origin: configuredOrigin,
    recommended_origin: recommended,
    lan_origin: lanOrigins[0] || "",
    lan_origins: lanOrigins,
    is_lan_ready: Boolean(lanOrigins[0]),
    is_public_ready: Boolean(configuredOrigin || (publicOrigin && !isLocalOnlyOrigin(publicOrigin))),
    note: configuredOrigin
      ? "QR đang dùng địa chỉ công khai từ QR_PUBLIC_BASE_URL/PUBLIC_BASE_URL."
      : (lanOrigins[0]
          ? "QR có thể dùng qua WiFi nội bộ. Điện thoại phải kết nối cùng WiFi với máy chủ."
          : "Chưa phát hiện IP LAN/WiFi. Hãy kiểm tra máy chủ đã kết nối WiFi/LAN và không dùng localhost để in QR."),
    origins
  });
});


const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
try { db.prepare('ALTER TABLE repairs ADD COLUMN processing_status TEXT DEFAULT "Đang xử lý"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN incident_id INTEGER').run(); } catch (e) {}
try { db.prepare('ALTER TABLE activity_history ADD COLUMN cost REAL DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE activity_history ADD COLUMN entry_type TEXT DEFAULT \"Cập nhật\"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN received_at TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN updated_at TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN completed_at TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN note TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN file_count INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE repairs ADD COLUMN file_names TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN local_resolution_note TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN reporter_phone TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN incident_code TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN device_code_snapshot TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN device_name_snapshot TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN department_snapshot TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN location_snapshot TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN created_at TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN updated_at TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE incidents ADD COLUMN updated_by TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE maintenances ADD COLUMN original_name TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE maintenances ADD COLUMN stored_name TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE maintenances ADD COLUMN file_path TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE maintenances ADD COLUMN file_mime TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE maintenances ADD COLUMN file_size INTEGER DEFAULT 0').run(); } catch (e) {}


// ===== QY4 V2.1 quick hardening: nghiệp vụ mở rộng, cảnh báo, nhật ký =====
function ensureColumn(table, column, definition) {
  try { db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run(); } catch (e) {}
}
function ensureSchemaV21() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_time TEXT NOT NULL,
      actor TEXT,
      module TEXT NOT NULL,
      record_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      unit TEXT,
      quantity INTEGER DEFAULT 0,
      min_quantity INTEGER DEFAULT 0,
      supplier TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      trans_date TEXT NOT NULL,
      trans_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      device_id INTEGER,
      repair_id INTEGER,
      actor TEXT,
      note TEXT,
      FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      from_department TEXT,
      to_department TEXT NOT NULL,
      transfer_date TEXT NOT NULL,
      handover_person TEXT,
      receiver TEXT,
      reason TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS liquidations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      liquidation_date TEXT NOT NULL,
      decision_no TEXT,
      council TEXT,
      residual_value INTEGER DEFAULT 0,
      reason TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);
  ensureColumn('devices', 'asset_code', 'TEXT');
  ensureColumn('devices', 'supplier', 'TEXT');
  ensureColumn('devices', 'last_maintenance_date', 'TEXT');
  ensureColumn('devices', 'next_maintenance_date', 'TEXT');
  ensureColumn('devices', 'last_inspection_date', 'TEXT');
  ensureColumn('devices', 'next_inspection_date', 'TEXT');
  ensureColumn('devices', 'downtime_hours', 'REAL DEFAULT 0');
}
ensureSchemaV21();
function logAudit(module, recordId, action, detail = '', actor = 'Quản trị viên') {
  try {
    db.prepare('INSERT INTO audit_logs (action_time,actor,module,record_id,action,detail) VALUES (?,?,?,?,?,?)')
      .run(nowSql(), actor || 'Quản trị viên', module, recordId || null, action, detail || '');
  } catch (e) {}
}
function dateOnly(v) { return v ? String(v).slice(0,10) : ''; }
function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.ceil((new Date(dateOnly(a)) - new Date(dateOnly(b))) / 86400000);
}
function buildOperationalAlerts(limit = 50) {
  const today = new Date().toISOString().slice(0,10);
  const plus30 = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
  const rows = [];
  const add = (type, level, title, content, link, due_date='') => rows.push({ type, level, title, content, link, due_date });
  db.prepare(`
    SELECT dv.id, COALESCE(dv.device_code, 'TB-'||dv.id) code, dv.name, MAX(m.next_date) due
    FROM devices dv LEFT JOIN maintenances m ON m.device_id=dv.id
    GROUP BY dv.id HAVING due IS NOT NULL AND due <= ?
    ORDER BY due ASC LIMIT ?
  `).all(plus30, limit).forEach(x => {
    const overdue = x.due < today;
    add('maintenance', overdue ? 'danger':'warning', `${overdue?'Quá hạn':'Sắp đến hạn'} bảo dưỡng`, `${x.code} - ${x.name}: hạn ${x.due}`, `/device-detail.html?id=${x.id}`, x.due);
  });
  db.prepare(`
    SELECT dv.id, COALESCE(dv.device_code, 'TB-'||dv.id) code, dv.name, MAX(i.next_date) due
    FROM devices dv LEFT JOIN inspections i ON i.device_id=dv.id
    GROUP BY dv.id HAVING due IS NOT NULL AND due <= ?
    ORDER BY due ASC LIMIT ?
  `).all(plus30, limit).forEach(x => {
    const overdue = x.due < today;
    add('inspection', overdue ? 'danger':'warning', `${overdue?'Quá hạn':'Sắp đến hạn'} kiểm định`, `${x.code} - ${x.name}: hạn ${x.due}`, `/device-detail.html?id=${x.id}`, x.due);
  });
  db.prepare(`
    SELECT id, COALESCE(device_code,'TB-'||id) code, name, warranty_end
    FROM devices WHERE warranty_end IS NOT NULL AND warranty_end != '' AND warranty_end <= ?
    ORDER BY warranty_end ASC LIMIT ?
  `).all(plus30, limit).forEach(x => {
    const overdue = x.warranty_end < today;
    add('warranty', overdue ? 'danger':'info', `${overdue?'Hết bảo hành':'Sắp hết bảo hành'}`, `${x.code} - ${x.name}: ${x.warranty_end}`, `/device-detail.html?id=${x.id}`, x.warranty_end);
  });
  db.prepare(`
    SELECT r.id, r.device_id, COALESCE(dv.device_code,'TB-'||dv.id) code, dv.name, r.repair_date, r.processing_status
    FROM repairs r JOIN devices dv ON dv.id=r.device_id
    WHERE COALESCE(r.processing_status,'Đang xử lý') NOT IN ('Đã hoàn thành','Không sửa được')
    ORDER BY r.repair_date ASC LIMIT ?
  `).all(limit).forEach(x => {
    const age = daysBetween(today, x.repair_date);
    if (age !== null && age >= 7) add('repair', age >= 15 ? 'danger':'warning', 'Phiếu sửa chữa quá hạn', `${x.code} - ${x.name}: ${age} ngày chưa đóng`, `/maintenance.html`, x.repair_date);
  });
  return rows.sort((a,b)=> String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0, limit);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}`);
  }
});
const uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allow = [".pdf",".doc",".docx",".xls",".xlsx",".jpg",".jpeg",".png",".zip"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allow.includes(ext)) return cb(new Error("Định dạng file không được hỗ trợ."));
    cb(null, true);
  }
});
const qrStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, qrUploadsDir),
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname || "qr-file").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}`);
  }
});
const uploadQrFile = multer({
  storage: qrStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allow = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allow.includes(ext)) return cb(new Error("Chỉ hỗ trợ JPG, PNG, WEBP, MP4 hoặc MOV."));
    cb(null, true);
  }
});
const uploadIncidentMedia = multer({
  storage: qrStorage,
  limits: { fileSize: 30 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const allow = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allow.includes(ext)) return cb(new Error("Chỉ hỗ trợ ảnh JPG/PNG/WEBP và video MP4/MOV."));
    cb(null, true);
  }
});
const INCIDENT_STATUSES = ["Mới ghi nhận","Đã chuyển sửa chữa","Đã xử lý tại chỗ"];
const REPAIR_STATUSES = ["Đang xử lý","Chờ linh kiện","Đã hoàn thành","Không sửa được"];
function normalizeRepairStatus(status) {
  const raw = String(status || "").trim();
  if (["Đang xử lý","Đang kiểm tra","Đang sửa chữa","Mới tiếp nhận"].includes(raw)) return "Đang xử lý";
  if (raw === "Chờ linh kiện") return "Chờ linh kiện";
  if (["Chuyển hãng/Bảo hành", "Chuyển hãng", "Bảo hành", "Gửi hãng"].includes(raw)) return "Chuyển hãng/Bảo hành";
  if (["Đã sửa xong","Bàn giao sử dụng","Đã hoàn thành","Hoàn thành"].includes(raw)) return "Đã hoàn thành";
  if (["Không sửa được","Không thể sửa"].includes(raw)) return "Không sửa được";
  if (["Hủy","Huỷ","Đã hủy","Đã huỷ"].includes(raw)) return "Đã hủy";
  return "Đang xử lý";
}
function statusAfterFromRepairStatus(processingStatus, fallback = "Đang hoạt động") {
  const st = normalizeRepairStatus(processingStatus);
  if (st === "Đã hoàn thành") return "Đang hoạt động";
  if (st === "Không sửa được") return "Ngừng hoạt động";
  if (st === "Đã hủy") return fallback || "Chờ sửa chữa";
  if (st === "Đang xử lý" || st === "Chờ linh kiện" || st === "Chuyển hãng/Bảo hành") return "Chờ sửa chữa";
  return fallback || "Đang hoạt động";
}
function normalizeDateTime(value) {
  if (!value) return "";
  let v = String(value).trim().replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += " 00:00:00";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) v += ":00";
  return v;
}
function requireFields(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === "");
  return missing;
}
function sanitizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function normalizeIncidentStatusForUi(status, linkedRepairId) {
  const raw = String(status || "").trim();
  if (raw === "Đã chuyển sửa chữa" || raw === "Chuyển sửa chữa" || raw === "Chờ linh kiện") return "Đã chuyển sửa chữa";
  if (raw === "Đã xử lý tại chỗ" || raw === "Đã xử lý" || raw === "Đóng" || raw === "Không cần sửa chữa") return "Đã xử lý tại chỗ";
  if (raw === "Mới ghi nhận" || raw === "Đã ghi nhận" || raw === "Đang xử lý" || raw === "Theo dõi") return "Mới ghi nhận";
  if (REPAIR_STATUSES.includes(raw) || ["Đang kiểm tra","Đã sửa xong","Bàn giao sử dụng","Hủy","Đã hoàn thành"].includes(raw)) return linkedRepairId ? "Đã chuyển sửa chữa" : "Mới ghi nhận";
  return linkedRepairId ? "Đã chuyển sửa chữa" : "Mới ghi nhận";
}
function normalizeIncidentPayloadStatus(requestedStatus, oldStatus, linkedRepairId) {
  const normalized = normalizeIncidentStatusForUi(requestedStatus || oldStatus, linkedRepairId);
  // Trạng thái “Đã chuyển sửa chữa” chỉ do endpoint chuyển sửa chữa sinh ra.
  if (normalized === "Đã chuyển sửa chữa" && !linkedRepairId) return "Mới ghi nhận";
  return normalized === "Đã chuyển sửa chữa" ? "Đã chuyển sửa chữa" : normalized;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function nowSql() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeIncidentCode(id, incidentDate = nowSql()) {
  const d = normalizeDateTime(incidentDate || nowSql()).slice(0, 10).replace(/-/g, "");
  return `SC-${d}-${String(id).padStart(4, "0")}`;
}

function buildIncidentSnapshot(deviceId) {
  const dv = db.prepare(`
    SELECT dv.*, d.name AS department_name
    FROM devices dv
    LEFT JOIN departments d ON d.code = dv.department_code
    WHERE dv.id=?
  `).get(deviceId);
  if (!dv) return null;
  return {
    device_code_snapshot: getDeviceCode(deviceId),
    device_name_snapshot: dv.name || "",
    department_snapshot: dv.department_name || dv.department_code || "",
    location_snapshot: dv.location || ""
  };
}

function completeIncidentRow(id, deviceId, actor = "", incidentDate = nowSql()) {
  const snap = buildIncidentSnapshot(deviceId) || {
    device_code_snapshot: "",
    device_name_snapshot: "",
    department_snapshot: "",
    location_snapshot: ""
  };
  const t = nowSql();
  db.prepare(`
    UPDATE incidents
    SET incident_code = COALESCE(NULLIF(incident_code,''), @incident_code),
        device_code_snapshot = @device_code_snapshot,
        device_name_snapshot = @device_name_snapshot,
        department_snapshot = @department_snapshot,
        location_snapshot = @location_snapshot,
        created_at = COALESCE(NULLIF(created_at,''), @created_at),
        updated_at = @updated_at,
        updated_by = @updated_by
    WHERE id = @id
  `).run({
    id,
    incident_code: makeIncidentCode(id, incidentDate),
    created_at: t,
    updated_at: t,
    updated_by: actor || "",
    ...snap
  });
}

function touchIncident(id, deviceId, actor = "") {
  const snap = buildIncidentSnapshot(deviceId) || {};
  db.prepare(`
    UPDATE incidents
    SET device_code_snapshot = COALESCE(@device_code_snapshot, device_code_snapshot),
        device_name_snapshot = COALESCE(@device_name_snapshot, device_name_snapshot),
        department_snapshot = COALESCE(@department_snapshot, department_snapshot),
        location_snapshot = COALESCE(@location_snapshot, location_snapshot),
        updated_at = @updated_at,
        updated_by = @updated_by
    WHERE id = @id
  `).run({ id, updated_at: nowSql(), updated_by: actor || "", ...snap });
}

function writeHistory(module, recordId, actor, actionType, oldStatus = "", newStatus = "", note = "", cost = 0, entryType = "Cập nhật", actionTime = "") {
  const at = normalizeDateTime(actionTime || nowSql()) || nowSql();
  db.prepare(`
    INSERT INTO activity_history (module, record_id, action_time, actor, action_type, old_status, new_status, note, cost, entry_type)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(module, recordId, at, actor || "", actionType, oldStatus || "", newStatus || "", note || "", Number(cost || 0), entryType || "Cập nhật");
}


function refreshDemoTodayData() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const t1 = `${today} 08:15`;
  const t2 = `${today} 09:10`;
  const t3 = `${today} 10:20`;
  try {
    const checkIds = db.prepare("SELECT id FROM daily_checks ORDER BY id LIMIT 2").all().map(x => x.id);
    checkIds.forEach((id, idx) => db.prepare("UPDATE daily_checks SET check_datetime=? WHERE id=?").run(idx === 0 ? t1 : t2, id));

    const incidentIds = db.prepare("SELECT id FROM incidents ORDER BY id LIMIT 2").all().map(x => x.id);
    incidentIds.forEach((id, idx) => db.prepare("UPDATE incidents SET incident_datetime=? WHERE id=?").run(idx === 0 ? t2 : t3, id));

    const repairIds = db.prepare("SELECT id FROM repairs ORDER BY id LIMIT 2").all().map(x => x.id);
    repairIds.forEach(id => db.prepare("UPDATE repairs SET repair_date=? WHERE id=?").run(today, id));

    const countChecksToday = db.prepare("SELECT COUNT(*) c FROM daily_checks WHERE substr(check_datetime,1,10)=?").get(today).c;
    if (!countChecksToday) {
      const d1 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1").get();
      const d2 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 1").get();
      if (d1) db.prepare(`INSERT INTO daily_checks (device_id,check_datetime,inspector,content,result,note) VALUES (?,?,?,?,?,?)`).run(d1.id,t1,"Khoa Trang bị","Kiểm tra đầu ngày","Đạt","Dữ liệu demo");
      if (d2) db.prepare(`INSERT INTO daily_checks (device_id,check_datetime,inspector,content,result,note) VALUES (?,?,?,?,?,?)`).run(d2.id,t2,"Khoa Trang bị","Kiểm tra đầu ngày","Đạt có lưu ý","Dữ liệu demo");
    }

    const countIncToday = db.prepare("SELECT COUNT(*) c FROM incidents WHERE substr(incident_datetime,1,10)=?").get(today).c;
    if (!countIncToday) {
      const d1 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 2").get() || db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1").get();
      const d2 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 3").get() || db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 1").get();
      if (d1) db.prepare(`INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,status,note) VALUES (?,?,?,?,?,?,?)`).run(d1.id,t2,"Sự cố demo trong ngày","Trung bình","Khoa Trang bị","Mới ghi nhận","Tạo tự động để demo");
      if (d2) db.prepare(`INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,status,note) VALUES (?,?,?,?,?,?,?)`).run(d2.id,t3,"Cảnh báo demo trong ngày","Thấp","Khoa Trang bị","Mới ghi nhận","Tạo tự động để demo");
    }

    const countRepairsToday = db.prepare("SELECT COUNT(*) c FROM repairs WHERE repair_date=?").get(today).c;
    if (!countRepairsToday) {
      const d1 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 4").get() || db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1").get();
      const d2 = db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 5").get() || db.prepare("SELECT id FROM devices ORDER BY id LIMIT 1 OFFSET 1").get();
      if (d1) db.prepare(`INSERT INTO repairs (device_id,repair_date,issue,work,person,method,cost,result,status_after,processing_status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(d1.id,today,"Lỗi demo trong ngày","Tiếp nhận xử lý","Khoa Trang bị","Nội bộ",0,"Đang theo dõi","Đang hoạt động","Đang xử lý");
      if (d2) db.prepare(`INSERT INTO repairs (device_id,repair_date,issue,work,person,method,cost,result,status_after,processing_status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(d2.id,today,"Lỗi demo trong ngày","Đang chờ linh kiện","Khoa Trang bị","Nội bộ",0,"Chờ linh kiện","Chờ sửa chữa","Chờ linh kiện");
    }
  } catch (e) {}
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_groups (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      department_code TEXT,
      status TEXT NOT NULL,
      phone TEXT,
      FOREIGN KEY (department_code) REFERENCES departments(code)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_code TEXT NOT NULL,
      group_code TEXT NOT NULL,
      name TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      year_in_use INTEGER,
      warranty_end TEXT,
      status TEXT,
      quality_level INTEGER DEFAULT 3,
      serial TEXT,
      country TEXT,
      year_manufactured INTEGER,
      cost INTEGER DEFAULT 0,
      funding TEXT,
      location TEXT,
      note TEXT,
      device_code TEXT,
      insurance_code TEXT,
      FOREIGN KEY (department_code) REFERENCES departments(code),
      FOREIGN KEY (group_code) REFERENCES device_groups(code)
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      maker_country TEXT,
      serial TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      repair_date TEXT,
      issue TEXT,
      work TEXT,
      person TEXT,
      method TEXT,
      cost INTEGER DEFAULT 0,
      result TEXT,
      status_after TEXT,
      processing_status TEXT DEFAULT "Đang xử lý",
      incident_id INTEGER,
      received_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      note TEXT,
      file_count INTEGER DEFAULT 0,
      file_names TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS maintenances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      maintenance_date TEXT,
      type TEXT,
      content TEXT,
      result TEXT,
      performer TEXT,
      user_confirm TEXT,
      vendor TEXT,
      next_date TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      log_datetime TEXT,
      user_name TEXT,
      department_code TEXT,
      usage_count TEXT,
      status_before TEXT,
      status_after TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      doc_date TEXT,
      updated_by TEXT,
      note TEXT,
      original_name TEXT,
      stored_name TEXT,
      file_path TEXT,
      file_mime TEXT,
      file_size INTEGER DEFAULT 0,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      check_datetime TEXT NOT NULL,
      inspector TEXT NOT NULL,
      content TEXT NOT NULL,
      result TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      incident_datetime TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      reporter TEXT NOT NULL,
      reporter_phone TEXT,
      status TEXT NOT NULL,
      note TEXT,
      local_resolution_note TEXT,
      incident_code TEXT,
      device_code_snapshot TEXT,
      device_name_snapshot TEXT,
      department_snapshot TEXT,
      location_snapshot TEXT,
      created_at TEXT,
      updated_at TEXT,
      updated_by TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incident_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      original_name TEXT,
      stored_name TEXT,
      file_path TEXT,
      file_mime TEXT,
      file_size INTEGER DEFAULT 0,
      uploaded_at TEXT,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action_time TEXT NOT NULL,
      actor TEXT,
      action_type TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      note TEXT,
      cost REAL DEFAULT 0,
      entry_type TEXT DEFAULT 'Cập nhật'
    );
  `);

  try {
    const incidentRowsNeedCode = db.prepare(`
      SELECT id, device_id, incident_datetime, reporter
      FROM incidents
      WHERE incident_code IS NULL OR incident_code='' OR created_at IS NULL OR created_at=''
         OR device_code_snapshot IS NULL OR device_code_snapshot=''
    `).all();
    for (const r of incidentRowsNeedCode) {
      completeIncidentRow(r.id, r.device_id, r.reporter || "Hệ thống", r.incident_datetime || nowSql());
    }
  } catch (e) {}

  const maintCols = db.prepare("PRAGMA table_info(maintenances)").all().map(x => x.name);
  if (!maintCols.includes("original_name")) db.exec("ALTER TABLE maintenances ADD COLUMN original_name TEXT");
  if (!maintCols.includes("stored_name")) db.exec("ALTER TABLE maintenances ADD COLUMN stored_name TEXT");
  if (!maintCols.includes("file_path")) db.exec("ALTER TABLE maintenances ADD COLUMN file_path TEXT");
  if (!maintCols.includes("file_mime")) db.exec("ALTER TABLE maintenances ADD COLUMN file_mime TEXT");
  if (!maintCols.includes("file_size")) db.exec("ALTER TABLE maintenances ADD COLUMN file_size INTEGER DEFAULT 0");

  const docCols = db.prepare("PRAGMA table_info(documents)").all().map(x => x.name);
  if (!docCols.includes("original_name")) db.exec("ALTER TABLE documents ADD COLUMN original_name TEXT");
  if (!docCols.includes("stored_name")) db.exec("ALTER TABLE documents ADD COLUMN stored_name TEXT");
  if (!docCols.includes("file_path")) db.exec("ALTER TABLE documents ADD COLUMN file_path TEXT");
  if (!docCols.includes("file_mime")) db.exec("ALTER TABLE documents ADD COLUMN file_mime TEXT");
  if (!docCols.includes("file_size")) db.exec("ALTER TABLE documents ADD COLUMN file_size INTEGER DEFAULT 0");

  const maintenanceColsP3 = db.prepare("PRAGMA table_info(maintenances)").all().map(x => x.name);
  if (!maintenanceColsP3.includes("cancelled_at")) db.exec("ALTER TABLE maintenances ADD COLUMN cancelled_at TEXT");
  if (!maintenanceColsP3.includes("cancel_reason")) db.exec("ALTER TABLE maintenances ADD COLUMN cancel_reason TEXT");

  const deptCount = db.prepare("SELECT COUNT(*) AS c FROM departments").get().c;
  if (deptCount === 0) seedData();
}

function seedData() {
  const departments = [
    ["A1","A1 - Khoa Quốc tế"],["A10","A10 - Khoa Y học cổ truyền"],["A12","A12 - Khoa Hồi sức tích cực - Chống độc"],
    ["A15","A15 - Khoa Nội thận - Lọc máu"],["A2","A2 - Khoa Nội tim mạch - Hô hấp"],["A3","A3 - Khoa Nội tiêu hóa - Huyết học lâm sàng"],
    ["A4","A4 - Khoa Truyền nhiễm - Da liễu - Dị ứng"],["A6","A6 - Khoa Ung bướu"],["A7","A7 - Khoa Thần kinh - Tâm thần"],
    ["A8","A8 - Khoa Đột quỵ"],["A9","A9 - Khoa Phục hồi chức năng"],["B1","B1 - Khoa Chấn thương chỉnh hình"],
    ["B10","B10 - Khoa Phụ sản - Nhi"],["B11","B11 - Khoa Răng - Hàm - Mặt"],["B3","B3 - Khoa Ngoại tổng hợp"],
    ["B5","B5 - Khoa Gây mê hồi sức"],["B7","B7 - Khoa Mắt"],["B9","B9 - Khoa Tai - Mũi - Họng"],
    ["C1","C1 - Khoa Khám bệnh"],["C15","C15 - Khoa Cấp cứu"],["C2","C2 - Khoa Xét nghiệm - Giải phẫu bệnh"],
    ["C7","C7 - Khoa Chẩn đoán hình ảnh - Chẩn đoán chức năng"],["C10","C10 - Khoa Trang bị"]
  ];
  const groups = [
    ["XQ","Xquang"],["CT","CT"],["MRI","MRI"],["SP","SPECT"],["SA","Siêu âm"],["MON","Monitor"],
    ["DT","Điện tim"],["MTH","Máy thở"],["MT","Máy thận"],["XN","Xét nghiệm"],["HH","Huyết học"],
    ["MD","Miễn dịch"],["SH","Sinh hóa"],["DM","Đông máu"],["KHV","Kính hiển vi"],["K","Khác"]
  ];
  const users = [
    ["Nguyễn Văn Admin","admin","Quản trị viên","C10","Hoạt động","0988000001"],
    ["Tổ Kỹ thuật TTBYT","kythuat01","Kỹ thuật TTBYT","C10","Hoạt động","0988000002"],
    ["Hoàng Thị Lan","cdha01","Người dùng khoa","C7","Hoạt động","0988000003"],
    ["Phạm Đức Hùng","hstc01","Người dùng khoa","A12","Hoạt động","0988000004"],
    ["Lê Thị Mai","xetnghiem01","Người dùng khoa","C2","Hoạt động","0988000005"]
  ];
  const insertDept = db.prepare("INSERT INTO departments (code,name) VALUES (?,?)");
  const insertGroup = db.prepare("INSERT INTO device_groups (code,name) VALUES (?,?)");
  const insertUser = db.prepare("INSERT INTO users (full_name,username,role,department_code,status,phone) VALUES (?,?,?,?,?,?)");
  departments.forEach(r => insertDept.run(...r));
  groups.forEach(r => insertGroup.run(...r));
  const initialUsers = process.env.DEMO_MODE === "true" ? users : users.filter(r => r[1] === "admin");
  initialUsers.forEach(r => insertUser.run(...r));
  if (process.env.DEMO_MODE !== "true") return;

  const insertDevice = db.prepare(`
    INSERT INTO devices (department_code,group_code,name,manufacturer,model,year_in_use,warranty_end,status,quality_level,serial,country,year_manufactured,cost,funding,location,note,device_code,insurance_code)
    VALUES (@department_code,@group_code,@name,@manufacturer,@model,@year_in_use,@warranty_end,@status,@quality_level,@serial,@country,@year_manufactured,@cost,@funding,@location,@note,@device_code,@insurance_code)
  `);
  const insertAccessory = db.prepare("INSERT INTO accessories (device_id,name,code,maker_country,serial,note) VALUES (?,?,?,?,?,?)");
  const insertRepair = db.prepare("INSERT INTO repairs (device_id,repair_date,issue,work,person,method,cost,result,status_after,processing_status) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const insertMaintenance = db.prepare("INSERT INTO maintenances (device_id,maintenance_date,type,content,result,performer,user_confirm,vendor,next_date,note) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const insertOperation = db.prepare("INSERT INTO operation_logs (device_id,log_datetime,user_name,department_code,usage_count,status_before,status_after,note) VALUES (?,?,?,?,?,?,?,?)");
  const insertDocument = db.prepare("INSERT INTO documents (device_id,name,type,doc_date,updated_by,note) VALUES (?,?,?,?,?,?)");
  const insertCheck = db.prepare("INSERT INTO daily_checks (device_id,check_datetime,inspector,content,result,note) VALUES (?,?,?,?,?,?)");
  const insertIncident = db.prepare("INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,status,note) VALUES (?,?,?,?,?,?,?)");

  const devices = [
    { department_code:"C1",group_code:"DT",name:"Máy điện tim 12 chuyển đạo",manufacturer:"Nihon Kohden",model:"Cardiofax G ECG-2350",year_in_use:2020,warranty_end:"2025-05-15",status:"Đang hoạt động",serial:"ECG2350-C1-001",country:"Nhật Bản",year_manufactured:2019,cost:185000000,funding:"Ngân sách Quốc phòng",location:"Phòng khám tim mạch",note:"Máy sử dụng thường xuyên tại phòng khám tim mạch.",
      accessories:[["Dây điện tim 10 cực","ECG-CABLE","Nihon Kohden - Nhật Bản","CB-001","Đầy đủ"],["Bộ kẹp điện cực","CLAMP","Nihon Kohden - Nhật Bản","CL-001","Tốt"]],
      repairs:[["2026-02-12","In nhiệt kém","Thay giấy in và vệ sinh đầu in","Nguyễn Văn A","Nội bộ",0,"Hoạt động tốt","Đang hoạt động"]],
      maints:[["2026-03-05","Bảo dưỡng định kỳ","Kiểm tra dây nguồn, điện cực và độ ổn định tín hiệu","Đạt","Tổ TTBYT","Khoa Khám bệnh","Nội bộ","2026-09-05","Máy ổn định"]],
      logs:[["2026-04-10 08:20","Điều dưỡng Lan","C1","18 ca","Bình thường","Bình thường",""]],
      docs:[["Biên bản bàn giao máy ECG","Biên bản bàn giao","2020-02-10","Khoa Trang bị","Bản scan PDF"]]
    },
    { department_code:"C7",group_code:"CT",name:"Máy CT Scanner 64 lát",manufacturer:"Canon Medical",model:"Aquilion Prime SP",year_in_use:2022,warranty_end:"2027-12-31",status:"Đang hoạt động",serial:"CT64002",country:"Nhật Bản",year_manufactured:2021,cost:16500000000,funding:"Ngân sách Nhà nước",location:"Phòng CT",note:"Máy chính phục vụ chẩn đoán hình ảnh toàn viện.",
      accessories:[["Bàn bệnh nhân","CT-TABLE","Canon Medical - Nhật Bản","CT-64002-TB","Tốt"],["Bộ xử lý ảnh","CT-WKS","Canon Medical - Nhật Bản","CT-64002-WKS","Tốt"]],
      repairs:[["2026-04-03","Quạt làm mát phát tiếng ồn","Vệ sinh quạt và căn chỉnh cụm giá đỡ","Nguyễn Văn B","Nội bộ",0,"Theo dõi thêm","Đang hoạt động"]],
      maints:[["2026-04-02","Kiểm tra chất lượng","Kiểm tra quạt làm mát, nhiệt độ hệ thống, độ ổn định nguồn","Đạt có lưu ý","Nguyễn Hữu Hoàng","Khoa CĐHA","Nội bộ","2026-05-02","Theo dõi thêm tiếng ồn và nhiệt độ quạt"]],
      logs:[["2026-04-11 09:00","KTV Hùng","C7","32 ca","Bình thường","Có lưu ý","Tiếng quạt hơi lớn"]],
      docs:[["Hướng dẫn sử dụng CT 64 lát","Hướng dẫn sử dụng","2022-01-05","Canon Medical","Bản mềm PDF"]]
    },
    { department_code:"C7",group_code:"MRI",name:"Hệ thống MRI 1.5T",manufacturer:"GE Healthcare",model:"SIGNA Creator",year_in_use:2022,warranty_end:"2027-10-20",status:"Đang hoạt động",serial:"MRI15T-C7-001",country:"Mỹ",year_manufactured:2021,cost:23800000000,funding:"Ngân sách Nhà nước",location:"Phòng MRI",note:"Máy chụp cộng hưởng từ 1.5T.",
      accessories:[["Cuộn thu đầu","HEAD-COIL","GE Healthcare - Mỹ","HC-115A","Tốt"],["Cuộn thu cột sống","SPINE-COIL","GE Healthcare - Mỹ","SC-220B","Tốt"]],
      repairs:[],
      maints:[["2026-03-18","Bảo dưỡng định kỳ","Kiểm tra cryogen, hệ thống lạnh, độ ổn định gradient","Đạt","GE Service","Khoa CĐHA","GE Healthcare","2026-09-18","Hệ thống ổn định"]],
      logs:[["2026-04-11 14:10","KTV Tú","C7","12 ca","Bình thường","Bình thường",""]],
      docs:[]
    },
    { department_code:"A12",group_code:"MON",name:"Monitor theo dõi bệnh nhân 5 thông số",manufacturer:"Mindray",model:"iPM 10",year_in_use:2022,warranty_end:"2026-09-30",status:"Đang hoạt động",serial:"MON-A12-001",country:"Trung Quốc",year_manufactured:2021,cost:58000000,funding:"Ngân sách Quốc phòng",location:"Buồng HSTC 1",note:"Monitor giường hồi sức.",accessories:[],repairs:[],maints:[["2026-01-15","Kiểm tra an toàn điện","Đo rò điện và kiểm tra pin","Đạt","Tổ TTBYT","A12","Nội bộ","2027-01-15",""]],logs:[],docs:[] },
    { department_code:"A12",group_code:"MTH",name:"Máy thở chức năng cao",manufacturer:"Dräger",model:"Evita V500",year_in_use:2021,warranty_end:"2026-08-31",status:"Đang hoạt động",serial:"VENT-A12-001",country:"Đức",year_manufactured:2020,cost:980000000,funding:"Nguồn viện trợ",location:"Buồng HSTC 2",note:"Máy thở hồi sức xâm nhập/không xâm nhập.",accessories:[["Bình làm ẩm","HUM-01","Dräger - Đức","HM-091","Tốt"]],repairs:[],maints:[["2026-02-20","Bảo dưỡng định kỳ","Thay lọc khí, kiểm tra cảm biến lưu lượng","Đạt","Dräger Service","A12","Dräger","2026-08-20",""]],logs:[],docs:[] },
    { department_code:"A15",group_code:"MT",name:"Máy thận nhân tạo",manufacturer:"Fresenius",model:"4008S",year_in_use:2021,warranty_end:"2026-11-30",status:"Đang hoạt động",serial:"HD-A15-001",country:"Đức",year_manufactured:2020,cost:420000000,funding:"Nguồn dịch vụ",location:"Đơn nguyên lọc máu 1",note:"Máy chạy thận nhân tạo thường quy.",accessories:[["Bộ kẹp đường máu","CLAMP-HD","Fresenius - Đức","CL-789","Tốt"]],repairs:[],maints:[["2026-03-10","Kiểm tra chất lượng","Kiểm tra bơm dịch và cảm biến áp lực","Đạt","Fresenius VN","A15","Fresenius","2026-09-10",""]],logs:[],docs:[] },
    { department_code:"C2",group_code:"SH",name:"Máy xét nghiệm sinh hóa tự động",manufacturer:"Beckman Coulter",model:"AU5800",year_in_use:2021,warranty_end:"2026-12-31",status:"Đang hoạt động",serial:"SH-C2-001",country:"Mỹ",year_manufactured:2020,cost:2100000000,funding:"Ngân sách Nhà nước",location:"Phòng sinh hóa",note:"Máy sinh hóa công suất lớn.",accessories:[["Bộ trộn mẫu","MIXER","Beckman - Mỹ","MX-09","Tốt"]],repairs:[],maints:[["2026-03-28","Bảo dưỡng định kỳ","Vệ sinh hệ thống hút mẫu, calibrate quang học","Đạt","Hãng","C2","Beckman","2026-09-28",""]],logs:[],docs:[] },
    { department_code:"C2",group_code:"HH",name:"Máy xét nghiệm huyết học 5 thành phần",manufacturer:"Sysmex",model:"XN-1000",year_in_use:2020,warranty_end:"2025-08-15",status:"Hoạt động hạn chế",serial:"HH-C2-001",country:"Nhật Bản",year_manufactured:2019,cost:890000000,funding:"Ngân sách Nhà nước",location:"Phòng huyết học",note:"Thỉnh thoảng báo lỗi hút mẫu.",accessories:[["Module hút mẫu","SAMPLER","Sysmex - Nhật Bản","SM-33","Mới ghi nhận"]],repairs:[["2026-03-30","Báo lỗi hút mẫu","Kiểm tra bơm và thay ống mềm","KTV Trang bị","Nội bộ",1200000,"Đã khắc phục tạm thời","Hoạt động hạn chế"]],maints:[],logs:[],docs:[] },
    { department_code:"C2",group_code:"MD",name:"Máy xét nghiệm miễn dịch tự động",manufacturer:"Roche",model:"Cobas e 411",year_in_use:2022,warranty_end:"2027-03-20",status:"Đang hoạt động",serial:"MD-C2-001",country:"Thụy Sĩ",year_manufactured:2021,cost:1380000000,funding:"Ngân sách Nhà nước",location:"Phòng miễn dịch",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C2",group_code:"DM",name:"Máy xét nghiệm đông máu tự động",manufacturer:"Stago",model:"STA Compact Max",year_in_use:2023,warranty_end:"2028-01-15",status:"Đang hoạt động",serial:"DM-C2-001",country:"Pháp",year_manufactured:2022,cost:760000000,funding:"Ngân sách Nhà nước",location:"Phòng đông máu",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C2",group_code:"KHV",name:"Kính hiển vi 2 mắt điện",manufacturer:"Olympus",model:"CX23",year_in_use:2019,warranty_end:"2024-12-31",status:"Đang hoạt động",serial:"MIC-C2-001",country:"Nhật Bản",year_manufactured:2018,cost:32000000,funding:"Ngân sách Quốc phòng",location:"Phòng GPB",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C7",group_code:"XQ",name:"Máy Xquang kỹ thuật số cố định",manufacturer:"Shimadzu",model:"RADspeed Pro",year_in_use:2021,warranty_end:"2026-10-15",status:"Đang hoạt động",serial:"XQ-C7-001",country:"Nhật Bản",year_manufactured:2020,cost:4300000000,funding:"Ngân sách Nhà nước",location:"Phòng Xquang 1",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C7",group_code:"SA",name:"Máy siêu âm màu tổng quát 4D",manufacturer:"GE",model:"Voluson E10",year_in_use:2021,warranty_end:"2026-07-15",status:"Đang hoạt động",serial:"SA-C7-001",country:"Áo",year_manufactured:2020,cost:2850000000,funding:"Nguồn dịch vụ",location:"Phòng siêu âm",note:"",accessories:[["Đầu dò Convex","C1-5","GE - Áo","CVX-00321","Đầy đủ"],["Đầu dò Linear","L3-12","GE - Áo","LIN-00892","Đầy đủ"]],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C7",group_code:"SP",name:"Hệ thống máy chụp xạ hình SPECT",manufacturer:"Siemens",model:"Symbia Evo",year_in_use:2023,warranty_end:"2028-02-28",status:"Đang hoạt động",serial:"SP-C7-001",country:"Đức",year_manufactured:2022,cost:19800000000,funding:"Ngân sách Nhà nước",location:"Phòng y học hạt nhân",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"A2",group_code:"DT",name:"Hệ thống Holter điện tim/Huyết áp",manufacturer:"GE",model:"SEER 1000",year_in_use:2022,warranty_end:"2027-09-01",status:"Đang hoạt động",serial:"DT-A2-001",country:"Mỹ",year_manufactured:2021,cost:240000000,funding:"Ngân sách Quốc phòng",location:"Phòng chẩn đoán chức năng tim mạch",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"B9",group_code:"K",name:"Hệ thống nội soi khám Tai Mũi Họng",manufacturer:"Karl Storz",model:"ENT Complete",year_in_use:2021,warranty_end:"2026-06-30",status:"Đang hoạt động",serial:"ENT-B9-001",country:"Đức",year_manufactured:2020,cost:960000000,funding:"Nguồn dịch vụ",location:"Phòng nội soi TMH",note:"Tạm xếp nhóm Khác để hiển thị ngoài bảng.",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"B7",group_code:"K",name:"Kính hiển vi khám mắt đèn khe",manufacturer:"Topcon",model:"SL-D701",year_in_use:2020,warranty_end:"2025-12-31",status:"Đang hoạt động",serial:"MAT-B7-001",country:"Nhật Bản",year_manufactured:2019,cost:165000000,funding:"Ngân sách Quốc phòng",location:"Phòng khám mắt",note:"Xếp nhóm Khác do danh sách nhóm ngoài bảng được giữ gọn.",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"B11",group_code:"XQ",name:"Máy Xquang răng kỹ thuật số",manufacturer:"Vatech",model:"EzRay Air",year_in_use:2023,warranty_end:"2028-03-12",status:"Đang hoạt động",serial:"XQ-B11-001",country:"Hàn Quốc",year_manufactured:2022,cost:198000000,funding:"Nguồn dịch vụ",location:"Phòng RHM",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"B3",group_code:"MON",name:"Monitor theo dõi bệnh nhân 7 thông số",manufacturer:"Philips",model:"IntelliVue MX550",year_in_use:2022,warranty_end:"2027-04-22",status:"Đang hoạt động",serial:"MON-B3-001",country:"Mỹ",year_manufactured:2021,cost:128000000,funding:"Ngân sách Quốc phòng",location:"Hậu phẫu Ngoại",note:"",accessories:[],repairs:[],maints:[],logs:[],docs:[] },
    { department_code:"C15",group_code:"MTH",name:"Máy thở dã chiến",manufacturer:"Aeonmed",model:"VG70",year_in_use:2020,warranty_end:"2025-10-10",status:"Chờ sửa chữa",serial:"VENT-C15-001",country:"Trung Quốc",year_manufactured:2019,cost:325000000,funding:"Nguồn viện trợ",location:"Kho cấp cứu",note:"Đang chờ thay cảm biến oxy.",accessories:[],repairs:[["2026-04-08","Sai lệch chỉ số oxy","Đặt hàng cảm biến thay thế","Tổ TTBYT","Nội bộ",2500000,"Chờ linh kiện","Chờ sửa chữa"]],maints:[],logs:[],docs:[] }
  ];

  const tx = db.transaction(() => {
    devices.forEach(device => {
      const info = insertDevice.run({ quality_level: 3, device_code: null, insurance_code: "", ...device });
      const deviceId = info.lastInsertRowid;
      device.accessories.forEach(x => insertAccessory.run(deviceId, ...x));
      device.repairs.forEach(x => insertRepair.run(deviceId, ...x, x[7] === "Chờ sửa chữa" ? "Chờ linh kiện" : "Đã hoàn thành"));
      device.maints.forEach(x => insertMaintenance.run(deviceId, ...x));
      device.logs.forEach(x => insertOperation.run(deviceId, ...x));
      device.docs.forEach(x => insertDocument.run(deviceId, ...x));
    });
  });

  tx();

  const existingAccessories = db.prepare("SELECT COUNT(*) AS c FROM accessories WHERE device_id=?");
  const existingLogs = db.prepare("SELECT COUNT(*) AS c FROM operation_logs WHERE device_id=?");
  const existingDocs = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE device_id=?");
  const allSeedDevices = db.prepare("SELECT id, group_code, serial, department_code FROM devices").all();

  function defaultAccessories(groupCode, serial) {
    if (groupCode === "DT") return [["Cáp điện tim 10 lõi",`PK-${serial}-01`,"Nhật Bản",`${serial}-A01`,"Phụ kiện đồng bộ theo máy"],["Bộ điện cực ngực",`PK-${serial}-02`,"Nhật Bản",`${serial}-A02`,"Sử dụng cùng máy"]];
    if (groupCode === "CT") return [["Bộ bơm tiêm thuốc cản quang",`PK-${serial}-01`,"Hoa Kỳ",`${serial}-A01`,"Phụ kiện đồng bộ hệ CT"],["Bộ UPS công suất lớn",`PK-${serial}-02`,"Việt Nam",`${serial}-A02`,"Nguồn lưu điện"]];
    if (groupCode === "MRI") return [["Head Coil",`PK-${serial}-01`,"Hoa Kỳ",`${serial}-A01`,"Cuộn thu tín hiệu đồng bộ"],["Spine Coil",`PK-${serial}-02`,"Hoa Kỳ",`${serial}-A02`,"Phụ kiện đồng bộ MRI"]];
    if (groupCode === "MON") return [["Cáp ECG 5 chuyển đạo",`PK-${serial}-01`,"Trung Quốc",`${serial}-A01`,"Phụ kiện đồng bộ monitor"],["Cảm biến SpO2",`PK-${serial}-02`,"Trung Quốc",`${serial}-A02`,"Phụ kiện đồng bộ monitor"]];
    if (groupCode === "MTH" || groupCode === "MT") return [["Bộ dây máy",`PK-${serial}-01`,"Đức",`${serial}-A01`,"Phụ kiện đồng bộ theo máy"],["Cảm biến theo máy",`PK-${serial}-02`,"Đức",`${serial}-A02`,"Phụ kiện đồng bộ"]];
    if (["SH","HH","XN","MD","DM"].includes(groupCode)) return [["Máy in nhiệt",`PK-${serial}-01`,"Trung Quốc",`${serial}-A01`,"Phụ trợ in kết quả"],["Bộ giá mẫu",`PK-${serial}-02`,"Hoa Kỳ",`${serial}-A02`,"Phụ kiện theo máy"]];
    if (groupCode === "SA") return [["Đầu dò chính",`PK-${serial}-01`,"Hoa Kỳ",`${serial}-A01`,"Đầu dò đồng bộ"],["Đầu dò phụ",`PK-${serial}-02`,"Hoa Kỳ",`${serial}-A02`,"Đầu dò đồng bộ"]];
    if (groupCode === "XQ") return [["Tấm nhận ảnh DR",`PK-${serial}-01`,"Hàn Quốc",`${serial}-A01`,"Phụ kiện đồng bộ"],["Bộ ắc quy lưu động",`PK-${serial}-02`,"Hàn Quốc",`${serial}-A02`,"Nguồn cho máy lưu động"]];
    return [["Phụ kiện đi kèm 1",`PK-${serial}-01`,"Việt Nam",`${serial}-A01`,"Phụ kiện đồng bộ"]];
  }

  allSeedDevices.forEach(d => {
    if (existingAccessories.get(d.id).c === 0) defaultAccessories(d.group_code, d.serial).forEach(x => insertAccessory.run(d.id, ...x));
    if (existingLogs.get(d.id).c === 0) {
      insertOperation.run(d.id, "2026-04-10 08:00", "Khoa Trang bị", d.department_code, "1 ca", "Sẵn sàng", "Hoạt động tốt", "Khởi động đầu ngày");
      insertOperation.run(d.id, "2026-04-10 15:30", "Khoa Trang bị", d.department_code, "2-5 ca", "Đang hoạt động", "Đang hoạt động", "Ghi nhận cuối ca");
    }
    if (existingDocs.get(d.id).c === 0) {
      insertDocument.run(d.id, "Biên bản bàn giao", "Hồ sơ pháp lý", "2025-01-15", "Admin", "Lưu hồ sơ gốc");
      insertDocument.run(d.id, "Phiếu bảo hành", "Hồ sơ kỹ thuật", "2025-01-20", "Admin", "Theo nhà cung cấp");
      insertDocument.run(d.id, "Hướng dẫn sử dụng", "Tài liệu kỹ thuật", "2025-01-21", "Admin", "Bản mềm nội bộ");
    }
  });

  insertCheck.run(2, "2026-04-11 08:15", "Nguyễn Hữu Hoàng", "Kiểm tra nhiệt độ hệ thống và quạt làm mát", "Đạt có lưu ý", "Theo dõi tiếng ồn quạt");
  insertCheck.run(4, "2026-04-11 09:05", "Phạm Đức Hùng", "Kiểm tra dây ECG, cảm biến SpO2, pin monitor", "Đạt", "");
  insertCheck.run(7, "2026-04-11 09:40", "Lê Thị Mai", "Kiểm tra hệ thống hút mẫu và quang học", "Đạt", "");
  insertCheck.run(20, "2026-04-11 10:10", "Tổ TTBYT", "Kiểm tra cảm biến oxy và nguồn nuôi", "Không đạt", "Chờ thay cảm biến");

  insertIncident.run(20, "2026-04-11 08:50", "Sai lệch chỉ số oxy khi vận hành", "Cao", "Điều dưỡng Cấp cứu", "Mới ghi nhận", "Đã báo Tổ TTBYT");
  insertIncident.run(8, "2026-04-11 09:15", "Báo lỗi hút mẫu không ổn định", "Trung bình", "KTV Xét nghiệm", "Mới ghi nhận", "Máy vẫn vận hành hạn chế");
  insertIncident.run(2, "2026-04-10 14:30", "Quạt làm mát phát tiếng ồn", "Thấp", "KTV CĐHA", "Mới ghi nhận", "Đang theo dõi");
}


function dateRangeFromPreset(preset, date, fromDate, toDate) {
  if (fromDate && toDate) return { start: fromDate, end: toDate };
  const selected = date ? new Date(date) : new Date();
  const mk = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const fmt = (d) => d.toISOString().slice(0,10);
  let start = mk(selected), end = mk(selected);
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end = mk(start);
  } else if (preset === "last7") {
    start.setDate(start.getDate() - 6);
    end = mk(selected);
  } else if (preset === "custom" && date) {
    start = mk(selected);
    end = mk(selected);
  }
  return { start: fmt(start), end: fmt(end) };
}

function normalizeDeviceCode(value, departmentCode = "XX", groupCode = "K") {
  const dept = String(departmentCode || "XX").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "XX";
  const group = String(groupCode || "K").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "K";
  const raw = String(value || "").trim().toUpperCase();
  let m = raw.match(/^QY4[-.]?([A-Z0-9]+)[-.]([A-Z0-9]+)[-.](\d{4})$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  m = raw.match(/^([A-Z0-9]+)[-.]([A-Z0-9]+)[-.](\d{4})$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  m = raw.match(/(\d{4})$/);
  if (m) return `${dept}.${group}.${m[1]}`;
  return "";
}

function getDeviceCode(id) {
  const row = db.prepare(`SELECT device_code, department_code, group_code FROM devices WHERE id = ?`).get(id);
  if (!row) return "";
  const normalized = normalizeDeviceCode(row.device_code, row.department_code, row.group_code);
  if (normalized) {
    if (normalized !== row.device_code) db.prepare("UPDATE devices SET device_code=? WHERE id=?").run(normalized, id);
    return normalized;
  }
  const code = generateDeviceCode(row.department_code, row.group_code);
  db.prepare("UPDATE devices SET device_code=? WHERE id=?").run(code, id);
  return code;
}


function enrichDevice(device) {
  return { ...device, device_code: getDeviceCode(device.id) };
}

function ensureDeviceCodeColumnsAndData() {
  const cols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
  if (!cols.includes("device_code")) db.prepare("ALTER TABLE devices ADD COLUMN device_code TEXT").run();
  if (!cols.includes("insurance_code")) db.prepare("ALTER TABLE devices ADD COLUMN insurance_code TEXT").run();
  const rows = db.prepare("SELECT id, department_code, group_code, serial, device_code, insurance_code FROM devices ORDER BY id").all();
  const seen = new Set();
  for (const r of rows) {
    // P0 safety: KHÔNG tự chuyển Serial hãng sang mã HIS/BHXH và KHÔNG xóa Serial.
    // Hai trường được giữ độc lập; dữ liệu cũ chỉ được hiệu chỉnh sau khi đối chiếu có căn cứ.
    const current = normalizeDeviceCode(r.device_code, r.department_code, r.group_code);
    if (current && !seen.has(current)) {
      seen.add(current);
      if (current !== r.device_code) db.prepare("UPDATE devices SET device_code=? WHERE id=?").run(current, r.id);
      continue;
    }
    const code = generateDeviceCode(r.department_code, r.group_code);
    seen.add(code);
    db.prepare("UPDATE devices SET device_code=? WHERE id=?").run(code, r.id);
  }
  try { db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_device_code ON devices(device_code)").run(); } catch (e) {}
}
function generateDeviceCode(departmentCode, groupCode) {
  const dept = String(departmentCode || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'XX';
  const group = String(groupCode || 'K').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'K';
  const prefix = `${dept}.${group}.`;
  const rows = db.prepare("SELECT device_code FROM devices WHERE device_code LIKE ? ORDER BY device_code").all(prefix + "%");
  let max = 0;
  for (const r of rows) {
    const normalized = normalizeDeviceCode(r.device_code, dept, group);
    const m = String(normalized || '').match(/\.(\d{4})$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function normalizeIncidentStatusesInDb() {
  try {
    db.prepare(`UPDATE incidents SET status='Đã chuyển sửa chữa' WHERE status IN ('Chuyển sửa chữa','Chờ linh kiện','Đang kiểm tra','Đang sửa chữa','Đã sửa xong','Bàn giao sử dụng')`).run();
    db.prepare(`UPDATE incidents SET status='Đã xử lý tại chỗ' WHERE status IN ('Đã xử lý','Đóng','Không cần sửa chữa')`).run();
    db.prepare(`UPDATE incidents SET status='Mới ghi nhận' WHERE status IN ('Đã ghi nhận','Đang xử lý','Theo dõi') OR status IS NULL OR status=''`).run();
    db.prepare(`
      UPDATE incidents
      SET status='Đã chuyển sửa chữa'
      WHERE id IN (SELECT DISTINCT incident_id FROM repairs WHERE incident_id IS NOT NULL)
    `).run();
    db.prepare(`
      UPDATE incidents
      SET status='Mới ghi nhận'
      WHERE status NOT IN ('Mới ghi nhận','Đã chuyển sửa chữa','Đã xử lý tại chỗ')
        AND id NOT IN (SELECT DISTINCT incident_id FROM repairs WHERE incident_id IS NOT NULL)
    `).run();
  } catch (e) {}
}

function ensureDeviceQualityColumn() {
  const cols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
  if (!cols.includes("quality_level")) {
    db.prepare("ALTER TABLE devices ADD COLUMN quality_level INTEGER DEFAULT 3").run();
  }
}

initDb();
p2Security.initialize();
ensureDeviceCodeColumnsAndData();
normalizeIncidentStatusesInDb();
try {
  db.prepare("UPDATE devices SET status='Chờ sửa chữa' WHERE status='Hoạt động hạn chế'").run();
  db.prepare("UPDATE repairs SET processing_status='Đang xử lý' WHERE processing_status IN ('Mới tiếp nhận','Đang kiểm tra','Đang sửa chữa')").run();
  db.prepare("UPDATE repairs SET processing_status='Đã hoàn thành' WHERE processing_status IN ('Đã sửa xong','Bàn giao sử dụng')").run();
  db.prepare("UPDATE repairs SET processing_status='Chuyển hãng/Bảo hành' WHERE processing_status IN ('Chuyển hãng','Bảo hành','Gửi hãng')").run();
  db.prepare("UPDATE repairs SET received_at=COALESCE(NULLIF(received_at,''), repair_date) WHERE received_at IS NULL OR received_at=''").run();
  db.prepare("UPDATE repairs SET updated_at=COALESCE(NULLIF(updated_at,''), repair_date) WHERE updated_at IS NULL OR updated_at=''").run();
  db.prepare("UPDATE repairs SET completed_at=COALESCE(NULLIF(completed_at,''), repair_date) WHERE processing_status IN ('Đã hoàn thành') AND (completed_at IS NULL OR completed_at='')").run();
} catch (e) {}



function initExtendedModules() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      inspection_date TEXT,
      type TEXT,
      organization TEXT,
      certificate_no TEXT,
      result TEXT,
      next_date TEXT,
      file_note TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quality_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL UNIQUE,
      rating_date TEXT,
      age_score INTEGER DEFAULT 0,
      performance_score INTEGER DEFAULT 0,
      repair_score INTEGER DEFAULT 0,
      inspection_score INTEGER DEFAULT 0,
      sparepart_score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      grade TEXT,
      recommendation TEXT,
      evaluator TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER,
      indicator TEXT,
      value INTEGER DEFAULT 0,
      unit TEXT,
      note TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  const inspectionCount = db.prepare("SELECT COUNT(*) c FROM inspections").get().c;
  if (process.env.DEMO_MODE === "true" && inspectionCount === 0) {
    const devices = db.prepare("SELECT id, group_code FROM devices ORDER BY id LIMIT 12").all();
    const insertInspection = db.prepare(`INSERT INTO inspections (device_id,inspection_date,type,organization,certificate_no,result,next_date,file_note,note) VALUES (?,?,?,?,?,?,?,?,?)`);
    devices.forEach((d, idx) => {
      const type = ["CT","MRI","XQ"].includes(d.group_code) ? "Kiểm định an toàn bức xạ" : (["MON","MTH","DT"].includes(d.group_code) ? "Hiệu chuẩn" : "Kiểm định");
      const m = String((idx % 9) + 1).padStart(2,"0");
      insertInspection.run(d.id, `2026-${m}-15`, type, "Trung tâm kiểm định/hiệu chuẩn", `QY4-${String(idx+1).padStart(4,"0")}`, "Đạt", `2027-${m}-15`, "Đính kèm bản scan khi có", "Dữ liệu mẫu");
    });
  }

  const qualityCount = db.prepare("SELECT COUNT(*) c FROM quality_ratings").get().c;
  if (process.env.DEMO_MODE === "true" && qualityCount === 0) {
    const devices = db.prepare("SELECT id, year_in_use, status FROM devices ORDER BY id").all();
    const insertQuality = db.prepare(`INSERT INTO quality_ratings (device_id,rating_date,age_score,performance_score,repair_score,inspection_score,sparepart_score,total_score,grade,recommendation,evaluator,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const currentYear = new Date().getFullYear();
    devices.forEach(d => {
      const age = Math.max(0, currentYear - Number(d.year_in_use || currentYear));
      const age_score = age <= 3 ? 25 : age <= 7 ? 20 : age <= 10 ? 15 : 8;
      const performance_score = d.status === "Đang hoạt động" ? 25 : d.status === "Hoạt động hạn chế" ? 18 : 8;
      const repair_score = d.status === "Chờ sửa chữa" ? 8 : 20;
      const inspection_score = 15;
      const sparepart_score = age <= 7 ? 15 : 10;
      const total = age_score + performance_score + repair_score + inspection_score + sparepart_score;
      const grade = total >= 90 ? "A" : total >= 80 ? "B" : total >= 65 ? "C" : "D";
      const recommendation = grade === "A" ? "Tiếp tục khai thác" : grade === "B" ? "Theo dõi định kỳ" : grade === "C" ? "Lập kế hoạch sửa chữa/thay thế" : "Đề nghị thay thế hoặc thanh lý";
      insertQuality.run(d.id, "2026-06-05", age_score, performance_score, repair_score, inspection_score, sparepart_score, total, grade, recommendation, "Khoa Trang bị", "Tự động sinh dữ liệu mẫu");
    });
  }

  const usageCount = db.prepare("SELECT COUNT(*) c FROM usage_reports").get().c;
  if (process.env.DEMO_MODE === "true" && usageCount === 0) {
    const devices = db.prepare("SELECT id, group_code FROM devices ORDER BY id LIMIT 20").all();
    const insertUsage = db.prepare(`INSERT INTO usage_reports (device_id,year,month,indicator,value,unit,note) VALUES (?,?,?,?,?,?,?)`);
    devices.forEach((d, idx) => {
      let indicator = "Số ca", unit = "ca";
      if (["SH","HH","XN","MD","DM"].includes(d.group_code)) { indicator = "Số test"; unit = "test"; }
      if (["CT","MRI","XQ","SA"].includes(d.group_code)) { indicator = "Ca chụp/siêu âm"; unit = "ca"; }
      if (["MTH","MON"].includes(d.group_code)) { indicator = "Ngày sử dụng"; unit = "ngày"; }
      insertUsage.run(d.id, 2026, null, indicator, (idx+1)*120 + 450, unit, "Dữ liệu mẫu phục vụ báo cáo thực lực");
    });
  }
}

initExtendedModules();
const inspectionColsP3 = db.prepare("PRAGMA table_info(inspections)").all().map(x => x.name);
if (!inspectionColsP3.includes("cancelled_at")) db.exec("ALTER TABLE inspections ADD COLUMN cancelled_at TEXT");
if (!inspectionColsP3.includes("cancel_reason")) db.exec("ALTER TABLE inspections ADD COLUMN cancel_reason TEXT");



app.get("/api/departments", (req, res) => {
  const rows = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM devices dv WHERE dv.department_code = d.code) AS device_count,
      (SELECT COUNT(*) FROM users u WHERE u.department_code = d.code) AS user_count
    FROM departments d
    ORDER BY d.code
  `).all();
  res.json(rows);
});

app.post("/api/departments", (req, res) => {
  const { code, name } = req.body;
  db.prepare("INSERT INTO departments (code, name) VALUES (?, ?)").run(code, name);
  res.json({ ok: true });
});

app.put("/api/departments/:code", (req, res) => {
  const oldCode = req.params.code;
  const { code, name } = req.body;
  const tx = db.transaction(() => {
    if (oldCode !== code) {
      db.prepare("UPDATE devices SET department_code = ? WHERE department_code = ?").run(code, oldCode);
      db.prepare("UPDATE users SET department_code = ? WHERE department_code = ?").run(code, oldCode);
      db.prepare("UPDATE operation_logs SET department_code = ? WHERE department_code = ?").run(code, oldCode);
    }
    db.prepare("UPDATE departments SET code = ?, name = ? WHERE code = ?").run(code, name, oldCode);
  });
  tx();
  res.json({ ok: true });
});

app.delete("/api/departments/:code", (req, res) => {
  const code = req.params.code;
  const used = db.prepare("SELECT COUNT(*) AS c FROM devices WHERE department_code = ?").get(code).c
             + db.prepare("SELECT COUNT(*) AS c FROM users WHERE department_code = ?").get(code).c;
  if (used > 0) return res.status(400).json({ error: "Khoa/phòng đang được sử dụng, không thể xóa." });
  db.prepare("DELETE FROM departments WHERE code = ?").run(code);
  res.json({ ok: true });
});

app.get("/api/device-groups", (req, res) => {
  const rows = db.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM devices dv WHERE dv.group_code = g.code) AS device_count
    FROM device_groups g
    ORDER BY g.code
  `).all();
  res.json(rows);
});

app.post("/api/device-groups", (req, res) => {
  const { code, name } = req.body;
  db.prepare("INSERT INTO device_groups (code, name) VALUES (?, ?)").run(code, name);
  res.json({ ok: true });
});

app.put("/api/device-groups/:code", (req, res) => {
  const oldCode = req.params.code;
  const { code, name } = req.body;
  const tx = db.transaction(() => {
    if (oldCode !== code) {
      db.prepare("UPDATE devices SET group_code = ? WHERE group_code = ?").run(code, oldCode);
    }
    db.prepare("UPDATE device_groups SET code = ?, name = ? WHERE code = ?").run(code, name, oldCode);
  });
  tx();
  res.json({ ok: true });
});

app.delete("/api/device-groups/:code", (req, res) => {
  const code = req.params.code;
  const used = db.prepare("SELECT COUNT(*) AS c FROM devices WHERE group_code = ?").get(code).c;
  if (used > 0) return res.status(400).json({ error: "Nhóm thiết bị đang được sử dụng, không thể xóa." });
  db.prepare("DELETE FROM device_groups WHERE code = ?").run(code);
  res.json({ ok: true });
});

app.get("/api/meta", (req, res) => {
  res.json({
    departments: db.prepare("SELECT * FROM departments ORDER BY code").all(),
    groups: db.prepare("SELECT * FROM device_groups ORDER BY code").all()
  });
});

app.get("/api/users", (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, d.name AS department_name
    FROM users u
    LEFT JOIN departments d ON d.code = u.department_code
    ORDER BY u.id
  `).all();
  res.json(rows);
});

app.post("/api/users", (req, res) => {
  const { full_name, username, role, department_code, status, phone } = req.body;
  const info = db.prepare(`
    INSERT INTO users (full_name, username, role, department_code, status, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(full_name, username, role, department_code, status, phone || "");
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/users/:id", (req, res) => {
  const { full_name, username, role, department_code, status, phone } = req.body;
  db.prepare(`
    UPDATE users SET full_name=?, username=?, role=?, department_code=?, status=?, phone=?
    WHERE id=?
  `).run(full_name, username, role, department_code, status, phone || "", req.params.id);
  res.json({ ok: true });
});

app.delete("/api/users/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});


function extractSerialFromHisCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // Quy tắc BVQY4: Mã HIS dạng TNT.1.40026.228541 thì Serial là chuỗi số cuối sau 40026.
  const parts = raw.split('.').map(x => x.trim()).filter(Boolean);
  const idx = parts.findIndex(x => x === '40026');
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) return parts[parts.length - 1];
  const m = raw.match(/40026[.\-_/ ]+(\d+)$/);
  if (m) return m[1];
  return '';
}
function applySerialRule(payload) {
  const serial = String(payload.serial || '').trim();
  return { ...payload, serial };
}
function backfillSerialFromHisCodes() {
  try {
    const rows = db.prepare("SELECT id, insurance_code, serial FROM devices").all();
    const update = db.prepare("UPDATE devices SET serial=? WHERE id=?");
    rows.forEach(r => {
      const current = String(r.serial || '').trim();
      if (!current) {
        const sn = extractSerialFromHisCode(r.insurance_code);
        if (sn) update.run(sn, r.id);
      }
    });
  } catch (e) {}
}

if (process.env.DEMO_MODE === "true") backfillSerialFromHisCodes();

app.get("/api/devices", (req, res) => {
  const rows = db.prepare(`
    SELECT dv.*, d.name AS department_name, g.name AS group_name
    FROM devices dv
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    ORDER BY dv.id
  `).all().map(enrichDevice);
  res.json(rows);
});

app.get("/api/devices/:id", (req, res) => {
  const device = db.prepare(`
    SELECT dv.*, d.name AS department_name, g.name AS group_name
    FROM devices dv
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    WHERE dv.id = ?
  `).get(req.params.id);
  if (!device) return res.status(404).json({ error: "Not found" });
  const id = Number(req.params.id);
  const incidentRows = db.prepare(`
      SELECT i.*, lr.id AS linked_repair_id, lr.processing_status AS linked_repair_status
      FROM incidents i
      LEFT JOIN repairs lr ON lr.incident_id = i.id
      WHERE i.device_id = ?
      ORDER BY i.incident_datetime DESC, i.id DESC
    `).all(id);
  const incidentFiles = getIncidentFilesMap(incidentRows.map(r => r.id));
  const data = {
    ...enrichDevice(device),
    accessories: db.prepare("SELECT * FROM accessories WHERE device_id = ? ORDER BY id").all(id),
    repairs: db.prepare(`
      SELECT r.*, i.id AS source_incident_id, i.description AS source_incident_description
      FROM repairs r
      LEFT JOIN incidents i ON i.id = r.incident_id
      WHERE r.device_id = ?
      ORDER BY COALESCE(r.received_at, r.repair_date) DESC, r.id DESC
    `).all(id).map(r => ({ ...r, processing_status: normalizeRepairStatus(r.processing_status) })),
    incidents: incidentRows.map(r => ({ ...r, status: normalizeIncidentStatusForUi(r.status, r.linked_repair_id), files: incidentFiles[r.id] || [] })),
    maintenances: db.prepare("SELECT * FROM maintenances WHERE device_id = ? ORDER BY id DESC").all(id),
    inspections: db.prepare("SELECT * FROM inspections WHERE device_id = ? ORDER BY id DESC").all(id).map(r => ({ ...r, device_code: getDeviceCode(r.device_id), device_name: device.name, department_code: device.department_code })),
    operation_logs: db.prepare("SELECT * FROM operation_logs WHERE device_id = ? ORDER BY id DESC").all(id),
    documents: db.prepare("SELECT * FROM documents WHERE device_id = ? ORDER BY id DESC").all(id)
  };
  res.json(data);
});

app.post("/api/devices", (req, res) => {
  const payload = applySerialRule({ ...req.body, quality_level: Number(req.body.quality_level || 3) });
  payload.device_code = payload.device_code || generateDeviceCode(payload.department_code, payload.group_code);
  payload.insurance_code = payload.insurance_code || "";
  const info = db.prepare(`
    INSERT INTO devices (department_code,group_code,name,manufacturer,model,year_in_use,warranty_end,status,quality_level,serial,country,year_manufactured,cost,funding,location,note,device_code,insurance_code)
    VALUES (@department_code,@group_code,@name,@manufacturer,@model,@year_in_use,@warranty_end,@status,@quality_level,@serial,@country,@year_manufactured,@cost,@funding,@location,@note,@device_code,@insurance_code)
  `).run(payload);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/devices/:id", (req, res) => {
  const payload = applySerialRule({ ...req.body, quality_level: Number(req.body.quality_level || 3), device_code: req.body.device_code || "", insurance_code: req.body.insurance_code || "" });
  db.prepare(`
    UPDATE devices SET
      department_code=@department_code, group_code=@group_code, name=@name, manufacturer=@manufacturer,
      model=@model, year_in_use=@year_in_use, warranty_end=@warranty_end, status=@status, quality_level=@quality_level, serial=@serial,
      country=@country, year_manufactured=@year_manufactured, cost=@cost, funding=@funding, location=@location, note=@note,
      device_code=COALESCE(NULLIF(@device_code,''), device_code), insurance_code=@insurance_code
    WHERE id=@id
  `).run({ ...payload, id: Number(req.params.id) });
  res.json({ ok: true });
});

app.delete("/api/devices/:id", (req, res) => {
  const id = Number(req.params.id);
  const relatedTables = [
    "incidents", "incident_files", "repairs", "maintenances", "inspections",
    "operation_logs", "documents", "daily_checks", "quality_ratings", "usage_reports",
    "transfers", "liquidations"
  ];
  const related = [];
  for (const table of relatedTables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE device_id=?`).get(id);
      const count = Number(row?.c || 0);
      if (count > 0) related.push(`${table}: ${count}`);
    } catch (e) {}
  }
  if (related.length) {
    return res.status(409).json({
      error: "Không thể xóa thiết bị đã phát sinh lịch sử. Hãy chuyển tình trạng thiết bị sang Ngừng hoạt động/Chờ thanh lý/Đã thanh lý để bảo toàn lý lịch.",
      related
    });
  }
  db.prepare("DELETE FROM accessories WHERE device_id=?").run(id);
  db.prepare("DELETE FROM repairs WHERE device_id=?").run(id);
  db.prepare("DELETE FROM maintenances WHERE device_id=?").run(id);
  db.prepare("DELETE FROM inspections WHERE device_id=?").run(id);
  db.prepare("DELETE FROM operation_logs WHERE device_id=?").run(id);
  db.prepare("DELETE FROM documents WHERE device_id=?").run(id);
  db.prepare("DELETE FROM devices WHERE id=?").run(id);
  res.json({ ok: true });
});

app.get("/api/repairs", (req, res) => {
  const rows = db.prepare(`
    SELECT
      r.*,
      COALESCE(r.processing_status, 'Đang xử lý') AS processing_status,
      dv.name AS device_name,
      dv.department_code,
      dv.group_code,
      dv.location,
      dv.model,
      dv.serial,
      i.id AS source_incident_id,
      i.description AS source_incident_description,
      d.name AS department_name,
      g.name AS group_name
    FROM repairs r
    LEFT JOIN devices dv ON dv.id = r.device_id
    LEFT JOIN incidents i ON i.id = r.incident_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    ORDER BY r.id DESC
  `).all().map(r => ({ ...r, processing_status: normalizeRepairStatus(r.processing_status), device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/repairs", (req, res) => {
  try {
    const p = req.body || {};
    if (!p.device_id) return res.status(400).json({ error: "device_id is required" });
    const payload = {
      device_id: Number(p.device_id),
      repair_date: normalizeDateTime(p.repair_date || ""),
      issue: p.issue || "",
      work: p.work || "",
      person: p.person || "",
      method: p.method || "",
      cost: Number(p.cost || 0),
      result: p.result || "",
      status_after: statusAfterFromRepairStatus(p.processing_status || "Đang xử lý", p.status_after || "Đang hoạt động"),
      processing_status: normalizeRepairStatus(p.processing_status || "Đang xử lý"),
      incident_id: p.incident_id ? Number(p.incident_id) : null,
      received_at: normalizeDateTime(p.received_at || p.repair_date || nowSql()),
      updated_at: nowSql(),
      completed_at: ["Đã hoàn thành"].includes(normalizeRepairStatus(p.processing_status || "Đang xử lý")) ? nowSql() : "",
      note: p.note || "",
      file_count: Number(p.file_count || 0),
      file_names: p.file_names || ""
    };
    const info = db.prepare(`
      INSERT INTO repairs (device_id, repair_date, issue, work, person, method, cost, result, status_after, processing_status, incident_id, received_at, updated_at, completed_at, note, file_count, file_names)
      VALUES (@device_id, @repair_date, @issue, @work, @person, @method, @cost, @result, @status_after, @processing_status, @incident_id, @received_at, @updated_at, @completed_at, @note, @file_count, @file_names)
    `).run(payload);
    db.prepare(`UPDATE devices SET status=? WHERE id=?`).run(payload.status_after, payload.device_id);
    if (!p.skip_history) {
      const note = payload.incident_id
        ? `Tạo phiếu sửa chữa từ sự cố ${p.incident_code || ('#' + payload.incident_id)}`
        : (payload.issue || payload.work || "Tạo phiếu sửa chữa");
      writeHistory("repair", info.lastInsertRowid, payload.person || "Khoa Trang bị", payload.incident_id ? "Tạo từ sự cố" : "Tạo phiếu", "", payload.processing_status, note, payload.cost, payload.incident_id ? "Tự động" : "Tự động", p.action_time || payload.received_at || payload.repair_date);
    }
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    console.error("POST /api/repairs error:", e);
    res.status(500).json({ error: e.message });
  }
});


app.post("/api/accessories", (req, res) => {
  const p = req.body;
  const info = db.prepare(`
    INSERT INTO accessories (device_id,name,code,maker_country,serial,note)
    VALUES (@device_id,@name,@code,@maker_country,@serial,@note)
  `).run(p);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/accessories/:id", (req, res) => {
  const p = req.body;
  db.prepare(`
    UPDATE accessories SET name=@name, code=@code, maker_country=@maker_country, serial=@serial, note=@note
    WHERE id=@id
  `).run({ ...p, id: Number(req.params.id) });
  res.json({ ok: true });
});

app.delete("/api/accessories/:id", (req, res) => {
  db.prepare("DELETE FROM accessories WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.put("/api/repairs/:id", (req, res) => {
  try {
    const p = req.body;
    if (!p.device_id) return res.status(400).json({ error: "device_id is required" });
    const old = db.prepare("SELECT * FROM repairs WHERE id=?").get(req.params.id) || {};
    if (!old.id) return res.status(404).json({ error: "Không tìm thấy phiếu sửa chữa." });
    if (Number(p.device_id) !== Number(old.device_id)) {
      return res.status(409).json({ error: "Không được đổi thiết bị của phiếu sửa chữa đã tạo. Hãy hủy phiếu nhập nhầm và tạo phiếu mới để bảo toàn lịch sử." });
    }
    const payload = {
      device_id: Number(p.device_id),
      repair_date: normalizeDateTime(p.repair_date || ""),
      issue: p.issue || "",
      work: p.work || "",
      person: p.person || "",
      method: p.method || "",
      cost: Number(p.cost || 0),
      result: p.result || "",
      status_after: statusAfterFromRepairStatus(p.processing_status || old.processing_status || "Đang xử lý", p.status_after || old.status_after || "Đang hoạt động"),
      processing_status: normalizeRepairStatus(p.processing_status || old.processing_status || "Đang xử lý"),
      incident_id: old.incident_id || null,
      received_at: normalizeDateTime(p.received_at || old.received_at || old.repair_date || p.repair_date || nowSql()),
      updated_at: nowSql(),
      completed_at: ["Đã hoàn thành"].includes(normalizeRepairStatus(p.processing_status || old.processing_status || "Đang xử lý")) ? (old.completed_at || nowSql()) : "",
      note: p.note ?? old.note ?? "",
      file_count: Number(p.file_count ?? old.file_count ?? 0),
      file_names: p.file_names ?? old.file_names ?? "",
      id: Number(req.params.id)
    };
    db.prepare(`
      UPDATE repairs SET
        device_id=@device_id,
        repair_date=@repair_date,
        issue=@issue,
        work=@work,
        person=@person,
        method=@method,
        cost=@cost,
        result=@result,
        status_after=@status_after,
        processing_status=@processing_status,
        incident_id=@incident_id,
        received_at=@received_at,
        updated_at=@updated_at,
        completed_at=@completed_at,
        note=@note,
        file_count=@file_count,
        file_names=@file_names
      WHERE id=@id
    `).run(payload);
    db.prepare(`UPDATE devices SET status=? WHERE id=?`).run(payload.status_after, payload.device_id);
    if (!p.skip_history) {
      const actionType = payload.processing_status === "Đã hoàn thành" ? "Hoàn thành" : (payload.processing_status === "Không sửa được" ? "Không sửa được" : "Cập nhật");
      const note = payload.work || payload.result || payload.issue || "Cập nhật phiếu sửa chữa";
      writeHistory("repair", Number(req.params.id), payload.person || "Khoa Trang bị", actionType, old.processing_status || "", payload.processing_status || "", note, payload.cost, actionType, p.action_time || payload.updated_at);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/repairs/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/repairs/:id", (req, res) => {
  try {
    const old = db.prepare("SELECT * FROM repairs WHERE id=?").get(req.params.id);
    if (!old) return res.status(404).json({ error: "Không tìm thấy phiếu sửa chữa." });
    const reason = (req.body && req.body.reason) || "Hủy phiếu";
    db.prepare(`UPDATE repairs SET processing_status='Đã hủy', updated_at=?, note=TRIM(COALESCE(note,'') || CASE WHEN COALESCE(note,'')<>'' THEN '\n' ELSE '' END || ?) WHERE id=?`).run(nowSql(), `Lý do hủy: ${reason}`, req.params.id);
    writeHistory("repair", Number(req.params.id), "Quản trị viên", "Hủy phiếu", old.processing_status || "", "Đã hủy", `Hủy phiếu. Lý do: ${reason}`, old.cost || 0, "Hủy phiếu", nowSql());
    writeAudit("repair", "cancel", `Hủy phiếu sửa chữa #${req.params.id}: ${reason}`);

    if (old.incident_id) {
      const otherRepair = db.prepare(`
        SELECT COUNT(*) AS c FROM repairs
        WHERE incident_id=? AND id<>?
          AND COALESCE(processing_status,'') NOT IN ('Đã hủy','Hủy','Huỷ','Đã huỷ')
      `).get(old.incident_id, Number(req.params.id));
      if (Number(otherRepair?.c || 0) === 0) {
        db.prepare("UPDATE incidents SET status='Mới ghi nhận', updated_at=?, updated_by=? WHERE id=?")
          .run(nowSql(), "Hệ thống", old.incident_id);
        db.prepare("UPDATE devices SET status='Chờ sửa chữa' WHERE id=?").run(old.device_id);
        writeAudit("incident", "reopen_after_repair_cancel", `Mở lại sự cố #${old.incident_id} do hủy phiếu sửa chữa #${req.params.id}`);
      }
    }

    const remainingOpenRepairs = db.prepare(`
      SELECT COUNT(*) AS c FROM repairs
      WHERE device_id=? AND id<>?
        AND COALESCE(processing_status,'') NOT IN ('Đã hủy','Hủy','Huỷ','Đã huỷ','Đã hoàn thành','Hoàn thành','Không sửa được','Không thể sửa')
    `).get(old.device_id, Number(req.params.id));
    if (Number(remainingOpenRepairs?.c || 0) > 0) {
      db.prepare("UPDATE devices SET status='Chờ sửa chữa' WHERE id=?").run(old.device_id);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/repairs/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/repairs/:id/history", (req, res) => {
  const repair = db.prepare(`
    SELECT r.*, i.incident_code, i.id AS source_incident_id
    FROM repairs r
    LEFT JOIN incidents i ON i.id = r.incident_id
    WHERE r.id=?
  `).get(req.params.id) || {};
  let rows = db.prepare(`SELECT * FROM activity_history WHERE module='repair' AND record_id=? ORDER BY action_time DESC, id DESC`).all(req.params.id);

  // Chuẩn hóa lịch sử cũ: phiếu tạo từ sự cố chỉ hiển thị 01 mốc tự động, tránh trùng thời gian.
  const incidentCode = repair.incident_code || (repair.source_incident_id ? `#${repair.source_incident_id}` : "");
  const isCreateFromIncident = (r) => {
    const txt = String([r.action_type, r.note, r.entry_type].join(" ")).toLowerCase();
    return Boolean(repair.incident_id || repair.source_incident_id) &&
      (txt.includes("sự cố") || txt.includes("su co") || r.action_type === "Tạo từ sự cố");
  };
  const createRows = rows.filter(isCreateFromIncident);
  if (createRows.length) {
    const sortedCreate = [...createRows].sort((a, b) => String(a.action_time || "").localeCompare(String(b.action_time || "")) || Number(a.id || 0) - Number(b.id || 0));
    const base = sortedCreate[0];
    const synthetic = {
      ...base,
      actor: "Hệ thống",
      action_type: "Tạo từ sự cố",
      new_status: normalizeRepairStatus(base.new_status || repair.processing_status || "Đang xử lý"),
      note: `Tạo phiếu sửa chữa từ sự cố ${incidentCode}`.trim(),
      cost: Number(base.cost || 0),
      entry_type: "Tự động"
    };
    rows = rows.filter(r => !isCreateFromIncident(r));
    rows.push(synthetic);
    rows.sort((a, b) => String(b.action_time || "").localeCompare(String(a.action_time || "")) || Number(b.id || 0) - Number(a.id || 0));
  }
  rows = rows.map(r => ({
    ...r,
    cost: Number(r.cost || 0),
    new_status: normalizeRepairStatus(r.new_status || repair.processing_status || "Đang xử lý")
  }));
  res.json(rows);
});

app.put("/api/maintenances/:id", uploadDocument.single("file"), (req, res) => {
  try {
    const p = req.body || {};
    const id = Number(req.params.id);
    const old = db.prepare("SELECT * FROM maintenances WHERE id=?").get(id);
    if (!old) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(404).json({ error: "Không tìm thấy bản ghi bảo dưỡng." });
    }
    const file = req.file || null;
    if (file && old.file_path) safeUnlink(path.join(__dirname, old.file_path.replace(/^\//, "")));
    db.prepare(`
      UPDATE maintenances SET
        device_id=@device_id, maintenance_date=@maintenance_date, type=@type, content=@content, result=@result,
        performer=@performer, user_confirm=@user_confirm, vendor=@vendor, next_date=@next_date, note=@note,
        original_name=@original_name, stored_name=@stored_name, file_path=@file_path, file_mime=@file_mime, file_size=@file_size
      WHERE id=@id
    `).run({
      id,
      device_id: Number(p.device_id),
      maintenance_date: normalizeDateTime(p.maintenance_date || ""),
      type: p.type || "",
      content: p.content || "",
      result: p.result || "",
      performer: p.performer || "",
      user_confirm: p.user_confirm || "",
      vendor: p.vendor || "",
      next_date: p.next_date || "",
      note: p.note || "",
      original_name: file ? file.originalname : old.original_name,
      stored_name: file ? file.filename : old.stored_name,
      file_path: file ? `/uploads/documents/${file.filename}` : old.file_path,
      file_mime: file ? file.mimetype : old.file_mime,
      file_size: file ? file.size : (old.file_size || 0)
    });
    if (file) {
      db.prepare(`
        INSERT INTO documents (device_id,name,type,doc_date,updated_by,note,original_name,stored_name,file_path,file_mime,file_size)
        VALUES (@device_id,@name,@type,@doc_date,@updated_by,@note,@original_name,@stored_name,@file_path,@file_mime,@file_size)
      `).run({
        device_id: Number(p.device_id),
        name: `Tài liệu bảo dưỡng - ${p.maintenance_date || nowSql().slice(0,10)}`,
        type: "Bảo dưỡng",
        doc_date: p.maintenance_date || nowSql().slice(0,10),
        updated_by: p.performer || "",
        note: p.note || "Tệp đính kèm từ phiếu bảo dưỡng",
        original_name: file.originalname,
        stored_name: file.filename,
        file_path: `/uploads/documents/${file.filename}`,
        file_mime: file.mimetype,
        file_size: file.size
      });
    }
    writeHistory("maintenance", id, p.performer, "Cập nhật", old.result || "", p.result || "", p.content || p.note || "");
    res.json({ ok: true, file_path: file ? `/uploads/documents/${file.filename}` : old.file_path });
  } catch (e) {
    console.error("PUT /api/maintenances/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/maintenances/:id", (req, res) => {
  const old = db.prepare("SELECT * FROM maintenances WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "Không tìm thấy bản ghi bảo dưỡng." });
  const reason = String(req.body?.reason || "Hủy bản ghi nhập nhầm").trim();
  db.prepare("UPDATE maintenances SET cancelled_at=?, cancel_reason=? WHERE id=?").run(nowSql(), reason, req.params.id);
  writeHistory("maintenance", Number(req.params.id), old.performer || "Khoa Trang bị", "Hủy bản ghi", old.result || "", "Đã hủy", reason);
  logAudit("maintenance", Number(req.params.id), "Hủy bản ghi", reason);
  res.json({ ok: true });
});

app.post("/api/operation-logs", (req, res) => {
  const p = req.body;
  const info = db.prepare(`
    INSERT INTO operation_logs (device_id,log_datetime,user_name,department_code,usage_count,status_before,status_after,note)
    VALUES (@device_id,@log_datetime,@user_name,@department_code,@usage_count,@status_before,@status_after,@note)
  `).run(p);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/operation-logs/:id", (req, res) => {
  const p = req.body;
  db.prepare(`
    UPDATE operation_logs SET log_datetime=@log_datetime, user_name=@user_name, department_code=@department_code, usage_count=@usage_count, status_before=@status_before, status_after=@status_after, note=@note
    WHERE id=@id
  `).run({ ...p, id: Number(req.params.id) });
  res.json({ ok: true });
});

app.delete("/api/operation-logs/:id", (req, res) => {
  db.prepare("DELETE FROM operation_logs WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/documents", uploadDocument.single("file"), (req, res) => {
  const p = req.body || {};
  const file = req.file || null;
  const info = db.prepare(`
    INSERT INTO documents (device_id,name,type,doc_date,updated_by,note,original_name,stored_name,file_path,file_mime,file_size)
    VALUES (@device_id,@name,@type,@doc_date,@updated_by,@note,@original_name,@stored_name,@file_path,@file_mime,@file_size)
  `).run({
    device_id: Number(p.device_id),
    name: p.name || "",
    type: p.type || "",
    doc_date: p.doc_date || "",
    updated_by: p.updated_by || "",
    note: p.note || "",
    original_name: file ? file.originalname : null,
    stored_name: file ? file.filename : null,
    file_path: file ? `/uploads/documents/${file.filename}` : null,
    file_mime: file ? file.mimetype : null,
    file_size: file ? file.size : 0
  });
  res.json({ id: info.lastInsertRowid, file_path: file ? `/uploads/documents/${file.filename}` : null, original_name: file ? file.originalname : null });
});

app.put("/api/documents/:id", uploadDocument.single("file"), (req, res) => {
  const p = req.body || {};
  const id = Number(req.params.id);
  const old = db.prepare("SELECT * FROM documents WHERE id=?").get(id);
  if (!old) {
    if (req.file) safeUnlink(req.file.path);
    return res.status(404).json({ error: "Không tìm thấy tài liệu." });
  }
  const file = req.file || null;
  if (file && old.file_path) safeUnlink(path.join(__dirname, old.file_path.replace(/^\//, "")));
  db.prepare(`
    UPDATE documents SET
      name=@name, type=@type, doc_date=@doc_date, updated_by=@updated_by, note=@note,
      original_name=@original_name, stored_name=@stored_name, file_path=@file_path, file_mime=@file_mime, file_size=@file_size
    WHERE id=@id
  `).run({
    id,
    name: p.name || "",
    type: p.type || "",
    doc_date: p.doc_date || "",
    updated_by: p.updated_by || "",
    note: p.note || "",
    original_name: file ? file.originalname : old.original_name,
    stored_name: file ? file.filename : old.stored_name,
    file_path: file ? `/uploads/documents/${file.filename}` : old.file_path,
    file_mime: file ? file.mimetype : old.file_mime,
    file_size: file ? file.size : (old.file_size || 0)
  });
  res.json({ ok: true });
});

app.get("/api/documents/:id/download", (req, res) => {
  const row = db.prepare("SELECT * FROM documents WHERE id=?").get(Number(req.params.id));
  if (!row || !row.file_path) return res.status(404).json({ error: "Tài liệu chưa có file đính kèm." });
  const abs = path.join(__dirname, row.file_path.replace(/^\//, ""));
  if (!fs.existsSync(abs)) return res.status(404).json({ error: "Không tìm thấy file." });
  res.download(abs, row.original_name || path.basename(abs));
});

app.delete("/api/documents/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM documents WHERE id=?").get(id);
  if (row && row.file_path) safeUnlink(path.join(__dirname, row.file_path.replace(/^\//, "")));
  db.prepare("DELETE FROM documents WHERE id=?").run(id);
  res.json({ ok: true });
});



function latestDeviceMaintenance(deviceId) {
  return db.prepare(`
    SELECT maintenance_date, type, result, performer, next_date
    FROM maintenances
    WHERE device_id=?
    ORDER BY COALESCE(maintenance_date,'') DESC, id DESC
    LIMIT 1
  `).get(deviceId) || null;
}
function latestDeviceInspection(deviceId) {
  return db.prepare(`
    SELECT inspection_date, type, organization, certificate_no, result, next_date
    FROM inspections
    WHERE device_id=?
    ORDER BY COALESCE(inspection_date,'') DESC, id DESC
    LIMIT 1
  `).get(deviceId) || null;
}
function openDeviceRepair(deviceId) {
  return db.prepare(`
    SELECT id, processing_status, issue, received_at, repair_date
    FROM repairs
    WHERE device_id=? AND COALESCE(processing_status,'') IN ('Đang xử lý','Đang sửa chữa','Chờ linh kiện')
    ORDER BY COALESCE(updated_at, received_at, repair_date,'') DESC, id DESC
    LIMIT 1
  `).get(deviceId) || null;
}
function getQrDevicePayload(deviceId) {
  const row = db.prepare(`
    SELECT dv.*, d.name AS department_name, g.name AS group_name
    FROM devices dv
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    WHERE dv.id=?
  `).get(Number(deviceId));
  if (!row) return null;
  return {
    ...enrichDevice(row),
    latest_maintenance: latestDeviceMaintenance(row.id),
    latest_inspection: latestDeviceInspection(row.id),
    open_repair: openDeviceRepair(row.id)
  };
}

app.get("/api/maintenances", (req, res) => {
  const rows = db.prepare(`
    SELECT
      m.*,
      dv.name AS device_name,
      dv.department_code,
      dv.group_code,
      dv.location,
      dv.model,
      dv.serial,
      d.name AS department_name,
      g.name AS group_name
    FROM maintenances m
    LEFT JOIN devices dv ON dv.id = m.device_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    WHERE COALESCE(m.cancelled_at,'') = ''
    ORDER BY m.id DESC
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/maintenances", uploadDocument.single("file"), (req, res) => {
  try {
    const p = req.body || {};
    if (!p.device_id) return res.status(400).json({ error: "device_id is required" });
    const file = req.file || null;
    const info = db.prepare(`
      INSERT INTO maintenances (device_id,maintenance_date,type,content,result,performer,user_confirm,vendor,next_date,note,original_name,stored_name,file_path,file_mime,file_size)
      VALUES (@device_id,@maintenance_date,@type,@content,@result,@performer,@user_confirm,@vendor,@next_date,@note,@original_name,@stored_name,@file_path,@file_mime,@file_size)
    `).run({
      device_id: Number(p.device_id),
      maintenance_date: normalizeDateTime(p.maintenance_date || ""),
      type: p.type || "",
      content: p.content || "",
      result: p.result || "",
      performer: p.performer || "",
      user_confirm: p.user_confirm || "",
      vendor: p.vendor || "",
      next_date: p.next_date || "",
      note: p.note || "",
      original_name: file ? file.originalname : null,
      stored_name: file ? file.filename : null,
      file_path: file ? `/uploads/documents/${file.filename}` : null,
      file_mime: file ? file.mimetype : null,
      file_size: file ? file.size : 0
    });
    if (file) {
      db.prepare(`
        INSERT INTO documents (device_id,name,type,doc_date,updated_by,note,original_name,stored_name,file_path,file_mime,file_size)
        VALUES (@device_id,@name,@type,@doc_date,@updated_by,@note,@original_name,@stored_name,@file_path,@file_mime,@file_size)
      `).run({
        device_id: Number(p.device_id),
        name: `Tài liệu bảo dưỡng - ${p.maintenance_date || nowSql().slice(0,10)}`,
        type: "Bảo dưỡng",
        doc_date: p.maintenance_date || nowSql().slice(0,10),
        updated_by: p.performer || "",
        note: p.note || "Tệp đính kèm từ phiếu bảo dưỡng",
        original_name: file.originalname,
        stored_name: file.filename,
        file_path: `/uploads/documents/${file.filename}`,
        file_mime: file.mimetype,
        file_size: file.size
      });
    }
    writeHistory("maintenance", info.lastInsertRowid, p.performer, "Tạo mới", "", p.result || "", p.content || p.note || "");
    res.json({ id: info.lastInsertRowid, file_path: file ? `/uploads/documents/${file.filename}` : null });
  } catch (e) {
    console.error("POST /api/maintenances error:", e);
    res.status(500).json({ error: e.message });
  }
});




function getPublicDevicePayload(deviceId) {
  const d = getQrDevicePayload(deviceId);
  if (!d) return null;
  return {
    id: d.id,
    device_code: d.device_code,
    name: d.name,
    department_name: d.department_name || d.department_code || "",
    location: d.location || "",
    status: d.status || "",
    model: d.model || "",
    serial: d.serial || ""
  };
}

app.get("/api/public/device/:id", (req, res) => {
  const data = getPublicDevicePayload(req.params.id);
  if (!data) return res.status(404).json({ error: "Không tìm thấy thiết bị." });
  res.json(data);
});

app.get("/api/qr/device/:id", (req, res) => {
  const data = getQrDevicePayload(req.params.id);
  if (!data) return res.status(404).json({ error: "Không tìm thấy thiết bị." });
  res.json(data);
});

app.get("/api/qr/device-code/:code", (req, res) => {
  const row = db.prepare("SELECT id FROM devices WHERE device_code=?").get(req.params.code);
  if (!row) return res.status(404).json({ error: "Không tìm thấy thiết bị." });
  const data = getQrDevicePayload(row.id);
  res.json(data);
});

app.post("/api/qr/checks", uploadIncidentMedia.array("media", 6), (req, res) => {
  try {
    const p = req.body || {};
    const deviceId = Number(req.qy4QrDeviceId || 0);
    const condition = String(p.condition || "").trim();
    const inspectorInput = String(p.inspector || "").trim().slice(0, 120);
    const inspector = inspectorInput ? `QR công khai (tự khai) - ${inspectorInput}` : "";
    const reporterPhone = String(p.reporter_phone || "").trim().slice(0, 40);
    validateIncidentFiles(req.files);
    if (!deviceId) return res.status(400).json({ error: "Thiếu thiết bị." });
    if (!inspector) return res.status(400).json({ error: "Vui lòng nhập tên người kiểm tra." });
    const normalizedCondition = condition === "Tốt" ? "Bình thường" : condition;
    if (!["Bình thường", "Có vấn đề"].includes(normalizedCondition)) return res.status(400).json({ error: "Tình trạng kiểm tra không hợp lệ." });
    const description = String(p.description || "").trim().slice(0, 2000);
    p.note = String(p.note || "").trim().slice(0, 2000);
    if (normalizedCondition === "Có vấn đề" && !description) {
      return res.status(400).json({ error: "Vui lòng nhập mô tả vấn đề." });
    }
    const device = db.prepare("SELECT * FROM devices WHERE id=?").get(deviceId);
    if (!device) return res.status(404).json({ error: "Không tìm thấy thiết bị." });
    const files = req.files || [];
    const noteParts = [];
    if (description) noteParts.push(`Mô tả: ${description}`);
    if (p.note) noteParts.push(`Ghi chú: ${p.note}`);
    const resultText = normalizedCondition === "Bình thường" ? "Bình thường" : "Có vấn đề";
    const info = db.prepare(`
      INSERT INTO daily_checks (device_id,check_datetime,inspector,content,result,note)
      VALUES (?,?,?,?,?,?)
    `).run(deviceId, nowSql(), inspector, "Kiểm tra nhanh bằng mã QR", resultText, noteParts.join("\n"));
    for (const file of files) {
      db.prepare(`
        INSERT INTO documents (device_id,name,type,doc_date,updated_by,note,original_name,stored_name,file_path,file_mime,file_size)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(deviceId, `Ảnh/Video kiểm tra - ${nowSql().slice(0,10)}`, "Kiểm tra", nowSql().slice(0,10), inspector, p.note || description || "Tệp đính kèm từ kiểm tra", file.originalname, file.filename, `/uploads/qr/${file.filename}`, file.mimetype, file.size);
    }
    writeHistory("check", info.lastInsertRowid, inspector, "Tạo từ QR", "", resultText, description || p.note || "Kiểm tra nhanh thiết bị");
    let incidentId = null;
    if ((p.create_incident === "1" || p.create_incident === "true" || normalizedCondition === "Có vấn đề") && normalizedCondition === "Có vấn đề") {
      const severity = ["Thấp","Trung bình","Cao"].includes(String(p.severity || "")) ? String(p.severity) : "Trung bình";
      const inc = db.prepare(`
        INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,reporter_phone,status,note,local_resolution_note)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(deviceId, nowSql(), description || `Kiểm tra: ${condition}`, severity, inspector, reporterPhone, "Mới ghi nhận", p.note || "Tạo từ kiểm tra thiết bị", "");
      incidentId = inc.lastInsertRowid;
      completeIncidentRow(incidentId, deviceId, inspector, nowSql());
      saveIncidentFiles(incidentId, deviceId, files);
    }
    res.json({ ok: true, check_id: info.lastInsertRowid, incident_id: incidentId });
  } catch (e) {
    console.error("POST /api/qr/checks error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/qr/incidents", uploadIncidentMedia.array("media", 6), (req, res) => {
  try {
    const p = req.body || {};
    const deviceId = Number(p.device_id || 0);
    const reporter = String(p.reporter || "").trim();
    const description = String(p.description || "").trim();
    const severity = String(p.severity || "Trung bình").trim();
    const reporterPhone = String(p.reporter_phone || "").trim();
    validateIncidentFiles(req.files);
    if (!deviceId) return res.status(400).json({ error: "Thiếu thiết bị." });
    if (!reporter) return res.status(400).json({ error: "Vui lòng nhập người báo." });
    if (!description) return res.status(400).json({ error: "Vui lòng nhập mô tả sự cố." });
    if (!["Thấp","Trung bình","Cao"].includes(severity)) return res.status(400).json({ error: "Mức độ không hợp lệ." });
    const device = db.prepare("SELECT * FROM devices WHERE id=?").get(deviceId);
    if (!device) return res.status(404).json({ error: "Không tìm thấy thiết bị." });
    const files = req.files || [];
    const noteParts = [];
    if (p.note) noteParts.push(String(p.note));
    const info = db.prepare(`
      INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,reporter_phone,status,note,local_resolution_note)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(deviceId, nowSql(), description, severity, reporter, reporterPhone, "Mới ghi nhận", noteParts.join("\n"), "");
    completeIncidentRow(info.lastInsertRowid, deviceId, reporter, nowSql());
    saveIncidentFiles(info.lastInsertRowid, deviceId, files);
    for (const file of files) {
      db.prepare(`
        INSERT INTO documents (device_id,name,type,doc_date,updated_by,note,original_name,stored_name,file_path,file_mime,file_size)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(deviceId, `Ảnh/Video sự cố QR - ${nowSql().slice(0,10)}`, "Sự cố QR", nowSql().slice(0,10), reporter, p.note || description, file.originalname, file.filename, `/uploads/qr/${file.filename}`, file.mimetype, file.size);
    }
    res.json({ ok: true, incident_id: info.lastInsertRowid });
  } catch (e) {
    console.error("POST /api/qr/incidents error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/checks", (req, res) => {
  const { preset = "today", date, from_date, to_date } = req.query;
  const { start, end } = dateRangeFromPreset(preset, date, from_date, to_date);
  const rows = db.prepare(`
    SELECT c.*, dv.name AS device_name, dv.department_code, dv.group_code
    FROM daily_checks c JOIN devices dv ON dv.id = c.device_id
    WHERE substr(c.check_datetime,1,10) >= ? AND substr(c.check_datetime,1,10) <= ?
    ORDER BY c.check_datetime DESC, c.id DESC
  `).all(start, end).map(r => ({ ...r, device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/checks", (req, res) => {
  const p = req.body;
  const info = db.prepare(`
    INSERT INTO daily_checks (device_id,check_datetime,inspector,content,result,note)
    VALUES (@device_id,@check_datetime,@inspector,@content,@result,@note)
  `).run(p);
  writeHistory("check", info.lastInsertRowid, p.inspector, "Tạo mới", "", p.result, p.content || p.note || "");
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/checks/:id", (req, res) => {
  const p = req.body;
  const old = db.prepare("SELECT * FROM daily_checks WHERE id=?").get(req.params.id) || {};
  db.prepare(`
    UPDATE daily_checks
    SET check_datetime=@check_datetime, inspector=@inspector, content=@content, result=@result, note=@note
    WHERE id=@id
  `).run({ ...p, id: Number(req.params.id) });
  writeHistory("check", Number(req.params.id), p.inspector, "Cập nhật", old.result || "", p.result || "", p.content || p.note || "");
  res.json({ ok: true });
});

app.delete("/api/checks/:id", (req, res) => {
  const old = db.prepare("SELECT * FROM daily_checks WHERE id=?").get(req.params.id);
  if (old) writeHistory("check", Number(req.params.id), old.inspector, "Xóa", old.result || "", "", old.content || old.note || "");
  db.prepare("DELETE FROM daily_checks WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

function validateIncidentFiles(files){
  const list = Array.isArray(files) ? files : [];
  const images = list.filter(f => String(f.mimetype||"").startsWith("image/"));
  const videos = list.filter(f => String(f.mimetype||"").startsWith("video/") || /\.(mp4|mov)$/i.test(f.originalname||""));
  if (images.length > 5) throw new Error("Chỉ được tải tối đa 5 ảnh cho mỗi sự cố.");
  if (videos.length > 1) throw new Error("Chỉ được tải tối đa 1 video cho mỗi sự cố.");
  for (const f of images) if (f.size > 5 * 1024 * 1024) throw new Error("Mỗi ảnh tối đa 5MB.");
  for (const f of videos) if (f.size > 30 * 1024 * 1024) throw new Error("Video tối đa 30MB.");
}
function saveIncidentFiles(incidentId, deviceId, files){
  const list = Array.isArray(files) ? files : [];
  const stmt = db.prepare(`INSERT INTO incident_files (incident_id,device_id,original_name,stored_name,file_path,file_mime,file_size,uploaded_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const f of list) stmt.run(incidentId, deviceId, f.originalname, f.filename, `/uploads/qr/${f.filename}`, f.mimetype, f.size, nowSql());
}
function getIncidentFilesMap(ids){
  if (!ids || !ids.length) return {};
  const placeholders = ids.map(()=>"?").join(",");
  const rows = db.prepare(`SELECT * FROM incident_files WHERE incident_id IN (${placeholders}) ORDER BY id`).all(...ids);
  const map = {};
  for (const r of rows) {
    if (!map[r.incident_id]) map[r.incident_id] = [];
    map[r.incident_id].push(r);
  }
  return map;
}

app.get("/api/incidents", (req, res) => {
  // Nếu frontend không truyền khoảng ngày thì trả toàn bộ sự cố.
  // Trước đây route mặc định preset=today/last7 làm bản ghi vừa tạo dễ “mất” khỏi bảng
  // khi người dùng nhập thời gian ngoài 7 ngày hoặc bộ lọc đang rộng hơn dữ liệu tải về.
  const { preset, date, from_date, to_date } = req.query;
  let sql = `
    SELECT i.*, dv.name AS device_name, dv.department_code, dv.group_code, dv.location, dv.model, dv.serial,
           d.name AS department_name, g.name AS group_name,
           lr.id AS linked_repair_id,
           lr.processing_status AS linked_repair_status
    FROM incidents i
    JOIN devices dv ON dv.id = i.device_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    LEFT JOIN (
      SELECT incident_id, MAX(id) AS max_repair_id
      FROM repairs
      WHERE incident_id IS NOT NULL
      GROUP BY incident_id
    ) lrm ON lrm.incident_id = i.id
    LEFT JOIN repairs lr ON lr.id = lrm.max_repair_id
  `;
  const params = [];
  if (preset || date || from_date || to_date) {
    const { start, end } = dateRangeFromPreset(preset || "custom", date, from_date, to_date);
    sql += ` WHERE substr(i.incident_datetime,1,10) >= ? AND substr(i.incident_datetime,1,10) <= ?`;
    params.push(start, end);
  }
  sql += ` ORDER BY i.incident_datetime DESC, i.id DESC`;
  const baseRows = db.prepare(sql).all(...params);
  const fileMap = getIncidentFilesMap(baseRows.map(r => r.id));
  const rows = baseRows.map(r => {
    const files = fileMap[r.id] || [];
    return {
      ...r,
      status: normalizeIncidentStatusForUi(r.status, r.linked_repair_id),
      device_code: getDeviceCode(r.device_id),
      files,
      media_count: files.length,
      first_media_path: files[0]?.file_path || "",
      has_video: files.some(f => String(f.file_mime||"").startsWith("video/") || /\.(mp4|mov)$/i.test(f.original_name||""))
    };
  });
  res.json(rows);
});

app.post("/api/incidents", uploadIncidentMedia.array("media", 6), (req, res, next) => {
  if (req.qy4User && !p2Security.isTech(req.qy4User)) {
    const deviceScope = db.prepare("SELECT department_code FROM devices WHERE id=?").get(Number(req.body?.device_id || 0));
    if (!deviceScope || deviceScope.department_code !== req.qy4User.department_code) {
      return res.status(403).json({ error: "Thiết bị không thuộc khoa được cấp cho tài khoản này." });
    }
  }
  next();
}, (req, res) => {
  try {
    const p = req.body || {};
    validateIncidentFiles(req.files);
    const missing = requireFields(p, ["device_id", "incident_datetime", "description", "severity", "reporter", "status"]);
    if (missing.length) return res.status(400).json({ error: `Thiếu thông tin bắt buộc: ${missing.join(", ")}` });
    const payload = {
      device_id: Number(p.device_id),
      incident_datetime: normalizeDateTime(p.incident_datetime),
      description: String(p.description || "").trim(),
      severity: p.severity || "Trung bình",
      reporter: String(p.reporter || "").trim(),
      reporter_phone: String(p.reporter_phone || "").trim(),
      status: normalizeIncidentPayloadStatus(p.status || "Mới ghi nhận", "Mới ghi nhận", null),
      note: p.note || "",
      local_resolution_note: p.local_resolution_note || ""
    };
    const deviceExists = db.prepare("SELECT id FROM devices WHERE id=?").get(payload.device_id);
    if (!deviceExists) return res.status(400).json({ error: "Thiết bị không tồn tại." });
    const info = db.prepare(`
      INSERT INTO incidents (device_id,incident_datetime,description,severity,reporter,reporter_phone,status,note,local_resolution_note)
      VALUES (@device_id,@incident_datetime,@description,@severity,@reporter,@reporter_phone,@status,@note,@local_resolution_note)
    `).run(payload);
    completeIncidentRow(info.lastInsertRowid, payload.device_id, payload.reporter, payload.incident_datetime);
    saveIncidentFiles(info.lastInsertRowid, payload.device_id, req.files);
    const row = db.prepare(`
      SELECT i.*, dv.name AS device_name, dv.department_code, dv.group_code, dv.location, dv.model, dv.serial,
             d.name AS department_name, g.name AS group_name,
             lr.id AS linked_repair_id,
             lr.processing_status AS linked_repair_status
      FROM incidents i
      JOIN devices dv ON dv.id = i.device_id
      LEFT JOIN departments d ON d.code = dv.department_code
      LEFT JOIN device_groups g ON g.code = dv.group_code
      LEFT JOIN repairs lr ON lr.incident_id = i.id
      WHERE i.id=?
      ORDER BY lr.id DESC
    `).get(info.lastInsertRowid);
    res.json({ ok: true, id: info.lastInsertRowid, row: { ...row, status: normalizeIncidentStatusForUi(row.status, row.linked_repair_id), device_code: getDeviceCode(row.device_id) } });
  } catch (e) {
    console.error("POST /api/incidents error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/incidents/:id", uploadIncidentMedia.array("media", 6), (req, res, next) => {
  if (req.qy4User && !p2Security.isTech(req.qy4User)) {
    const oldScope = db.prepare("SELECT dv.department_code FROM incidents i JOIN devices dv ON dv.id=i.device_id WHERE i.id=?").get(Number(req.params.id));
    const newScope = db.prepare("SELECT department_code FROM devices WHERE id=?").get(Number(req.body?.device_id || 0));
    if (!oldScope || oldScope.department_code !== req.qy4User.department_code || !newScope || newScope.department_code !== req.qy4User.department_code) {
      return res.status(403).json({ error: "Sự cố hoặc thiết bị không thuộc khoa được cấp cho tài khoản này." });
    }
  }
  next();
}, (req, res) => {
  try {
    const p = req.body || {};
    validateIncidentFiles(req.files);
    const old = db.prepare("SELECT * FROM incidents WHERE id=?").get(req.params.id);
    if (!old) return res.status(404).json({ error: "Không tìm thấy sự cố." });
    const linkedRepairForIncident = db.prepare("SELECT id FROM repairs WHERE incident_id=? ORDER BY id DESC LIMIT 1").get(old.id);
    if (linkedRepairForIncident && Number(p.device_id) !== Number(old.device_id)) {
      return res.status(409).json({ error: "Sự cố đã liên kết phiếu sửa chữa nên không được đổi thiết bị." });
    }
    const missing = requireFields(p, ["device_id", "incident_datetime", "description", "severity", "reporter", "status"]);
    if (missing.length) return res.status(400).json({ error: `Thiếu thông tin bắt buộc: ${missing.join(", ")}` });
    const payload = {
      id: Number(req.params.id),
      device_id: Number(p.device_id),
      incident_datetime: normalizeDateTime(p.incident_datetime),
      description: String(p.description || "").trim(),
      severity: p.severity || "Trung bình",
      reporter: String(p.reporter || "").trim(),
      reporter_phone: String(p.reporter_phone || old.reporter_phone || "").trim(),
      status: normalizeIncidentPayloadStatus(p.status || old.status || "Mới ghi nhận", old.status || "Mới ghi nhận", db.prepare("SELECT id FROM repairs WHERE incident_id=? ORDER BY id DESC LIMIT 1").get(Number(req.params.id))?.id),
      note: p.note || "",
      local_resolution_note: p.local_resolution_note || old.local_resolution_note || ""
    };
    db.prepare(`
      UPDATE incidents
      SET device_id=@device_id, incident_datetime=@incident_datetime, description=@description, severity=@severity, reporter=@reporter, reporter_phone=@reporter_phone, status=@status, note=@note, local_resolution_note=@local_resolution_note
      WHERE id=@id
    `).run(payload);
    touchIncident(Number(req.params.id), payload.device_id, payload.reporter);
    saveIncidentFiles(Number(req.params.id), payload.device_id, req.files);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/incidents/:id error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/incidents/:id/transfer-repair", (req, res) => {
  try {
    const incident = db.prepare("SELECT * FROM incidents WHERE id=?").get(req.params.id);
    if (!incident) return res.status(404).json({ error: "Không tìm thấy sự cố." });
    if (incident.status === "Đã xử lý tại chỗ") return res.status(400).json({ error: "Sự cố đã xử lý tại chỗ, không chuyển sửa chữa." });
    const existed = db.prepare("SELECT id FROM repairs WHERE incident_id=? ORDER BY id DESC LIMIT 1").get(incident.id);
    if (existed) return res.json({ ok: true, repair_id: existed.id, existed: true });
    const actor = req.body?.actor || incident.reporter || "";
    const payload = {
      device_id: Number(incident.device_id),
      repair_date: normalizeDateTime(req.body?.repair_date || incident.incident_datetime || nowSql()),
      issue: incident.description || "",
      work: "Chờ kiểm tra và xử lý kỹ thuật",
      person: actor || "Khoa Trang bị",
      method: "Nội bộ",
      cost: 0,
      result: "",
      status_after: "Chờ sửa chữa",
      processing_status: "Đang xử lý",
      incident_id: Number(incident.id),
      received_at: normalizeDateTime(req.body?.repair_date || nowSql()),
      updated_at: nowSql(),
      completed_at: ""
    };
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO repairs (device_id, repair_date, issue, work, person, method, cost, result, status_after, processing_status, incident_id, received_at, updated_at, completed_at)
        VALUES (@device_id, @repair_date, @issue, @work, @person, @method, @cost, @result, @status_after, @processing_status, @incident_id, @received_at, @updated_at, @completed_at)
      `).run(payload);
      db.prepare("UPDATE incidents SET status=? WHERE id=?").run("Đã chuyển sửa chữa", incident.id);
      db.prepare("UPDATE devices SET status=? WHERE id=?").run("Chờ sửa chữa", incident.device_id);
      writeHistory("repair", info.lastInsertRowid, "Hệ thống", "Tạo từ sự cố", "", payload.processing_status, `Tạo phiếu sửa chữa từ sự cố ${incident.incident_code || ('#' + incident.id)}`, 0, "Tự động", payload.received_at);
      return info.lastInsertRowid;
    });
    const repairId = tx();
    res.json({ ok: true, repair_id: repairId });
  } catch (e) {
    console.error("POST /api/incidents/:id/transfer-repair error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/incidents/:id", (req, res) => {
  const linked = db.prepare("SELECT COUNT(*) c FROM repairs WHERE incident_id=?").get(req.params.id).c;
  if (linked > 0) return res.status(400).json({ error: "Sự cố đã chuyển sửa chữa, không thể xóa. Vui lòng xử lý trong phiếu sửa chữa." });
  db.prepare("DELETE FROM incidents WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});


app.get("/api/checks/:id/history", (req, res) => {
  const rows = db.prepare(`SELECT * FROM activity_history WHERE module='check' AND record_id=? ORDER BY action_time DESC, id DESC`).all(req.params.id);
  res.json(rows);
});



function getDepartmentRows(scopeCode = "ALL") {
  const rows = db.prepare("SELECT code, name FROM departments ORDER BY code").all();
  return scopeCode && scopeCode !== "ALL" ? rows.filter(x => x.code === scopeCode) : rows;
}
function getGroupRows(scopeCode = "ALL") {
  const rows = db.prepare("SELECT code, name FROM device_groups ORDER BY code").all();
  return scopeCode && scopeCode !== "ALL" ? rows.filter(x => x.code === scopeCode) : rows;
}
function getScopedDevices(scopeDepartment = "ALL", scopeGroup = "ALL") {
  let rows = db.prepare(`
    SELECT dv.id, dv.name, dv.department_code, dv.group_code
    FROM devices dv
    ORDER BY dv.id
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.id) }));
  if (scopeDepartment && scopeDepartment !== "ALL") rows = rows.filter(x => x.department_code === scopeDepartment);
  if (scopeGroup && scopeGroup !== "ALL") rows = rows.filter(x => x.group_code === scopeGroup);
  return rows;
}
function styleTemplateSheet(ws) {
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const header = ws.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F4E78" } };
  header.eachCell(cell => {
    cell.border = {
      top: { style: "thin", color: { argb: "D9E2F3" } },
      left: { style: "thin", color: { argb: "D9E2F3" } },
      bottom: { style: "thin", color: { argb: "D9E2F3" } },
      right: { style: "thin", color: { argb: "D9E2F3" } }
    };
  });
}
function addListValidation(ws, startCol, endCol, formulaName, startRow = 2, endRow = 500) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      ws.getCell(`${col}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`=${formulaName}`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Giá trị không hợp lệ",
        error: "Vui lòng chọn giá trị trong danh sách có sẵn."
      };
    }
  }
}
async function buildExcelTemplate(kind, scopeDepartment = "ALL", scopeGroup = "ALL") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ChatGPT";
  workbook.company = "Bệnh viện Quân y 4";
  workbook.created = new Date();

  const listSheet = workbook.addWorksheet("DanhMuc");
  listSheet.state = "hidden";

  const departments = getDepartmentRows(scopeDepartment);
  const groups = getGroupRows(scopeGroup);
  const devices = getScopedDevices(scopeDepartment, scopeGroup);

  listSheet.getCell("A1").value = "Khoa/phòng";
  departments.forEach((d, i) => listSheet.getCell(`A${i+2}`).value = d.name);

  listSheet.getCell("B1").value = "Nhóm thiết bị";
  groups.forEach((g, i) => listSheet.getCell(`B${i+2}`).value = g.name);

  listSheet.getCell("C1").value = "Mã thiết bị";
  devices.forEach((d, i) => listSheet.getCell(`C${i+2}`).value = d.device_code);

  listSheet.getCell("D1").value = "Tình trạng";
  ["Đang hoạt động","Chờ sửa chữa","Ngừng hoạt động"].forEach((v, i) => listSheet.getCell(`D${i+2}`).value = v);

  listSheet.getCell("E1").value = "Hình thức";
  ["Nội bộ","Thuê ngoài","Thay thế linh kiện","Nâng cấp thiết bị"].forEach((v, i) => listSheet.getCell(`E${i+2}`).value = v);

  listSheet.getCell("F1").value = "Loại thực hiện";
  ["Bảo dưỡng định kỳ","Vệ sinh thiết bị","Thay vật tư định kỳ","Kiểm tra an toàn điện","Kiểm tra chất lượng","Cập nhật phần mềm"].forEach((v, i) => listSheet.getCell(`F${i+2}`).value = v);

  listSheet.getCell("G1").value = "Đánh giá";
  ["Đạt","Đạt có lưu ý","Không đạt","Cần theo dõi thêm"].forEach((v, i) => listSheet.getCell(`G${i+2}`).value = v);

  workbook.definedNames.add("DepartmentList", `DanhMuc!$A$2:$A$${Math.max(2, departments.length+1)}`);
  workbook.definedNames.add("GroupList", `DanhMuc!$B$2:$B$${Math.max(2, groups.length+1)}`);
  workbook.definedNames.add("DeviceList", `DanhMuc!$C$2:$C$${Math.max(2, devices.length+1)}`);
  workbook.definedNames.add("StatusList", `DanhMuc!$D$2:$D$5`);
  workbook.definedNames.add("MethodList", `DanhMuc!$E$2:$E$5`);
  workbook.definedNames.add("MaintenanceTypeList", `DanhMuc!$F$2:$F$7`);
  workbook.definedNames.add("MaintenanceResultList", `DanhMuc!$G$2:$G$5`);

  if (kind === "devices") {
    const ws = workbook.addWorksheet("Template");
    ws.columns = [
      { header: "Khoa/phòng", key: "department_name", width: 28 },
      { header: "Nhóm thiết bị", key: "group_name", width: 22 },
      { header: "Tên thiết bị", key: "name", width: 32 },
      { header: "Hãng sản xuất", key: "manufacturer", width: 22 },
      { header: "Model", key: "model", width: 20 },
      { header: "Serial", key: "serial", width: 22 },
      { header: "Nước sản xuất", key: "country", width: 18 },
      { header: "Năm sản xuất", key: "year_manufactured", width: 14 },
      { header: "Năm sử dụng", key: "year_in_use", width: 14 },
      { header: "Hạn bảo hành", key: "warranty_end", width: 16 },
      { header: "Tình trạng", key: "status", width: 20 },
      { header: "Nguyên giá", key: "cost", width: 14 },
      { header: "Nguồn kinh phí", key: "funding", width: 20 },
      { header: "Vị trí đặt máy", key: "location", width: 22 },
      { header: "Ghi chú", key: "note", width: 26 }
    ];
    styleTemplateSheet(ws);
    ws.getRow(2).values = [
      departments[0]?.name || "",
      groups[0]?.name || "",
      "Máy CT Scanner 64 lát",
      "Canon Medical",
      "Aquilion Prime SP",
      "CT-NEW-001",
      "Nhật Bản",
      2025,
      2026,
      "2027-12-31",
      "Đang hoạt động",
      0,
      "",
      "Phòng CT",
      ""
    ];
    addListValidation(ws, "A", "A", "DepartmentList");
    addListValidation(ws, "B", "B", "GroupList");
    addListValidation(ws, "K", "K", "StatusList");
    ws.getCell("Q1").value = "Lưu ý";
    ws.getCell("Q2").value = "Bấm vào từng ô dữ liệu từ dòng 2 trở xuống để hiện danh sách chọn sẵn.";
  }

  if (kind === "repairs") {
    const ws = workbook.addWorksheet("Template");
    ws.columns = [
      { header: "Ngày", key: "repair_date", width: 14 },
      { header: "Khoa/phòng", key: "department_name", width: 28 },
      { header: "Nhóm thiết bị", key: "group_name", width: 22 },
      { header: "Mã thiết bị", key: "device_code", width: 18 },
      { header: "Tình trạng / nguyên nhân hỏng", key: "issue", width: 34 },
      { header: "Nội dung sửa chữa", key: "work", width: 30 },
      { header: "Người thực hiện", key: "person", width: 20 },
      { header: "Hình thức", key: "method", width: 18 },
      { header: "Kinh phí", key: "cost", width: 14 },
      { header: "Kết quả", key: "result", width: 22 },
      { header: "TTTB sau sửa chữa", key: "status_after", width: 22 }
    ];
    styleTemplateSheet(ws);
    ws.getRow(2).values = [
      "2026-04-12",
      departments[0]?.name || "",
      groups[0]?.name || "",
      devices[0]?.device_code || "",
      "Sai lệch chỉ số oxy",
      "Thay cảm biến oxy",
      "Tổ TTBYT",
      "Nội bộ",
      0,
      "Đã xử lý",
      "Đang hoạt động"
    ];
    addListValidation(ws, "B", "B", "DepartmentList");
    addListValidation(ws, "C", "C", "GroupList");
    addListValidation(ws, "D", "D", "DeviceList");
    addListValidation(ws, "H", "H", "MethodList");
    addListValidation(ws, "K", "K", "StatusList");
  }

  if (kind === "maintenances") {
    const ws = workbook.addWorksheet("Template");
    ws.columns = [
      { header: "Ngày thực hiện", key: "maintenance_date", width: 16 },
      { header: "Khoa/phòng", key: "department_name", width: 28 },
      { header: "Nhóm thiết bị", key: "group_name", width: 22 },
      { header: "Mã thiết bị", key: "device_code", width: 18 },
      { header: "Loại", key: "type", width: 24 },
      { header: "Nội dung", key: "content", width: 32 },
      { header: "Đánh giá", key: "result", width: 18 },
      { header: "Người thực hiện", key: "performer", width: 20 },
      { header: "Người sử dụng xác nhận", key: "user_confirm", width: 24 },
      { header: "Đơn vị / NCC", key: "vendor", width: 22 },
      { header: "Đến hạn tiếp theo", key: "next_date", width: 18 },
      { header: "Ghi chú", key: "note", width: 24 }
    ];
    styleTemplateSheet(ws);
    ws.getRow(2).values = [
      "2026-04-12",
      departments[0]?.name || "",
      groups[0]?.name || "",
      devices[0]?.device_code || "",
      "Bảo dưỡng định kỳ",
      "Kiểm tra hệ thống và hiệu chỉnh cơ bản",
      "Đạt",
      "Tổ TTBYT",
      "KTV CĐHA",
      "Nội bộ",
      "2026-10-12",
      ""
    ];
    addListValidation(ws, "B", "B", "DepartmentList");
    addListValidation(ws, "C", "C", "GroupList");
    addListValidation(ws, "D", "D", "DeviceList");
    addListValidation(ws, "E", "E", "MaintenanceTypeList");
    addListValidation(ws, "G", "G", "MaintenanceResultList");
  }

  return workbook;
}


app.get("/api/inspections", (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, dv.name AS device_name, dv.department_code, dv.group_code, d.name AS department_name, g.name AS group_name
    FROM inspections i
    JOIN devices dv ON dv.id = i.device_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    WHERE COALESCE(i.cancelled_at,'') = ''
    ORDER BY COALESCE(i.next_date, i.inspection_date) ASC, i.id DESC
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/inspections", (req, res) => {
  const p = req.body;
  const info = db.prepare(`INSERT INTO inspections (device_id,inspection_date,type,organization,certificate_no,result,next_date,file_note,note) VALUES (@device_id,@inspection_date,@type,@organization,@certificate_no,@result,@next_date,@file_note,@note)`).run(p);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/inspections/:id", (req, res) => {
  const p = req.body;
  db.prepare(`UPDATE inspections SET device_id=@device_id, inspection_date=@inspection_date, type=@type, organization=@organization, certificate_no=@certificate_no, result=@result, next_date=@next_date, file_note=@file_note, note=@note WHERE id=@id`).run({ ...p, id: Number(req.params.id) });
  res.json({ ok: true });
});

app.delete("/api/inspections/:id", (req, res) => {
  const old = db.prepare("SELECT * FROM inspections WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "Không tìm thấy hồ sơ kiểm định." });
  const reason = String(req.body?.reason || "Hủy hồ sơ nhập nhầm").trim();
  db.prepare("UPDATE inspections SET cancelled_at=?, cancel_reason=? WHERE id=?").run(nowSql(), reason, req.params.id);
  writeHistory("inspection", Number(req.params.id), old.organization || "Khoa Trang bị", "Hủy hồ sơ", old.result || "", "Đã hủy", reason);
  logAudit("inspection", Number(req.params.id), "Hủy hồ sơ", reason);
  res.json({ ok: true });
});

app.get("/api/quality-ratings", (req, res) => {
  const rows = db.prepare(`
    SELECT q.*, dv.name AS device_name, dv.department_code, dv.group_code, d.name AS department_name, g.name AS group_name
    FROM quality_ratings q
    JOIN devices dv ON dv.id = q.device_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    ORDER BY q.total_score ASC, q.id DESC
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/quality-ratings", (req, res) => {
  const p = req.body;
  const total = Number(p.age_score||0)+Number(p.performance_score||0)+Number(p.repair_score||0)+Number(p.inspection_score||0)+Number(p.sparepart_score||0);
  const grade = total >= 90 ? "A" : total >= 80 ? "B" : total >= 65 ? "C" : "D";
  const info = db.prepare(`INSERT OR REPLACE INTO quality_ratings (id,device_id,rating_date,age_score,performance_score,repair_score,inspection_score,sparepart_score,total_score,grade,recommendation,evaluator,note) VALUES ((SELECT id FROM quality_ratings WHERE device_id=@device_id),@device_id,@rating_date,@age_score,@performance_score,@repair_score,@inspection_score,@sparepart_score,@total_score,@grade,@recommendation,@evaluator,@note)`).run({ ...p, total_score: total, grade });
  res.json({ id: info.lastInsertRowid, total_score: total, grade });
});

app.delete("/api/quality-ratings/:id", (req, res) => {
  db.prepare("DELETE FROM quality_ratings WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/usage-reports", (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, dv.name AS device_name, dv.department_code, dv.group_code, d.name AS department_name, g.name AS group_name
    FROM usage_reports u
    JOIN devices dv ON dv.id = u.device_id
    LEFT JOIN departments d ON d.code = dv.department_code
    LEFT JOIN device_groups g ON g.code = dv.group_code
    ORDER BY u.year DESC, u.month DESC, u.id DESC
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.device_id) }));
  res.json(rows);
});

app.post("/api/usage-reports", (req, res) => {
  const p = req.body;
  const info = db.prepare(`INSERT INTO usage_reports (device_id,year,month,indicator,value,unit,note) VALUES (@device_id,@year,@month,@indicator,@value,@unit,@note)`).run(p);
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/usage-reports/:id", (req, res) => {
  db.prepare("DELETE FROM usage_reports WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/leadership-dashboard", (req, res) => {
  const devices = db.prepare("SELECT * FROM devices").all();
  const total = devices.length;
  const totalCost = devices.reduce((s,d)=>s+Number(d.cost||0),0);
  const active = devices.filter(d=>d.status === "Đang hoạt động").length;
  const repair = devices.filter(d=>d.status === "Chờ sửa chữa").length;
  const old10 = devices.filter(d=>Number(d.year_in_use||0) && (new Date().getFullYear() - Number(d.year_in_use)) > 10).length;
  const today = new Date().toISOString().slice(0,10);
  const plus30 = new Date(Date.now()+30*24*3600*1000).toISOString().slice(0,10);
  const dueInspections = db.prepare("SELECT COUNT(*) c FROM inspections WHERE next_date >= ? AND next_date <= ?").get(today, plus30).c;
  const overdueInspections = db.prepare("SELECT COUNT(*) c FROM inspections WHERE next_date < ?").get(today).c;
  const dueMaint = db.prepare("SELECT COUNT(*) c FROM maintenances WHERE next_date >= ? AND next_date <= ?").get(today, plus30).c;
  const overdueMaint = db.prepare("SELECT COUNT(*) c FROM maintenances WHERE next_date < ?").get(today).c;
  const quality = db.prepare("SELECT quality_level AS grade, COUNT(*) c FROM devices GROUP BY quality_level ORDER BY quality_level").all();
  const byDept = db.prepare(`SELECT d.code, d.name, COUNT(dv.id) count, SUM(COALESCE(dv.cost,0)) cost FROM departments d LEFT JOIN devices dv ON dv.department_code=d.code GROUP BY d.code,d.name ORDER BY count DESC`).all();
  const byStatus = db.prepare("SELECT COALESCE(status,'Chưa rõ') status, COUNT(*) count FROM devices GROUP BY status ORDER BY count DESC").all();
  const openIncidents = db.prepare("SELECT COUNT(*) c FROM incidents WHERE COALESCE(status,'') NOT IN ('Đã xử lý tại chỗ','Đã chuyển sửa chữa')").get().c;
  const openRepairs = db.prepare("SELECT COUNT(*) c FROM repairs WHERE COALESCE(processing_status,'Đang xử lý') NOT IN ('Đã hoàn thành','Không sửa được')").get().c;
  const repairCost = db.prepare("SELECT COALESCE(SUM(cost),0) c FROM repairs").get().c;
  const alerts = buildOperationalAlerts(12);
  res.json({ total, totalCost, active, repair, old10, dueInspections, overdueInspections, dueMaint, overdueMaint, quality, byDept, byStatus, openIncidents, openRepairs, repairCost, alerts });
});

app.get("/api/reports/summary", (req, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const days = Number(req.query.days || 60);
  const future = new Date(now.getTime() + days * 86400000).toISOString().slice(0,10);
  const devices = db.prepare(`
    SELECT dv.*, d.name AS department_name, g.name AS group_name
    FROM devices dv
    LEFT JOIN departments d ON d.code=dv.department_code
    LEFT JOIN device_groups g ON g.code=dv.group_code
    ORDER BY dv.id
  `).all().map(enrichDevice);
  const maint = db.prepare("SELECT device_id, MAX(substr(maintenance_date,1,10)) last_date, MAX(next_date) next_date FROM maintenances GROUP BY device_id").all();
  const insp = db.prepare("SELECT device_id, MAX(substr(inspection_date,1,10)) last_date, MAX(next_date) next_date FROM inspections GROUP BY device_id").all();
  const repairs = db.prepare("SELECT device_id, COUNT(*) repair_count, SUM(cost) total_cost FROM repairs GROUP BY device_id").all();
  const maintMap = new Map(maint.map(x => [Number(x.device_id), x]));
  const inspMap = new Map(insp.map(x => [Number(x.device_id), x]));
  const repairMap = new Map(repairs.map(x => [Number(x.device_id), x]));
  const enriched = devices.map(d => ({...d, maintenance: maintMap.get(d.id) || {}, inspection: inspMap.get(d.id) || {}, repair: repairMap.get(d.id) || {repair_count:0,total_cost:0}}));
  const warrantySoon = enriched.filter(d => d.warranty_end && d.warranty_end >= today && d.warranty_end <= future);
  const maintenanceOverdue = enriched.filter(d => d.maintenance.next_date && d.maintenance.next_date < today);
  const inspectionOverdue = enriched.filter(d => d.inspection.next_date && d.inspection.next_date < today);
  const frequentRepairs = enriched.filter(d => Number(d.repair.repair_count || 0) >= 2).sort((a,b)=>Number(b.repair.repair_count)-Number(a.repair.repair_count));
  const replaceList = enriched.filter(d => ["Chờ sửa chữa","Ngừng hoạt động","Hoạt động hạn chế"].includes(d.status) || Number(d.quality_level || 3) >= 4 || Number(d.repair.repair_count || 0) >= 3);
  const costByDepartment = db.prepare(`
    SELECT dv.department_code, d.name AS department_name, COUNT(r.id) repair_count, SUM(COALESCE(r.cost,0)) total_cost
    FROM repairs r JOIN devices dv ON dv.id=r.device_id LEFT JOIN departments d ON d.code=dv.department_code
    GROUP BY dv.department_code ORDER BY total_cost DESC
  `).all();
  const statusRatio = db.prepare("SELECT COALESCE(status,'Chưa rõ') status, COUNT(*) count FROM devices GROUP BY status ORDER BY count DESC").all();
  res.json({ warrantySoon, maintenanceOverdue, inspectionOverdue, frequentRepairs, replaceList, costByDepartment, statusRatio });
});

app.get("/api/force-report", (req, res) => {
  const rows = db.prepare(`
    SELECT dv.id, dv.name, dv.manufacturer, dv.model, dv.serial, dv.country, dv.year_manufactured, dv.year_in_use, dv.cost, dv.funding, dv.status,
           d.code AS department_code, d.name AS department_name, g.code AS group_code, g.name AS group_name,
           dv.quality_level AS grade,
           CASE
             WHEN dv.quality_level IN (1,2) THEN 'Tiếp tục khai thác'
             WHEN dv.quality_level = 3 THEN 'Theo dõi, bảo dưỡng định kỳ'
             WHEN dv.quality_level = 4 THEN 'Lập kế hoạch sửa chữa lớn/thay thế'
             WHEN dv.quality_level = 5 THEN 'Đề nghị thay thế hoặc thanh lý'
             ELSE ''
           END AS recommendation,
           COALESCE((SELECT SUM(value) FROM usage_reports u WHERE u.device_id=dv.id),0) AS usage_total
    FROM devices dv
    LEFT JOIN departments d ON d.code=dv.department_code
    LEFT JOIN device_groups g ON g.code=dv.group_code
    ORDER BY d.code, g.code, dv.name
  `).all().map(r => ({ ...r, device_code: getDeviceCode(r.id) }));
  res.json(rows);
});


app.get("/api/excel-template/:kind", async (req, res) => {
  try {
    const kind = req.params.kind;
    const departmentCode = req.query.department_code || "ALL";
    const groupCode = req.query.group_code || "ALL";
    if (!["devices","repairs","maintenances"].includes(kind)) {
      return res.status(400).send("Invalid template kind");
    }
    const workbook = await buildExcelTemplate(kind, departmentCode, groupCode);
    const buffer = await workbook.xlsx.writeBuffer();
    const filenameMap = { devices: "mau_nhap_thiet_bi.xlsx", repairs: "mau_nhap_sua_chua.xlsx", maintenances: "mau_nhap_bao_duong.xlsx" };
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameMap[kind]}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send("Không tạo được file Excel mẫu");
  }
});

app.post("/api/reset-seed", (req, res) => {
  if (process.env.DEMO_MODE !== "true") return res.status(404).json({ error: "Chức năng reset dữ liệu đã bị vô hiệu trên bản production." });
  db.exec(`
    DELETE FROM accessories;
    DELETE FROM repairs;
    DELETE FROM maintenances;
    DELETE FROM operation_logs;
    DELETE FROM documents;
    DELETE FROM daily_checks;
    DELETE FROM incidents;
    DELETE FROM inspections;
    DELETE FROM quality_ratings;
    DELETE FROM usage_reports;
    DELETE FROM devices;
    DELETE FROM users;
    DELETE FROM departments;
    DELETE FROM device_groups;
  `);
  seedData();
  initExtendedModules();
  res.json({ ok: true });
});

if (process.env.DEMO_MODE === "true") refreshDemoTodayData();


// ===== QY4 V2.1 endpoints: cảnh báo, vật tư, điều chuyển, thanh lý =====
app.get("/api/alerts", (req, res) => {
  res.json(buildOperationalAlerts(Number(req.query.limit || 50)));
});

app.get("/api/audit-logs", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  res.json(db.prepare("SELECT * FROM audit_logs ORDER BY action_time DESC, id DESC LIMIT ?").all(limit));
});

app.get("/api/spare-parts", (req, res) => {
  res.json(db.prepare("SELECT * FROM spare_parts ORDER BY name").all());
});
app.post("/api/spare-parts", (req, res) => {
  const p = req.body || {};
  const missing = requireFields(p, ["name"]);
  if (missing.length) return res.status(400).json({ error: "Thiếu: " + missing.join(", ") });
  const info = db.prepare(`INSERT INTO spare_parts (code,name,unit,quantity,min_quantity,supplier,note) VALUES (@code,@name,@unit,@quantity,@min_quantity,@supplier,@note)`).run({
    code:p.code||null, name:p.name, unit:p.unit||"", quantity:Number(p.quantity||0), min_quantity:Number(p.min_quantity||0), supplier:p.supplier||"", note:p.note||""
  });
  logAudit('spare_parts', info.lastInsertRowid, 'Thêm vật tư', p.name);
  res.json({ id: info.lastInsertRowid });
});
app.post("/api/spare-parts/:id/transaction", (req, res) => {
  const p = req.body || {}; const id = Number(req.params.id);
  const type = p.trans_type === 'Xuất' ? 'Xuất' : 'Nhập';
  const qty = Math.max(1, Number(p.quantity || 0));
  const part = db.prepare("SELECT * FROM spare_parts WHERE id=?").get(id);
  if (!part) return res.status(404).json({ error: "Không tìm thấy vật tư" });
  const signed = type === 'Xuất' ? -qty : qty;
  db.prepare(`INSERT INTO inventory_transactions (part_id,trans_date,trans_type,quantity,device_id,repair_id,actor,note) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, p.trans_date || nowSql(), type, qty, p.device_id || null, p.repair_id || null, p.actor || '', p.note || '');
  db.prepare("UPDATE spare_parts SET quantity=COALESCE(quantity,0)+? WHERE id=?").run(signed, id);
  logAudit('inventory', id, type + ' vật tư', `${part.name}: ${qty}`);
  res.json({ ok: true });
});

app.get("/api/transfers", (req, res) => {
  res.json(db.prepare(`SELECT t.*, dv.name device_name, dv.device_code FROM transfers t LEFT JOIN devices dv ON dv.id=t.device_id ORDER BY transfer_date DESC, id DESC`).all());
});
app.post("/api/transfers", (req, res) => {
  const p = req.body || {}; const missing = requireFields(p, ["device_id","to_department","transfer_date"]);
  if (missing.length) return res.status(400).json({ error: "Thiếu: " + missing.join(", ") });
  const dv = db.prepare("SELECT * FROM devices WHERE id=?").get(p.device_id);
  if (!dv) return res.status(404).json({ error: "Không tìm thấy thiết bị" });
  const info = db.prepare(`INSERT INTO transfers (device_id,from_department,to_department,transfer_date,handover_person,receiver,reason,note) VALUES (@device_id,@from_department,@to_department,@transfer_date,@handover_person,@receiver,@reason,@note)`).run({
    device_id:p.device_id, from_department:p.from_department||dv.department_code||'', to_department:p.to_department, transfer_date:p.transfer_date,
    handover_person:p.handover_person||'', receiver:p.receiver||'', reason:p.reason||'', note:p.note||''
  });
  db.prepare("UPDATE devices SET department_code=?, location=COALESCE(NULLIF(?,''),location) WHERE id=?").run(p.to_department, p.location || '', p.device_id);
  logAudit('transfers', info.lastInsertRowid, 'Điều chuyển thiết bị', `${dv.name}: ${dv.department_code||''} -> ${p.to_department}`);
  res.json({ id: info.lastInsertRowid });
});

app.get("/api/liquidations", (req, res) => {
  res.json(db.prepare(`SELECT l.*, dv.name device_name, dv.device_code FROM liquidations l LEFT JOIN devices dv ON dv.id=l.device_id ORDER BY liquidation_date DESC, id DESC`).all());
});
app.post("/api/liquidations", (req, res) => {
  const p = req.body || {}; const missing = requireFields(p, ["device_id","liquidation_date"]);
  if (missing.length) return res.status(400).json({ error: "Thiếu: " + missing.join(", ") });
  const dv = db.prepare("SELECT * FROM devices WHERE id=?").get(p.device_id);
  if (!dv) return res.status(404).json({ error: "Không tìm thấy thiết bị" });
  const info = db.prepare(`INSERT INTO liquidations (device_id,liquidation_date,decision_no,council,residual_value,reason,note) VALUES (@device_id,@liquidation_date,@decision_no,@council,@residual_value,@reason,@note)`).run({
    device_id:p.device_id, liquidation_date:p.liquidation_date, decision_no:p.decision_no||'', council:p.council||'', residual_value:Number(p.residual_value||0), reason:p.reason||'', note:p.note||''
  });
  db.prepare("UPDATE devices SET status='Chờ thanh lý' WHERE id=?").run(p.device_id);
  logAudit('liquidations', info.lastInsertRowid, 'Lập hồ sơ thanh lý', dv.name);
  res.json({ id: info.lastInsertRowid });
});



// ===== QY4 V2.3 vận hành thực tế: sao lưu/phục hồi, thống kê nhanh =====
const backupsDir = path.join(__dirname, "backups");
fs.mkdirSync(backupsDir, { recursive: true });
function safeBackupName(name) {
  return path.basename(String(name || "")).replace(/[^a-zA-Z0-9._-]/g, "_");
}
function getDbStats() {
  const tableNames = ['devices','departments','device_groups','incidents','repairs','maintenances','inspections','spare_parts','transfers','liquidations','audit_logs'];
  const stats = {};
  tableNames.forEach(t => {
    try { stats[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; }
    catch (e) { stats[t] = 0; }
  });
  return stats;
}

app.get("/api/system/stats", (req, res) => {
  const stat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
  res.json({
    database: dbPath,
    size_bytes: stat ? stat.size : 0,
    updated_at: stat ? stat.mtime.toISOString() : '',
    counts: getDbStats()
  });
});

app.get("/api/backups", (req, res) => {
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => {
      const st = fs.statSync(path.join(backupsDir, f));
      return { filename: f, size_bytes: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  res.json(files);
});

app.post("/api/backups", (req, res) => {
  try {
    const stamp = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
    const file = `backup-qy4-ttbyt-${stamp}.sqlite`;
    const target = path.join(backupsDir, file);
    db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
    fs.copyFileSync(dbPath, target);
    logAudit('system', null, 'Sao lưu dữ liệu', file);
    res.json({ ok: true, filename: file });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không sao lưu được dữ liệu' });
  }
});

app.get("/api/backups/:filename/download", (req, res) => {
  const file = safeBackupName(req.params.filename);
  const full = path.join(backupsDir, file);
  if (!file || !fs.existsSync(full)) return res.status(404).send('Không tìm thấy bản sao lưu');
  res.download(full, file);
});

app.post("/api/backups/:filename/restore", (req, res) => {
  try {
    const file = safeBackupName(req.params.filename);
    const full = path.join(backupsDir, file);
    if (!file || !fs.existsSync(full)) return res.status(404).json({ error: 'Không tìm thấy bản sao lưu' });
    const before = `auto-before-restore-${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}.sqlite`;
    db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
    fs.copyFileSync(dbPath, path.join(backupsDir, before));
    db.close();
    fs.copyFileSync(full, dbPath);
    res.json({ ok: true, restored: file, auto_backup: before, message: 'Đã phục hồi. Hãy tắt và chạy lại npm start để nạp database mới.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không phục hồi được dữ liệu' });
  }
});


// ===== QY4 V2.4 vận hành ổn định: kiểm tra sức khỏe, chất lượng dữ liệu, báo cáo Excel =====
function hoursSince(dateIso) {
  if (!dateIso) return null;
  const ms = Date.now() - new Date(dateIso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 36e5);
}
function getLatestBackup() {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => {
        const st = fs.statSync(path.join(backupsDir, f));
        return { filename: f, size_bytes: st.size, created_at: st.mtime.toISOString() };
      })
      .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    return files[0] || null;
  } catch (e) { return null; }
}
function getDataQualityRows(limit = 100) {
  const rows = [];
  function push(type, level, device, detail, link) {
    rows.push({ type, level, device_id: device?.id || null, device_code: device?.device_code || '', device_name: device?.name || '', department_code: device?.department_code || '', detail, link: link || (device?.id ? `/device-detail.html?id=${device.id}` : '') });
  }
  const devices = db.prepare(`SELECT id, device_code, name, department_code, group_code, serial, model, manufacturer, status, warranty_end, next_maintenance_date, next_inspection_date FROM devices ORDER BY id DESC`).all();
  devices.forEach(d => {
    if (!d.device_code) push('Mã thiết bị', 'warning', d, 'Thiết bị chưa có mã quản lý/QR.');
    if (!d.serial) push('Serial', 'info', d, 'Thiết bị chưa nhập số serial.');
    if (!d.department_code) push('Khoa/phòng', 'warning', d, 'Thiết bị chưa gán khoa/phòng sử dụng.');
    if (!d.group_code) push('Nhóm thiết bị', 'info', d, 'Thiết bị chưa gán nhóm thiết bị.');
    if (!d.next_maintenance_date) push('Bảo dưỡng', 'warning', d, 'Chưa có ngày bảo dưỡng tiếp theo.');
    if (!d.next_inspection_date) push('Kiểm định', 'warning', d, 'Chưa có ngày kiểm định tiếp theo.');
  });
  const noHistory = db.prepare(`
    SELECT d.id, d.device_code, d.name, d.department_code
    FROM devices d
    LEFT JOIN repairs r ON r.device_id=d.id
    LEFT JOIN maintenances m ON m.device_id=d.id
    LEFT JOIN inspections i ON i.device_id=d.id
    WHERE r.id IS NULL AND m.id IS NULL AND i.id IS NULL
    ORDER BY d.id DESC LIMIT 50
  `).all();
  noHistory.forEach(d => push('Hồ sơ lịch sử', 'info', d, 'Chưa có lịch sử sửa chữa/bảo dưỡng/kiểm định.'));
  return rows.slice(0, limit);
}

app.get('/api/system/health', (req, res) => {
  const stat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
  const latestBackup = getLatestBackup();
  const openIncidents = db.prepare("SELECT COUNT(*) c FROM incidents WHERE COALESCE(status,'') NOT IN ('Đã xử lý','Đóng phiếu','Hoàn thành')").get().c;
  const openRepairs = db.prepare("SELECT COUNT(*) c FROM repairs WHERE COALESCE(processing_status,'') NOT IN ('Hoàn thành','Đóng phiếu')").get().c;
  const lowParts = db.prepare("SELECT COUNT(*) c FROM spare_parts WHERE COALESCE(quantity,0) <= COALESCE(min_quantity,0)").get().c;
  const dq = getDataQualityRows(500);
  const backupAgeHours = latestBackup ? hoursSince(latestBackup.created_at) : null;
  const checks = [
    { key:'database', label:'Database', ok: !!stat && stat.size > 0, detail: stat ? `Dung lượng ${stat.size} bytes` : 'Không tìm thấy database' },
    { key:'backup', label:'Sao lưu', ok: latestBackup && backupAgeHours !== null && backupAgeHours <= 72, detail: latestBackup ? `Bản gần nhất: ${latestBackup.filename}, khoảng ${backupAgeHours} giờ trước` : 'Chưa có bản sao lưu' },
    { key:'open_incidents', label:'Phiếu sự cố mở', ok: openIncidents === 0, detail: `${openIncidents} phiếu sự cố chưa đóng` },
    { key:'open_repairs', label:'Phiếu sửa chữa mở', ok: openRepairs === 0, detail: `${openRepairs} phiếu sửa chữa chưa hoàn tất` },
    { key:'low_parts', label:'Tồn kho vật tư', ok: lowParts === 0, detail: `${lowParts} vật tư dưới/tới mức tối thiểu` },
    { key:'data_quality', label:'Chất lượng dữ liệu', ok: dq.length === 0, detail: `${dq.length} điểm dữ liệu cần bổ sung` }
  ];
  res.json({ ok: checks.every(x=>x.ok), checked_at: new Date().toISOString(), latest_backup: latestBackup, backup_age_hours: backupAgeHours, checks });
});

app.get('/api/data-quality', (req, res) => {
  res.json(getDataQualityRows(Math.min(Number(req.query.limit || 200), 1000)));
});

app.get('/api/reports/operational-excel', async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QY4-TTBYT';
  wb.created = new Date();
  const summary = wb.addWorksheet('Tong quan');
  summary.columns = [{header:'Chỉ tiêu', key:'name', width:34},{header:'Giá trị', key:'value', width:20},{header:'Ghi chú', key:'note', width:50}];
  const stats = getDbStats();
  Object.entries(stats).forEach(([k,v]) => summary.addRow({name:k, value:v, note:''}));
  const health = db.prepare("SELECT COUNT(*) c FROM incidents WHERE COALESCE(status,'') NOT IN ('Đã xử lý','Đóng phiếu','Hoàn thành')").get().c;
  summary.addRow({name:'Phiếu sự cố chưa đóng', value:health, note:'Cần xử lý trong vận hành hằng ngày'});

  const devicesWs = wb.addWorksheet('Thiet bi');
  devicesWs.columns = [
    {header:'Mã TB', key:'device_code', width:18},{header:'Tên thiết bị', key:'name', width:34},{header:'Khoa', key:'department_code', width:14},{header:'Nhóm', key:'group_code', width:14},
    {header:'Model', key:'model', width:18},{header:'Serial', key:'serial', width:20},{header:'Hãng', key:'manufacturer', width:20},{header:'Trạng thái', key:'status', width:18},
    {header:'Hạn bảo hành', key:'warranty_end', width:15},{header:'BD tiếp theo', key:'next_maintenance_date', width:15},{header:'KĐ tiếp theo', key:'next_inspection_date', width:15},{header:'Vị trí', key:'location', width:24}
  ];
  db.prepare(`SELECT device_code,name,department_code,group_code,model,serial,manufacturer,status,warranty_end,next_maintenance_date,next_inspection_date,location FROM devices ORDER BY department_code,name`).all().forEach(r=>devicesWs.addRow(r));

  const alertsWs = wb.addWorksheet('Canh bao');
  alertsWs.columns = [{header:'Mức',key:'level',width:12},{header:'Loại',key:'type',width:18},{header:'Tiêu đề',key:'title',width:34},{header:'Nội dung',key:'content',width:60},{header:'Hạn',key:'due_date',width:15},{header:'Link',key:'link',width:36}];
  buildOperationalAlerts(200).forEach(r=>alertsWs.addRow(r));

  const dqWs = wb.addWorksheet('Chat luong du lieu');
  dqWs.columns = [{header:'Mức',key:'level',width:12},{header:'Loại',key:'type',width:20},{header:'Mã TB',key:'device_code',width:18},{header:'Tên TB',key:'device_name',width:34},{header:'Khoa',key:'department_code',width:12},{header:'Nội dung cần bổ sung',key:'detail',width:60}];
  getDataQualityRows(1000).forEach(r=>dqWs.addRow(r));

  const repairsWs = wb.addWorksheet('Sua chua');
  repairsWs.columns = [{header:'Ngày',key:'repair_date',width:15},{header:'Mã TB',key:'device_code',width:18},{header:'Tên TB',key:'device_name',width:34},{header:'Vấn đề',key:'issue',width:42},{header:'Xử lý',key:'work',width:42},{header:'Người/đơn vị xử lý',key:'person',width:22},{header:'Chi phí',key:'cost',width:14},{header:'Trạng thái',key:'processing_status',width:18},{header:'Kết quả',key:'result',width:22}];
  db.prepare(`SELECT r.repair_date, d.device_code, d.name device_name, r.issue, r.work, r.person, r.cost, r.processing_status, r.result FROM repairs r LEFT JOIN devices d ON d.id=r.device_id ORDER BY r.repair_date DESC, r.id DESC LIMIT 1000`).all().forEach(r=>repairsWs.addRow(r));

  [summary, devicesWs, alertsWs, dqWs, repairsWs].forEach(ws => {
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: 'A1', to: ws.getRow(1).getCell(ws.columnCount).address };
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-van-hanh-qy4-ttbyt.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});



// ===== V1.0 Report Engine: xuất Excel biểu mẫu A4 theo mẫu hành chính =====
function vnDate(value) {
  if (!value) return "";
  const d = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return String(value || "");
  const [y,m,dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
function safeReportFileName(value) {
  return String(value || 'bao_cao')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g,'d').replace(/Đ/g,'D')
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '') || 'bao_cao';
}
function getSystemReportInfo() {
  // Không ghi cứng vào dữ liệu nghiệp vụ; các giá trị này có thể đưa ra Cấu hình hệ thống ở V1.1.
  return {
    upperUnit: process.env.REPORT_UPPER_UNIT || 'CỤC HẬU CẦN - KỸ THUẬT QUÂN KHU 4',
    unitName: process.env.REPORT_UNIT_NAME || 'BỆNH VIỆN QUÂN Y 4',
    departmentName: process.env.REPORT_DEPARTMENT_NAME || 'KHOA TRANG BỊ',
    place: process.env.REPORT_PLACE || 'Nghệ An'
  };
}
const REPORT_TEMPLATES_V1 = {
  devices: { code:'BM-BV-TB-01', title:'DANH SÁCH TRANG THIẾT BỊ Y TẾ', sheet:'Thiet bi', orientation:'landscape',
    columns:['TT','Mã TB','Tên thiết bị','Khoa','Nhóm','Model','Serial','Hãng SX','Tình trạng','Nguồn vốn','Nguyên giá','Ghi chú'] },
  incidents: { code:'BM-BV-TB-02', title:'BÁO CÁO SỰ CỐ TRANG THIẾT BỊ Y TẾ', sheet:'Su co', orientation:'landscape',
    columns:['TT','Thời gian','Mã TB','Tên thiết bị','Khoa','Mô tả sự cố','Người báo','Trạng thái','Ghi chú'] },
  repairs: { code:'BM-BV-TB-03', title:'BÁO CÁO SỬA CHỮA TRANG THIẾT BỊ Y TẾ', sheet:'Sua chua', orientation:'landscape',
    columns:['TT','Tiếp nhận','Mã TB','Tên thiết bị','Khoa','Tình trạng/Nguyên nhân hỏng','Hình thức','Đơn vị xử lý','Trạng thái xử lý','TTTB sau sửa chữa','Chi phí','Ghi chú'] },
  maintenances: { code:'BM-BV-TB-05', title:'BÁO CÁO BẢO DƯỠNG TRANG THIẾT BỊ Y TẾ', sheet:'Bao duong', orientation:'landscape',
    columns:['TT','Thời gian','Mã TB','Tên thiết bị','Khoa','Hình thức/Nội dung','Người/Đơn vị thực hiện','Kết quả','Hạn tiếp theo','File/Ghi chú'] },
  inspections: { code:'BM-BV-TB-06', title:'BÁO CÁO KIỂM ĐỊNH - HIỆU CHUẨN - ATBX', sheet:'Kiem dinh', orientation:'landscape',
    columns:['TT','Thời gian','Mã TB','Tên thiết bị','Khoa','Loại','Đơn vị kiểm định','Kết quả','Hạn tiếp theo','File/Ghi chú'] },
  annualUsage: { code:'BM-BV-TB-04', title:'THỐNG KÊ TÌNH HÌNH SỬ DỤNG TRANG BỊ QUÂN Y', sheet:'Su dung trang bi', orientation:'landscape',
    columns:['TT','Đơn vị','Hiện có','Đang sử dụng','Không sử dụng','Sửa chữa/Bảo dưỡng','Đã kiểm định/Hiệu chuẩn','Chưa kiểm định/Hiệu chuẩn','Đã đề nghị thanh lý','Chưa đề nghị thanh lý','Ghi chú'] },
  inventorySummary: { code:'BM-BV-TB-07', title:'BÁO CÁO NHẬP - XUẤT - TỒN KHO VẬT TƯ', sheet:'Kho vat tu', orientation:'landscape',
    columns:['TT','Mã vật tư','Tên vật tư/Doanh cụ','ĐVT','Tồn hiện tại','Tồn tối thiểu','Nhà cung cấp','Ghi chú'] },
  inventoryCheck: { code:'BM-BV-TB-08', title:'BIÊN BẢN KIỂM KÊ KHO VẬT TƯ', sheet:'Kiem ke kho', orientation:'landscape',
    columns:['TT','Mã vật tư','Tên vật tư/Doanh cụ','ĐVT','Theo sổ','Thực tế','Chênh lệch','Nguyên nhân/Ghi chú'] }
};
function reportDateWhere(alias, field, from, to) {
  const cond = [];
  const params = {};
  if (from) { cond.push(`substr(${alias}.${field},1,10) >= @from`); params.from = from; }
  if (to) { cond.push(`substr(${alias}.${field},1,10) <= @to`); params.to = to; }
  return { sql: cond.length ? ` AND ${cond.join(' AND ')}` : '', params };
}
function buildReportRowsV1(type, { from, to, dept, group }) {
  const deptSql = dept && dept !== 'ALL' ? ' AND dv.department_code=@dept' : '';
  const groupSql = group && group !== 'ALL' ? ' AND dv.group_code=@group' : '';
  const baseParams = { dept, group };
  if (type === 'devices') {
    const rows = db.prepare(`SELECT dv.*, dp.name department_name, dg.name group_name FROM devices dv LEFT JOIN departments dp ON dp.code=dv.department_code LEFT JOIN device_groups dg ON dg.code=dv.group_code WHERE 1=1 ${deptSql} ${groupSql} ORDER BY dv.department_code, dv.name`).all(baseParams);
    return rows.map((r,i)=>[i+1, r.device_code||getDeviceCode(r.id), r.name||'', r.department_code||'', r.group_name||r.group_code||'', r.model||'', r.serial||'', r.manufacturer||'', r.status||'', r.funding||'', Number(r.cost||0), r.note||'']);
  }
  if (type === 'incidents') {
    const dw = reportDateWhere('i','incident_datetime',from,to);
    const rows = db.prepare(`SELECT i.*, dv.device_code, dv.name device_name, dv.department_code FROM incidents i LEFT JOIN devices dv ON dv.id=i.device_id WHERE 1=1 ${dw.sql} ${deptSql} ${groupSql} ORDER BY i.incident_datetime DESC, i.id DESC`).all({...dw.params, ...baseParams});
    return rows.map((r,i)=>[i+1, vnDate(r.incident_datetime) + (String(r.incident_datetime||'').length>10 ? ' ' + String(r.incident_datetime).slice(11,16) : ''), r.device_code||'', r.device_name||'', r.department_code||'', r.description||'', r.reporter||'', r.status||'', r.note||'']);
  }
  if (type === 'repairs') {
    const dw = reportDateWhere('r','repair_date',from,to);
    const rows = db.prepare(`SELECT r.*, dv.device_code, dv.name device_name, dv.department_code FROM repairs r LEFT JOIN devices dv ON dv.id=r.device_id WHERE COALESCE(r.processing_status,'') <> 'Đã hủy' ${dw.sql} ${deptSql} ${groupSql} ORDER BY COALESCE(r.received_at,r.repair_date) DESC, r.id DESC`).all({...dw.params, ...baseParams});
    return rows.map((r,i)=>[i+1, vnDate(r.received_at||r.repair_date), r.device_code||'', r.device_name||'', r.department_code||'', r.issue||'', r.method||'', r.person||'', r.processing_status||'', r.status_after||'', Number(r.cost||0), r.note||'']);
  }
  if (type === 'maintenances') {
    const dw = reportDateWhere('m','maintenance_date',from,to);
    const rows = db.prepare(`SELECT m.*, dv.device_code, dv.name device_name, dv.department_code FROM maintenances m LEFT JOIN devices dv ON dv.id=m.device_id WHERE COALESCE(m.cancelled_at,'')='' ${dw.sql} ${deptSql} ${groupSql} ORDER BY m.maintenance_date DESC, m.id DESC`).all({...dw.params, ...baseParams});
    return rows.map((r,i)=>[i+1, vnDate(r.maintenance_date), r.device_code||'', r.device_name||'', r.department_code||'', r.content||r.type||'', r.performer||r.vendor||'', r.result||'', vnDate(r.next_date), r.original_name||r.note||'']);
  }
  if (type === 'inspections') {
    const dw = reportDateWhere('ins','inspection_date',from,to);
    const rows = db.prepare(`SELECT ins.*, dv.device_code, dv.name device_name, dv.department_code FROM inspections ins LEFT JOIN devices dv ON dv.id=ins.device_id WHERE COALESCE(ins.cancelled_at,'')='' ${dw.sql} ${deptSql} ${groupSql} ORDER BY ins.inspection_date DESC, ins.id DESC`).all({...dw.params, ...baseParams});
    return rows.map((r,i)=>[i+1, vnDate(r.inspection_date), r.device_code||'', r.device_name||'', r.department_code||'', r.type||'', r.organization||'', r.result||'', vnDate(r.next_date), r.file_note||'']);
  }
  if (type === 'annualUsage') {
    const rows = db.prepare(`SELECT dv.*, dp.name department_name FROM devices dv LEFT JOIN departments dp ON dp.code=dv.department_code WHERE 1=1 ${deptSql} ${groupSql} ORDER BY dv.department_code, dv.name`).all(baseParams);
    const insp = new Set(db.prepare(`SELECT DISTINCT device_id FROM inspections`).all().map(x=>Number(x.device_id)));
    const repairCounts = new Map(db.prepare(`SELECT dv.department_code, COUNT(r.id) c FROM repairs r LEFT JOIN devices dv ON dv.id=r.device_id WHERE COALESCE(r.processing_status,'') <> 'Đã hủy' GROUP BY dv.department_code`).all().map(x=>[x.department_code, Number(x.c||0)]));
    const by = new Map();
    rows.forEach(d=>{ const k=d.department_code||'Chưa rõ'; if(!by.has(k)) by.set(k,{dept:k, name:d.department_name||'', devices:[]}); by.get(k).devices.push(d); });
    return [...by.values()].map((g,i)=>{
      const ds=g.devices; const active=ds.filter(d=>/hoạt động/i.test(d.status||'')).length; const inactive=ds.length-active; const inspected=ds.filter(d=>insp.has(Number(d.id))).length;
      const liquidation=ds.filter(d=>/thanh lý|ngừng/i.test(d.status||'')).length;
      return [i+1, `${g.dept}${g.name?` - ${g.name}`:''}`, ds.length, active, inactive, repairCounts.get(g.dept)||0, inspected, ds.length-inspected, liquidation, Math.max(0, ds.length-liquidation), ''];
    });
  }
  if (type === 'inventorySummary' || type === 'inventoryCheck') {
    const rows = db.prepare(`SELECT * FROM spare_parts ORDER BY name`).all();
    if (type === 'inventoryCheck') return rows.map((r,i)=>[i+1, r.code||'', r.name||'', r.unit||'', Number(r.quantity||0), '', '', r.note||'']);
    return rows.map((r,i)=>[i+1, r.code||'', r.name||'', r.unit||'', Number(r.quantity||0), Number(r.min_quantity||0), r.supplier||'', r.note||'']);
  }
  return [];
}
function applyA4WorksheetStyle(ws, meta, columns, rows, { from, to }) {
  const info = getSystemReportInfo();
  const colCount = columns.length;
  ws.pageSetup.paperSize = 9; // A4
  ws.pageSetup.orientation = meta.orientation || 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageMargins = { left: 0.35, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  ws.properties.defaultRowHeight = 18;
  // Header hành chính
  ws.mergeCells(1, 1, 1, Math.min(4, colCount));
  ws.getCell(1,1).value = info.upperUnit;
  ws.getCell(1,1).alignment = { horizontal:'center', vertical:'middle', wrapText:true };
  ws.getCell(1,1).font = { name:'Times New Roman', size:11, bold:true };
  ws.mergeCells(2, 1, 2, Math.min(4, colCount));
  ws.getCell(2,1).value = info.unitName;
  ws.getCell(2,1).alignment = { horizontal:'center', vertical:'middle', wrapText:true };
  ws.getCell(2,1).font = { name:'Times New Roman', size:11, bold:true };
  ws.mergeCells(1, Math.max(5, colCount-2), 1, colCount);
  ws.getCell(1, Math.max(5, colCount-2)).value = meta.code;
  ws.getCell(1, Math.max(5, colCount-2)).alignment = { horizontal:'center', vertical:'middle' };
  ws.getCell(1, Math.max(5, colCount-2)).font = { name:'Times New Roman', size:10, bold:true };
  ws.mergeCells(4, 1, 4, colCount);
  ws.getCell(4,1).value = meta.title;
  ws.getCell(4,1).alignment = { horizontal:'center', vertical:'middle', wrapText:true };
  ws.getCell(4,1).font = { name:'Times New Roman', size:14, bold:true };
  ws.mergeCells(5, 1, 5, colCount);
  ws.getCell(5,1).value = `(Từ ngày ${vnDate(from)} đến ngày ${vnDate(to)})`;
  ws.getCell(5,1).alignment = { horizontal:'center', vertical:'middle' };
  ws.getCell(5,1).font = { name:'Times New Roman', size:11, italic:true };
  // Table
  const headerRow = 7;
  const h = ws.getRow(headerRow);
  columns.forEach((c, idx) => {
    const cell = h.getCell(idx+1); cell.value = c;
    cell.font = { name:'Times New Roman', size:10, bold:true };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEFEFEF' } };
    cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  });
  h.height = 36;
  rows.forEach((r, rIdx) => {
    const row = ws.getRow(headerRow+1+rIdx);
    r.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx+1); cell.value = v;
      cell.font = { name:'Times New Roman', size:10 };
      cell.alignment = { horizontal: (typeof v === 'number' && cIdx>0) ? 'right' : (cIdx===0?'center':'left'), vertical:'top', wrapText:true };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      if (typeof v === 'number' && cIdx>0) cell.numFmt = '#,##0';
    });
  });
  // widths tuned for A4 landscape
  const widths = columns.map((c,i)=>{
    if (i===0) return 5; if (/Tên|Nội dung|Nguyên nhân|Ghi chú|Mô tả/i.test(c)) return 28;
    if (/Khoa|ĐVT|TT|Mã/i.test(c)) return 11; if (/Thời|Tiếp nhận|Hạn/i.test(c)) return 14;
    if (/Chi phí|Nguyên giá|Tồn/i.test(c)) return 14; return 16;
  });
  widths.forEach((w,i)=> ws.getColumn(i+1).width = w);
  const last = headerRow + Math.max(rows.length, 1) + 3;
  const mid = Math.max(2, Math.floor(colCount/2));
  ws.mergeCells(last, 1, last, mid);
  ws.getCell(last,1).value = 'NGƯỜI LẬP';
  ws.getCell(last,1).alignment = { horizontal:'center' };
  ws.getCell(last,1).font = { name:'Times New Roman', size:11, bold:true };
  ws.mergeCells(last, mid + 1, last, colCount);
  ws.getCell(last, mid + 1).value = info.departmentName || 'KHOA TRANG BỊ';
  ws.getCell(last, mid + 1).alignment = { horizontal:'center' };
  ws.getCell(last, mid + 1).font = { name:'Times New Roman', size:11, bold:true };
  ws.getRow(last + 1).height = 54;
  ws.getRow(last + 2).height = 28;
  ws.views = [{ state:'frozen', ySplit: headerRow }];
  ws.autoFilter = { from: {row: headerRow, column: 1}, to: {row: headerRow, column: colCount} };
}
app.get('/api/reports/export-a4', async (req, res) => {
  try {
    const type = String(req.query.type || 'incidents');
    const meta = REPORT_TEMPLATES_V1[type] || REPORT_TEMPLATES_V1.incidents;
    const from = req.query.from || new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);
    const to = req.query.to || new Date().toISOString().slice(0,10);
    const dept = req.query.dept || 'ALL';
    const group = req.query.group || 'ALL';
    const rows = buildReportRowsV1(type, { from, to, dept, group });
    const wb = new ExcelJS.Workbook();
    wb.creator = 'QLTTBYT Report Engine';
    wb.created = new Date();
    const ws = wb.addWorksheet(meta.sheet || 'Bao cao');
    applyA4WorksheetStyle(ws, meta, meta.columns, rows, { from, to });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = `${safeReportFileName(meta.title)}_${from}_${to}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Không xuất được báo cáo A4: ' + err.message);
  }
});

app.get("/", (req, res) => {
  res.redirect("/dashboard.html");
});

app.listen(PORT, () => {
  console.log(`QY4 TTBYT app running at http://localhost:${PORT}`);
  try {
    const lan = Object.values(os.networkInterfaces()).flat().filter(Boolean).find(net => net.family === "IPv4" && !net.internal);
    if (lan) console.log(`QR/mobile LAN URL: http://${lan.address}:${PORT}`);
  if (QR_PUBLIC_BASE_URL) console.log(`QR public URL: ${QR_PUBLIC_BASE_URL}`);
  else console.log("QR public URL: chưa cấu hình. Đặt QR_PUBLIC_BASE_URL=https://ten-mien-cong-khai để điện thoại ngoài mạng mở được QR.");
  } catch (e) {}
});


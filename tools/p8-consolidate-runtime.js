const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const p7StartPath = path.join(root, 'p7-start.js');

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  const second = first >= 0 ? source.indexOf(before, first + before.length) : -1;
  if (first < 0 || second >= 0) throw new Error(`[P8] Không thể hợp nhất ${label}: điểm neo không duy nhất.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

// Thu lại chính source cuối cùng sau chuỗi P7 -> P3 -> safe-start, nhưng chặn không cho
// server thật khởi động. Nhờ vậy P8 không viết lại thủ công các quy tắc P0-P7 đã kiểm thử.
let captured = null;
const nativeCompile = Module.prototype._compile;
Module.prototype._compile = function p8CaptureCompile(content, filename) {
  if (path.resolve(filename) === serverPath) {
    captured = String(content);
    return undefined;
  }
  return nativeCompile.call(this, content, filename);
};

try {
  delete require.cache[require.resolve(p7StartPath)];
  require(p7StartPath);
} finally {
  Module.prototype._compile = nativeCompile;
}

if (!captured) throw new Error('[P8] Không thu được source đã harden từ chuỗi runtime hiện tại.');

let source = captured;

// Nạp .env trước mọi biến cấu hình (PORT, TRUST_PROXY, QR_PUBLIC_BASE_URL, DEMO_MODE...).
source = replaceOnce(
  source,
  'bootstrap cấu hình',
  'const app = express();',
  `// P8_CONSOLIDATED_RUNTIME: cấu hình và hardening chạy trực tiếp, không còn vá source khi runtime.\nfunction loadRootEnv() {\n  const envPath = path.join(__dirname, ".env");\n  if (!fs.existsSync(envPath)) return;\n  const raw = fs.readFileSync(envPath, "utf8");\n  raw.split(/\\r?\\n/).forEach(line => {\n    const s = String(line || "").trim();\n    if (!s || s.startsWith("#")) return;\n    const idx = s.indexOf("=");\n    if (idx <= 0) return;\n    const key = s.slice(0, idx).trim();\n    let value = s.slice(idx + 1).trim();\n    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);\n    if (process.env[key] === undefined) process.env[key] = value;\n  });\n}\nloadRootEnv();\nif (process.argv.includes("--demo")) process.env.DEMO_MODE = "true";\nfs.mkdirSync(path.join(__dirname, "db"), { recursive: true });\n\nconst app = express();`
);

// P7 trước đây nối client ký QR bằng cách intercept fs.readFileSync(api.js).
// P8 nối rõ ràng tại route /api.js để không phụ thuộc monkey-patch toàn cục.
source = replaceOnce(
  source,
  'bundle api.js P1+P7',
  `app.get("/api.js", (_req, res) => {\n  const base = fs.readFileSync(path.join(__dirname, "public", "api.js"), "utf8");\n  const p1 = fs.readFileSync(path.join(__dirname, "public", "p1-incident-repair.js"), "utf8");\n  res.type("application/javascript").send(base + "\\n\\n" + p1);\n});`,
  `app.get("/api.js", (_req, res) => {\n  const base = fs.readFileSync(path.join(__dirname, "public", "api.js"), "utf8");\n  const p1 = fs.readFileSync(path.join(__dirname, "public", "p1-incident-repair.js"), "utf8");\n  const p7 = fs.readFileSync(path.join(__dirname, "public", "p7-qr-client.js"), "utf8");\n  res.type("application/javascript").send(base + "\\n\\n;" + p1 + "\\n\\n;" + p7 + "\\n");\n});`
);

// Không ghi file giả vào node_modules nữa. Phục vụ ExcelJS + shim ngay từ route legacy.
source = replaceOnce(
  source,
  'vendor ExcelJS',
  'app.use("/vendor", express.static(path.join(__dirname, "node_modules", "xlsx", "dist")));',
  `const p8ExcelDist = path.join(__dirname, "node_modules", "exceljs", "dist");\napp.get("/vendor/xlsx.full.min.js", (_req, res) => {\n  const bundlePath = path.join(p8ExcelDist, "exceljs.min.js");\n  const compatPath = path.join(__dirname, "public", "xlsx-compat.js");\n  if (!fs.existsSync(bundlePath) || !fs.existsSync(compatPath)) return res.status(500).send("Thiếu ExcelJS compatibility runtime.");\n  const bundle = fs.readFileSync(bundlePath, "utf8");\n  const compat = fs.readFileSync(compatPath, "utf8");\n  res.type("application/javascript").send(bundle + "\\n;" + compat + "\\n");\n});\napp.use("/vendor", express.static(p8ExcelDist));`
);

// P3 trước đây monkey-patch express.static để ghép lớp sửa hồ sơ thiết bị.
// P8 phục vụ route này trực tiếp, fail-closed nếu thiếu file fix.
source = replaceOnce(
  source,
  'device-detail bundle',
  'app.use(express.static(path.join(__dirname, "public")));',
  `const p8PublicDir = path.join(__dirname, "public");\nconst p8DeviceDetailBase = path.join(p8PublicDir, "device-detail.js");\nconst p8DeviceDetailFix = path.join(p8PublicDir, "device-detail-p3-fix.js");\nif (!fs.existsSync(p8DeviceDetailFix)) throw new Error("[P8] Thiếu public/device-detail-p3-fix.js; dừng để tránh hồ sơ thiết bị không đồng bộ.");\napp.get("/device-detail.js", (_req, res) => {\n  const base = fs.readFileSync(p8DeviceDetailBase, "utf8");\n  const fix = fs.readFileSync(p8DeviceDetailFix, "utf8");\n  res.type("application/javascript").send(base + "\\n\\n;" + fix + "\\n");\n});\napp.use(express.static(p8PublicDir));`
);

// SQLite: bật FK rõ ràng trên connection chính và chờ lock ngắn để giảm lỗi BUSY.
source = replaceOnce(
  source,
  'SQLite pragmas',
  'const db = new Database(dbPath);\ndb.pragma("journal_mode = WAL");',
  'const db = new Database(dbPath);\ndb.pragma("journal_mode = WAL");\ndb.pragma("foreign_keys = ON");\ndb.pragma("busy_timeout = 5000");'
);

const mustContain = [
  'P8_CONSOLIDATED_RUNTIME',
  'process.env.DEMO_MODE !== "true"',
  'Không thể xóa thiết bị đã phát sinh lịch sử',
  'require("./p2-security").attach',
  'require("./p7-qr-security").attachPublicGuard',
  'require("./p7-qr-security").attachAuthenticatedRoutes',
  'QR công khai (tự khai)',
  'cancelled_at',
  'require("./proxy-config").trustProxySetting(process.env.TRUST_PROXY)'
];
for (const marker of mustContain) {
  if (!source.includes(marker)) throw new Error(`[P8] Source hợp nhất thiếu marker bắt buộc: ${marker}`);
}
if (source.includes('app.set("trust proxy", true)')) throw new Error('[P8] Không được còn trust proxy=true mặc định.');
if (source.includes('app.use("/uploads", express.static')) throw new Error('[P8] Không được public toàn bộ uploads.');

// Cú pháp phải hợp lệ trước khi ghi đè server.js.
new Function(source);
fs.writeFileSync(serverPath, source, 'utf8');
console.log(`[P8] Đã hợp nhất runtime vào server.js (${source.length} bytes).`);

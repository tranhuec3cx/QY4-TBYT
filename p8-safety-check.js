const fs = require('fs');
const assert = require('assert');

const server = fs.readFileSync('server.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

new Function(server);

const mustContain = [
  'P8_CONSOLIDATED_RUNTIME',
  'loadRootEnv();',
  'process.argv.includes("--demo")',
  'require("./proxy-config").trustProxySetting(process.env.TRUST_PROXY)',
  'db.pragma("foreign_keys = ON")',
  'db.pragma("busy_timeout = 5000")',
  'if (process.env.DEMO_MODE === "true") refreshDemoTodayData();',
  'Chức năng reset dữ liệu đã bị vô hiệu trên bản production.',
  'Không thể xóa thiết bị đã phát sinh lịch sử.',
  'Không được đổi thiết bị của phiếu sửa chữa đã tạo.',
  'Sự cố đã liên kết phiếu sửa chữa nên không được đổi thiết bị.',
  'require("./p2-security").attach',
  'require("./p2-scope-guard").attach',
  'require("./p7-qr-security").attachPublicGuard',
  'require("./p7-qr-security").attachAuthenticatedRoutes',
  'Number(req.qy4QrDeviceId || 0)',
  'QR công khai (tự khai)',
  'COALESCE(m.cancelled_at',
  'COALESCE(i.cancelled_at',
  'public/p7-qr-client.js',
  '/vendor/xlsx.full.min.js',
  'device-detail-p3-fix.js'
];
for (const marker of mustContain) assert.ok(server.includes(marker), `server.js thiếu bảo vệ trực tiếp: ${marker}`);

assert.ok(!server.includes('app.set("trust proxy", true)'), 'Không được trust proxy=true mặc định.');
assert.ok(!server.includes('app.use("/uploads", express.static'), 'Không được public toàn bộ uploads.');
assert.ok(!server.includes('UPDATE devices SET insurance_code=? WHERE id=?").run(r.serial'), 'Không được còn migration Serial -> mã HIS/BHXH.');
assert.ok(server.indexOf('loadRootEnv();') < server.indexOf('const PORT = process.env.PORT'), '.env phải được nạp trước khi đọc PORT/cấu hình.');

assert.strictEqual(pkg.scripts.start, 'node server.js', 'npm start phải chạy server.js trực tiếp ở P8.');
assert.strictEqual(pkg.scripts.demo, 'node server.js --demo', 'npm run demo phải chạy server.js trực tiếp với --demo.');
assert.strictEqual(pkg.scripts['check:safety'], 'node p8-safety-check.js', 'check:safety phải kiểm tra source trực tiếp, không đi qua runtime patcher.');

console.log('[P8 SAFETY] PASS - P0-P7 đã nằm trực tiếp trong server.js; npm start không còn phụ thuộc safe-start/p3-start/p7-start.');

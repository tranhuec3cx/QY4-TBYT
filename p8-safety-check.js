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
  'p7-qr-client.js',
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

// RC1 - các lỗi chỉ phát hiện khi nghiệm thu thực tế trên Windows phải được khóa bằng source check.
const maintenanceHtml = fs.readFileSync('public/maintenance.html', 'utf8');
const maintenanceJs = fs.readFileSync('public/maintenance.js', 'utf8');
const localTimeFix = fs.readFileSync('public/rc1-local-time-fix.js', 'utf8');
const inspectionHtml = fs.readFileSync('public/inspection.html', 'utf8');
const inspectionJs = fs.readFileSync('public/inspection.js', 'utf8');
const inspectionsHtml = fs.readFileSync('public/inspections.html', 'utf8');
const inspectionsJs = fs.readFileSync('public/inspections.js', 'utf8');
const pickerFix = fs.readFileSync('public/rc1-device-picker-fix.js', 'utf8');
const ticketsJs = fs.readFileSync('public/tickets.js', 'utf8');
const devicesJs = fs.readFileSync('public/devices.js', 'utf8');
const reportsJs = fs.readFileSync('public/reports.js', 'utf8');

assert.ok(maintenanceHtml.includes('/rc1-local-time-fix.js'), 'Sửa chữa phải nạp bản vá giờ địa phương RC1.');
assert.ok(localTimeFix.includes('localNowDateTimeInputValue'), 'Thiếu xử lý giờ địa phương cho thời gian cập nhật sửa chữa.');
assert.ok(localTimeFix.includes('isTerminalStatus') && localTimeFix.includes('Hủy phiếu'), 'Thiếu khóa hủy trực tiếp phiếu sửa chữa đã kết thúc.');
assert.ok(inspectionHtml.includes('/rc1-device-picker-fix.js'), 'Bảo dưỡng phải nạp bản vá chọn thiết bị RC1.');
assert.ok(inspectionsHtml.includes('/rc1-device-picker-fix.js'), 'Kiểm định phải nạp bản vá chọn thiết bị RC1.');
assert.ok(pickerFix.includes('commitDeviceSelection'), 'Thiếu logic chốt thiết bị từ datalist/Tab/Enter/blur.');

assert.ok(devicesJs.includes("exportA4Report('devices'"), 'Xuất Excel Thiết bị phải dùng engine A4.');
assert.ok(ticketsJs.includes("exportA4Report('incidents'"), 'Xuất Excel Sự cố phải dùng engine A4.');
assert.ok(maintenanceJs.includes("exportA4Report('repairs'"), 'Xuất Excel Sửa chữa phải dùng engine A4.');
assert.ok(inspectionJs.includes("exportA4Report('maintenances'"), 'Xuất Excel Bảo dưỡng phải dùng engine A4.');
assert.ok(inspectionsJs.includes("exportA4Report('inspections'"), 'Xuất Excel Kiểm định phải dùng engine A4.');
assert.ok(reportsJs.includes('/api/reports/export-a4?'), 'Trung tâm Báo cáo phải dùng engine xuất A4 phía server.');

console.log('[P8 SAFETY] PASS - P0-P7 + các lỗi RC1 nghiệm thu thực tế đã được khóa bằng source check.');

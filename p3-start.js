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

if (fs.existsSync(excelBundle) && fs.existsSync(compatPath)) {
  const bundle = fs.readFileSync(excelBundle, 'utf8');
  const compat = fs.readFileSync(compatPath, 'utf8');
  fs.writeFileSync(legacyAlias, `${bundle}\n;${compat}\n`, 'utf8');
}

const originalStatic = express.static;
express.static = function qy4Static(root, options) {
  const normalized = path.normalize(String(root || ''));
  const legacyXlsxRoot = path.normalize(path.join(__dirname, 'node_modules', 'xlsx', 'dist'));
  if (normalized === legacyXlsxRoot) root = excelDist;
  return originalStatic.call(this, root, options);
};

// P3: server.js cũ dùng chung seedData() cho cả production và demo. Trên DB trắng điều đó
// vừa tạo dữ liệu thiết bị giả, vừa lỗi vì các bản ghi demo chưa có quality_level/device_code.
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
  return source;
};

require('./safe-start');

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

require('./safe-start');

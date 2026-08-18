const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const zlib = require('zlib');
const ExcelJS = require('exceljs');
const { Readable, TransformStream } = require('stream/web');

(async () => {
  global.window = global;
  global.normalizeText = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  global.parseRowObject = obj => obj;
  global.FormData = class {};
  global.fetch = async () => { throw new Error('Không được gọi server trong test raw reader'); };

  // Node CI chưa bảo đảm hỗ trợ DecompressionStream('deflate-raw') ở mọi phiên bản.
  // Shim nhỏ này chỉ phục vụ test, dùng zlib built-in để mô phỏng Web API tương ứng.
  global.DecompressionStream = class {
    constructor(format) {
      assert.equal(format, 'deflate-raw');
      let chunks = [];
      return new TransformStream({
        transform(chunk) { chunks.push(Buffer.from(chunk)); },
        flush(controller) {
          const output = zlib.inflateRawSync(Buffer.concat(chunks));
          controller.enqueue(new Uint8Array(output));
        }
      });
    }
  };

  const code = fs.readFileSync(path.join(__dirname, 'public', 'import-excel-server-reader.js'), 'utf8');
  vm.runInThisContext(code, { filename: 'import-excel-server-reader.js' });
  assert.ok(window.__QY4_XLSX_RAW_READER__?.parseXlsxRaw, 'Phải đăng ký raw XLSX reader');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('IMPORT_READY');
  ws.addRow(['STT nguồn','Mã khoa','Khoa/Phòng','Mã nhóm','Nhóm thiết bị','Tên thiết bị','Serial Number']);
  ws.addRow([1,'C7','C7 - Khoa Chẩn đoán hình ảnh - Chức năng','XQ','X-quang','Máy X-quang','SN001']);
  ws.addRow([2,'A2','A2 - Khoa Nội Tim mạch - Hô hấp','ĐT','Điện tim','Máy điện tim','SN002']);
  wb.addWorksheet('HUONG_DAN').addRow(['Hướng dẫn']);

  const buffer = await wb.xlsx.writeBuffer();
  const parsed = await window.__QY4_XLSX_RAW_READER__.parseXlsxRaw(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  assert.equal(parsed.sheetName, 'IMPORT_READY');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]['Serial Number'], 'SN001');
  assert.equal(parsed.rows[1]['Mã nhóm'], 'ĐT');
  assert.equal(parsed.rows[1]['Tên thiết bị'], 'Máy điện tim');

  console.log('[IMPORT XLSX RAW] PASS - đọc trực tiếp ZIP/XML, không phụ thuộc ExcelJS load workbook.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

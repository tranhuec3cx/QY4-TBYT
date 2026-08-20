const assert = require('assert');
const Database = require('better-sqlite3');
const codes = require('./device-code-service');

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE devices (
    id INTEGER PRIMARY KEY,
    department_code TEXT NOT NULL,
    group_code TEXT NOT NULL,
    device_code TEXT UNIQUE
  );
`);
codes.ensureAliasTable(db);

// 1) Quy tắc phải bao quát mọi khoa, không hard-code A10/A9.
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (1,?,?,?)')
  .run('B5', 'GM', 'B5.GM.0007');
assert.strictEqual(
  codes.allocate(db, { deviceId: 1, departmentCode: 'B9', groupCode: 'GM', currentCode: 'B5.GM.0007' }),
  'B9.GM.0007',
  'B5 -> B9 phải đổi tiền tố và giữ số cuối khi chưa trùng.'
);

// 2) Nếu số cuối đã có ở khoa đích thì tự cấp số kế tiếp.
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (2,?,?,?)')
  .run('B9', 'GM', 'B9.GM.0007');
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (3,?,?,?)')
  .run('B9', 'GM', 'B9.GM.0010');
assert.strictEqual(
  codes.allocate(db, { deviceId: 1, departmentCode: 'B9', groupCode: 'GM', currentCode: 'B5.GM.0007' }),
  'B9.GM.0011',
  'Mã đích bị trùng phải lấy số kế tiếp an toàn.'
);

// 3) Ký tự Đ phải được giữ nguyên ở mọi khoa/nhóm.
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (4,?,?,?)')
  .run('A10', 'ĐC', 'A10.ĐC.0001');
assert.strictEqual(codes.expectedPrefix('A9', 'ĐC'), 'A9.ĐC.');
assert.strictEqual(
  codes.allocate(db, { deviceId: 4, departmentCode: 'A9', groupCode: 'ĐC', currentCode: 'A10.ĐC.0001' }),
  'A9.ĐC.0001'
);

// 4) Mã cũ được giữ làm alias QR và không bị cấp cho thiết bị khác.
codes.rememberAlias(db, 'B5.GM.0007', 1);
db.prepare('UPDATE devices SET department_code=?,device_code=? WHERE id=1').run('B9', 'B9.GM.0011');
const alias = db.prepare('SELECT device_id FROM device_code_aliases WHERE old_code=?').get('B5.GM.0007');
assert.strictEqual(Number(alias.device_id), 1, 'Mã cũ phải trỏ về đúng thiết bị.');
assert.notStrictEqual(
  codes.allocate(db, { departmentCode: 'B5', groupCode: 'GM', currentCode: '' }),
  'B5.GM.0007',
  'Không được tái sử dụng mã cũ của QR cho thiết bị khác.'
);

// 5) Đồng bộ hàng loạt phải xử lý mọi cặp khoa/nhóm.
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (5,?,?,?)')
  .run('C7', 'SA', 'A2.SA.0003');
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (6,?,?,?)')
  .run('B1', 'XQ', 'C15.XQ.0002');
const changed = codes.syncMany(db, [5, 6]);
assert.strictEqual(changed.length, 2);
assert.strictEqual(db.prepare('SELECT device_code FROM devices WHERE id=5').get().device_code, 'C7.SA.0003');
assert.strictEqual(db.prepare('SELECT device_code FROM devices WHERE id=6').get().device_code, 'B1.XQ.0002');

// 6) Nếu chỉ đổi nhóm trong cùng khoa cũng phải đồng bộ.
db.prepare('INSERT INTO devices(id,department_code,group_code,device_code) VALUES (7,?,?,?)')
  .run('A9', 'ĐX', 'A9.ĐC.0005');
const groupChanged = codes.syncMany(db, [7]);
assert.strictEqual(groupChanged.length, 1);
assert.strictEqual(db.prepare('SELECT device_code FROM devices WHERE id=7').get().device_code, 'A9.ĐX.0005');

console.log('[DEVICE CODE SERVICE] PASS - mọi Khoa/Nhóm, giữ Đ, tránh trùng và giữ alias QR.');
db.close();

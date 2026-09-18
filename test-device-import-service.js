const assert = require('assert');
const { commitDeviceImport, normalizeInsertRow, normalizeUpdateRow } = require('./device-import-service');

class FakeDb {
  constructor() {
    this.departments = [{ code:'C2', name:'Khoa Xét nghiệm' }];
    this.groups = [{ code:'SH', name:'Sinh hóa' }];
    this.devices = [];
    this.nextId = 1;
  }

  prepare(sql) {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    if (text === 'SELECT code FROM departments') return { all:() => this.departments.map(x => ({ code:x.code })) };
    if (text === 'SELECT code FROM device_groups') return { all:() => this.groups.map(x => ({ code:x.code })) };
    if (text.startsWith('INSERT OR IGNORE INTO departments')) return { run:(code,name) => {
      if (!this.departments.some(x => x.code === code)) this.departments.push({ code, name });
    } };
    if (text.startsWith('INSERT OR IGNORE INTO device_groups')) return { run:(code,name) => {
      if (!this.groups.some(x => x.code === code)) this.groups.push({ code, name });
    } };
    if (text.startsWith('SELECT id FROM devices WHERE lower')) return { get:serial => this.devices.find(x => x.serial.toLowerCase() === String(serial).toLowerCase()) };
    if (text.startsWith('SELECT * FROM devices WHERE lower')) return { all:serial => this.devices.filter(x => x.serial.toLowerCase() === String(serial).toLowerCase()).map(x => ({ ...x })) };
    if (text.startsWith('INSERT INTO devices')) return { run:payload => {
      if (payload.serial === 'FAIL') throw new Error('Lỗi mô phỏng khi ghi');
      this.devices.push({ id:this.nextId++, ...payload });
      return { lastInsertRowid:this.nextId - 1 };
    } };
    if (text.startsWith('UPDATE devices SET')) return { run:payload => {
      if (payload.model === 'FAIL') throw new Error('Lỗi mô phỏng khi cập nhật');
      const index = this.devices.findIndex(x => x.id === payload.id);
      this.devices[index] = { ...this.devices[index], ...payload };
    } };
    throw new Error(`SQL chưa mô phỏng: ${text}`);
  }

  transaction(fn) {
    return () => {
      const snapshot = JSON.stringify({
        departments:this.departments,
        groups:this.groups,
        devices:this.devices,
        nextId:this.nextId
      });
      try { return fn(); }
      catch (error) {
        const old = JSON.parse(snapshot);
        this.departments = old.departments;
        this.groups = old.groups;
        this.devices = old.devices;
        this.nextId = old.nextId;
        throw error;
      }
    };
  }
}

const codes = {
  ensureAliasTable() {},
  allocate(db, { departmentCode, groupCode }) {
    const count = db.devices.filter(x => x.department_code === departmentCode && x.group_code === groupCode).length + 1;
    return `${departmentCode}.${groupCode}.${String(count).padStart(4, '0')}`;
  }
};

function insertRow(serial, overrides = {}) {
  return {
    sourceStt:serial,
    departmentName:'Khoa Xét nghiệm',
    groupName:'Sinh hóa',
    payload:{ department_code:'C2', group_code:'SH', name:`Máy ${serial}`, serial, ...overrides }
  };
}

assert.strictEqual(normalizeInsertRow(insertRow(' SN01 '), 0).payload.serial, 'SN01');
assert.deepStrictEqual(normalizeUpdateRow({ serial:' SN01 ', updates:{ model:' M1 ', cost:'1200' } }, 0).updates, { model:'M1', cost:1200 });

{
  const db = new FakeDb();
  const result = commitDeviceImport(db, codes, { mode:'insert', rows:[insertRow('SN01'), insertRow('SN02')] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.inserted, 2);
  assert.deepStrictEqual(db.devices.map(x => x.device_code), ['C2.SH.0001','C2.SH.0002']);
}

{
  const db = new FakeDb();
  const result = commitDeviceImport(db, codes, { mode:'insert', rows:[insertRow('SN01'), insertRow('sn01')] });
  assert.strictEqual(result.ok, false, 'Serial trùng trong file phải chặn cả lô.');
  assert.strictEqual(db.devices.length, 0);
  assert.strictEqual(result.errors.length, 2);
}

{
  const db = new FakeDb();
  assert.throws(
    () => commitDeviceImport(db, codes, { mode:'insert', rows:[insertRow('SN01'), insertRow('FAIL')] }),
    /Lỗi mô phỏng/
  );
  assert.strictEqual(db.devices.length, 0, 'Một dòng ghi lỗi phải hoàn tác các dòng đã ghi trước đó.');
}

{
  const db = new FakeDb();
  db.devices.push({
    id:db.nextId++, department_code:'C2', group_code:'SH', name:'Máy cũ', serial:'SN01',
    manufacturer:'', model:'OLD', country:'', year_manufactured:null, year_in_use:null,
    warranty_end:'', quality_level:3, cost:0, funding:'', location:'', insurance_code:''
  });
  const result = commitDeviceImport(db, codes, { mode:'update', rows:[{ sourceStt:'1', serial:'SN01', updates:{ model:'NEW', cost:500 } }] });
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(db.devices[0].model, 'NEW');
  assert.strictEqual(db.devices[0].department_code, 'C2', 'Cập nhật Excel không được đổi Khoa/Nhóm và định danh.');
}

console.log('[DEVICE IMPORT] PASS - kiểm tra lô, chống trùng Serial và transaction hoàn tác toàn bộ khi có lỗi.');

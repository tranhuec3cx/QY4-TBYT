const INSERT_FIELDS = [
  'department_code','group_code','name','manufacturer','model','year_in_use',
  'warranty_end','status','quality_level','serial','country','year_manufactured',
  'cost','funding','location','note','device_code','insurance_code'
];

const UPDATE_FIELDS = [
  'manufacturer','model','country','year_manufactured','year_in_use','warranty_end',
  'quality_level','cost','funding','location','insurance_code'
];

function text(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function serialKey(value) {
  return text(value).toLowerCase();
}

function numberOrNull(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  return v >= min && v <= max ? v : null;
}

function sourceRef(row, index) {
  return text(row?.sourceStt || row?.source_stt) || String(index + 1);
}

function normalizeInsertRow(row, index) {
  const source = row?.payload && typeof row.payload === 'object' ? row.payload : row || {};
  const payload = {};
  INSERT_FIELDS.forEach(field => { payload[field] = source[field]; });
  payload.department_code = text(payload.department_code).toUpperCase();
  payload.group_code = text(payload.group_code).toUpperCase();
  payload.name = text(payload.name);
  payload.serial = text(payload.serial);
  payload.manufacturer = text(payload.manufacturer);
  payload.model = text(payload.model);
  payload.warranty_end = text(payload.warranty_end);
  payload.status = text(payload.status) || 'Đang hoạt động';
  payload.country = text(payload.country);
  payload.funding = text(payload.funding);
  payload.location = text(payload.location);
  payload.note = text(payload.note);
  payload.insurance_code = text(payload.insurance_code);
  payload.device_code = '';
  payload.year_in_use = numberOrNull(payload.year_in_use, 1900, 2200);
  payload.year_manufactured = numberOrNull(payload.year_manufactured, 1900, 2200);
  payload.quality_level = numberOrNull(payload.quality_level, 1, 5) || 3;
  payload.cost = Math.max(0, Number(payload.cost) || 0);
  return {
    sourceStt: sourceRef(row, index),
    departmentName: text(row?.departmentName || row?.department_name),
    groupName: text(row?.groupName || row?.group_name),
    payload
  };
}

function normalizeUpdateRow(row, index) {
  const updates = {};
  const source = row?.updates && typeof row.updates === 'object' ? row.updates : {};
  UPDATE_FIELDS.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return;
    let value = source[field];
    if (field === 'year_in_use' || field === 'year_manufactured') value = numberOrNull(value, 1900, 2200);
    else if (field === 'quality_level') value = numberOrNull(value, 1, 5);
    else if (field === 'cost') value = Math.max(0, Number(value) || 0);
    else value = text(value);
    if (value !== null && value !== undefined && (value !== '' || field === 'cost')) updates[field] = value;
  });
  return { sourceStt:sourceRef(row, index), serial:text(row?.serial), updates };
}

function duplicateSerials(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const key = serialKey(row.payload?.serial ?? row.serial);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function errorRow(row, message) {
  return {
    sourceStt: row.sourceStt,
    serial: row.payload?.serial ?? row.serial ?? '',
    name: row.payload?.name ?? '',
    error: message
  };
}

function commitInsert(db, deviceCodes, body) {
  const rows = body.rows.map(normalizeInsertRow);
  const duplicates = duplicateSerials(rows);
  const autoCreate = body.autoCreateCatalogs === true;
  const departments = new Set(db.prepare('SELECT code FROM departments').all().map(x => text(x.code).toUpperCase()));
  const groups = new Set(db.prepare('SELECT code FROM device_groups').all().map(x => text(x.code).toUpperCase()));
  const errors = [];
  const skipped = [];

  rows.forEach(row => {
    const p = row.payload;
    const issues = [];
    if (!p.department_code) issues.push('Thiếu Khoa/Phòng');
    if (!p.group_code) issues.push('Thiếu Nhóm thiết bị');
    if (!p.name) issues.push('Thiếu Tên thiết bị');
    if (!p.serial) issues.push('Thiếu Serial Number');
    if (p.serial && duplicates.has(serialKey(p.serial))) issues.push('Trùng Serial trong file');
    if (p.department_code && !departments.has(p.department_code) && (!autoCreate || !row.departmentName)) {
      issues.push(`Khoa ${p.department_code} chưa có trong hệ thống`);
    }
    if (p.group_code && !groups.has(p.group_code) && (!autoCreate || !row.groupName)) {
      issues.push(`Nhóm ${p.group_code} chưa có trong hệ thống`);
    }
    if (issues.length) errors.push(errorRow(row, issues.join('; ')));
  });

  if (errors.length) return { ok:false, inserted:0, updated:0, skipped:0, errors };

  deviceCodes.ensureAliasTable(db);
  const insertDepartment = db.prepare('INSERT OR IGNORE INTO departments(code,name) VALUES (?,?)');
  const insertGroup = db.prepare('INSERT OR IGNORE INTO device_groups(code,name) VALUES (?,?)');
  const findSerial = db.prepare("SELECT id FROM devices WHERE lower(trim(COALESCE(serial,'')))=lower(?) LIMIT 1");
  const insertDevice = db.prepare(`
    INSERT INTO devices
      (department_code,group_code,name,manufacturer,model,year_in_use,warranty_end,status,
       quality_level,serial,country,year_manufactured,cost,funding,location,note,device_code,insurance_code)
    VALUES
      (@department_code,@group_code,@name,@manufacturer,@model,@year_in_use,@warranty_end,@status,
       @quality_level,@serial,@country,@year_manufactured,@cost,@funding,@location,@note,@device_code,@insurance_code)
  `);

  let inserted = 0;
  const tx = db.transaction(() => {
    if (autoCreate) {
      rows.forEach(row => {
        if (!departments.has(row.payload.department_code)) insertDepartment.run(row.payload.department_code, row.departmentName);
        if (!groups.has(row.payload.group_code)) insertGroup.run(row.payload.group_code, row.groupName);
      });
    }
    rows.forEach(row => {
      if (findSerial.get(row.payload.serial)) {
        skipped.push(errorRow(row, 'Serial đã tồn tại trong hệ thống — đã bỏ qua'));
        return;
      }
      row.payload.device_code = deviceCodes.allocate(db, {
        departmentCode:row.payload.department_code,
        groupCode:row.payload.group_code
      });
      insertDevice.run(row.payload);
      inserted++;
    });
  });
  tx();
  return { ok:true, inserted, updated:0, skipped:skipped.length, skippedRows:skipped, errors:[] };
}

function commitUpdate(db, body) {
  const rows = body.rows.map(normalizeUpdateRow);
  const duplicates = duplicateSerials(rows);
  const errors = [];
  const matched = [];

  rows.forEach(row => {
    const issues = [];
    if (!row.serial) issues.push('Thiếu Serial Number');
    if (row.serial && duplicates.has(serialKey(row.serial))) issues.push('Trùng Serial trong file cập nhật');
    if (!Object.keys(row.updates).length) issues.push('Không có trường nào để cập nhật');
    const devices = row.serial
      ? db.prepare("SELECT * FROM devices WHERE lower(trim(COALESCE(serial,'')))=lower(?)").all(row.serial)
      : [];
    if (row.serial && devices.length === 0) issues.push('Serial chưa có trong hệ thống');
    if (devices.length > 1) issues.push('Serial đang trùng trong hệ thống');
    if (issues.length) errors.push(errorRow(row, issues.join('; ')));
    else matched.push({ row, device:devices[0] });
  });

  if (errors.length) return { ok:false, inserted:0, updated:0, skipped:0, errors };

  const update = db.prepare(`
    UPDATE devices SET manufacturer=@manufacturer,model=@model,country=@country,
      year_manufactured=@year_manufactured,year_in_use=@year_in_use,warranty_end=@warranty_end,
      quality_level=@quality_level,cost=@cost,funding=@funding,location=@location,
      insurance_code=@insurance_code
    WHERE id=@id
  `);
  const tx = db.transaction(() => {
    matched.forEach(({ row, device }) => {
      const payload = { ...device, ...row.updates, id:device.id };
      update.run(payload);
    });
  });
  tx();
  return { ok:true, inserted:0, updated:matched.length, skipped:0, errors:[] };
}

function commitDeviceImport(db, deviceCodes, body = {}) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return { ok:false, inserted:0, updated:0, skipped:0, errors:[{ sourceStt:'', serial:'', name:'', error:'Không có dòng dữ liệu để xử lý' }] };
  if (rows.length > 5000) return { ok:false, inserted:0, updated:0, skipped:0, errors:[{ sourceStt:'', serial:'', name:'', error:'Mỗi lần chỉ xử lý tối đa 5.000 dòng' }] };
  return body.mode === 'update' ? commitUpdate(db, body) : commitInsert(db, deviceCodes, body);
}

module.exports = {
  INSERT_FIELDS,
  UPDATE_FIELDS,
  text,
  serialKey,
  normalizeInsertRow,
  normalizeUpdateRow,
  duplicateSerials,
  commitDeviceImport
};

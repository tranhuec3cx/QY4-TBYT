function normalizePart(value, fallback = '') {
  const cleaned = String(value || fallback || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9Đ]/g, '');
  return cleaned || fallback;
}

function normalizeCode(value, departmentCode = 'XX', groupCode = 'K') {
  const dept = normalizePart(departmentCode, 'XX');
  const group = normalizePart(groupCode, 'K');
  const raw = String(value || '').trim().toUpperCase();

  let m = raw.match(/^QY4[-.]?([A-Z0-9Đ]+)[-.]([A-Z0-9Đ]+)[-.](\d{4})$/);
  if (m) return m[1] + '.' + m[2] + '.' + m[3];

  m = raw.match(/^([A-Z0-9Đ]+)[-.]([A-Z0-9Đ]+)[-.](\d{4})$/);
  if (m) return m[1] + '.' + m[2] + '.' + m[3];

  m = raw.match(/(\d{4})$/);
  if (m) return dept + '.' + group + '.' + m[1];
  return '';
}

function expectedPrefix(departmentCode, groupCode) {
  return normalizePart(departmentCode, 'XX') + '.' + normalizePart(groupCode, 'K') + '.';
}

function ensureAliasTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_code_aliases (
      old_code TEXT PRIMARY KEY,
      device_id INTEGER NOT NULL,
      changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_device_code_aliases_device_id
      ON device_code_aliases(device_id);
  `);
}

function isAvailable(db, code, deviceId = 0) {
  const live = db.prepare('SELECT id FROM devices WHERE device_code=? AND id<>? LIMIT 1').get(code, Number(deviceId || 0));
  if (live) return false;
  try {
    const alias = db.prepare('SELECT device_id FROM device_code_aliases WHERE old_code=? AND device_id<>? LIMIT 1').get(code, Number(deviceId || 0));
    if (alias) return false;
  } catch {}
  return true;
}

function suffixOf(code) {
  const m = String(code || '').trim().match(/(\d{4})$/);
  return m ? m[1] : '';
}

function prefixNumbers(db, prefix) {
  const numbers = [];
  for (const row of db.prepare('SELECT device_code AS code FROM devices WHERE device_code LIKE ?').all(prefix + '%')) {
    const m = String(row.code || '').match(/\.(\d{4})$/);
    if (m) numbers.push(Number(m[1]));
  }
  try {
    for (const row of db.prepare('SELECT old_code AS code FROM device_code_aliases WHERE old_code LIKE ?').all(prefix + '%')) {
      const m = String(row.code || '').match(/\.(\d{4})$/);
      if (m) numbers.push(Number(m[1]));
    }
  } catch {}
  return numbers;
}

function allocate(db, { deviceId = 0, departmentCode, groupCode, currentCode = '' }) {
  ensureAliasTable(db);
  const prefix = expectedPrefix(departmentCode, groupCode);
  const current = normalizeCode(currentCode, departmentCode, groupCode) || String(currentCode || '').trim().toUpperCase();

  if (current && current.startsWith(prefix) && isAvailable(db, current, deviceId)) return current;

  const suffix = suffixOf(current);
  if (suffix) {
    const preferred = prefix + suffix;
    if (isAvailable(db, preferred, deviceId)) return preferred;
  }

  const values = prefixNumbers(db, prefix);
  let next = values.length ? Math.max(...values) + 1 : 1;
  let candidate = prefix + String(next).padStart(4, '0');
  while (!isAvailable(db, candidate, deviceId)) {
    next += 1;
    candidate = prefix + String(next).padStart(4, '0');
  }
  return candidate;
}

function rememberAlias(db, oldCode, deviceId) {
  ensureAliasTable(db);
  const code = String(oldCode || '').trim().toUpperCase();
  if (!code) return;
  const liveOther = db.prepare('SELECT id FROM devices WHERE device_code=? AND id<>? LIMIT 1').get(code, Number(deviceId || 0));
  if (liveOther) return;
  db.prepare(`
    INSERT INTO device_code_aliases(old_code, device_id, changed_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(old_code) DO UPDATE SET
      device_id=excluded.device_id,
      changed_at=CURRENT_TIMESTAMP
  `).run(code, Number(deviceId));
}

function needsSync(device) {
  if (!device) return false;
  const current = String(device.device_code || '').trim().toUpperCase();
  return !current.startsWith(expectedPrefix(device.department_code, device.group_code));
}

function syncOne(db, deviceId, departmentCode = null, groupCode = null) {
  ensureAliasTable(db);
  const row = db.prepare('SELECT id,department_code,group_code,device_code FROM devices WHERE id=?').get(Number(deviceId));
  if (!row) return null;
  const dept = String(departmentCode || row.department_code || '').trim();
  const group = String(groupCode || row.group_code || '').trim();
  const oldCode = String(row.device_code || '').trim();
  const newCode = allocate(db, {
    deviceId: row.id,
    departmentCode: dept,
    groupCode: group,
    currentCode: oldCode
  });
  return { id: Number(row.id), old_code: oldCode, new_code: newCode, department_code: dept, group_code: group, changed: oldCode !== newCode };
}

function syncMany(db, ids = null) {
  ensureAliasTable(db);
  let rows;
  if (Array.isArray(ids) && ids.length) {
    const cleanIds = [...new Set(ids.map(Number).filter(Number.isFinite).filter(x => x > 0))];
    if (!cleanIds.length) return [];
    const placeholders = cleanIds.map(() => '?').join(',');
    rows = db.prepare(`SELECT id,department_code,group_code,device_code FROM devices WHERE id IN (${placeholders}) ORDER BY id`).all(...cleanIds);
  } else {
    rows = db.prepare('SELECT id,department_code,group_code,device_code FROM devices ORDER BY id').all();
  }

  const changes = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!needsSync(row)) continue;
      const planned = syncOne(db, row.id, row.department_code, row.group_code);
      if (!planned || !planned.changed) continue;
      rememberAlias(db, planned.old_code, row.id);
      db.prepare('UPDATE devices SET device_code=? WHERE id=?').run(planned.new_code, row.id);
      changes.push(planned);
    }
  });
  tx();
  return changes;
}

module.exports = {
  normalizePart,
  normalizeCode,
  expectedPrefix,
  ensureAliasTable,
  allocate,
  rememberAlias,
  needsSync,
  syncOne,
  syncMany
};

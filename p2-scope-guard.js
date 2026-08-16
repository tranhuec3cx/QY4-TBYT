function attach({ app, Database, dbPath, getUser, isTech }) {
  let conn = null;
  function db() {
    if (!conn) {
      conn = new Database(dbPath);
      try { conn.pragma('busy_timeout = 5000'); } catch {}
    }
    return conn;
  }
  function deny(res) { return res.status(403).json({ error: 'Không có quyền truy cập dữ liệu của khoa khác.' }); }

  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const user = getUser(req);
    if (!user) return next();

    // Chụp path ngay khi đang ở mount /api. Khi response trả về, Express có thể đã
    // phục hồi req.url về dạng /api/... nên không dùng req.path động trong res.json.
    const scopedPath = req.path;
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      let data = payload;
      if (scopedPath === '/users' && Array.isArray(data)) {
        data = data.map(({ password_salt, password_hash, ...safe }) => safe);
      }
      if (!isTech(user)) {
        if (scopedPath === '/devices' && Array.isArray(data)) {
          data = data.filter(x => x.department_code === user.department_code);
        }
        if (scopedPath === '/incidents' && Array.isArray(data)) {
          data = data.filter(x => {
            const dep = String(x.department_code || x.department_snapshot || '');
            return dep === user.department_code || dep.startsWith(`${user.department_code} `) || dep.startsWith(`${user.department_code} -`);
          });
        }
      }
      return originalJson(data);
    };

    if (isTech(user)) return next();

    let m = scopedPath.match(/^\/devices\/(\d+)$/);
    if (m) {
      const row = db().prepare('SELECT department_code FROM devices WHERE id=?').get(Number(m[1]));
      if (!row || row.department_code !== user.department_code) return deny(res);
      return next();
    }

    m = scopedPath.match(/^\/incidents\/(\d+)$/);
    if (m) {
      const row = db().prepare('SELECT dv.department_code FROM incidents i JOIN devices dv ON dv.id=i.device_id WHERE i.id=?').get(Number(m[1]));
      if (!row || row.department_code !== user.department_code) return deny(res);
      return next();
    }

    return next();
  });
}

module.exports = { attach };

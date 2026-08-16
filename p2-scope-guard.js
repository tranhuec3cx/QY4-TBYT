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
    if (!user || isTech(user)) return next();

    let m = req.path.match(/^\/devices\/(\d+)$/);
    if (m) {
      const row = db().prepare('SELECT department_code FROM devices WHERE id=?').get(Number(m[1]));
      if (!row || row.department_code !== user.department_code) return deny(res);
      return next();
    }

    m = req.path.match(/^\/incidents\/(\d+)$/);
    if (m) {
      const row = db().prepare('SELECT dv.department_code FROM incidents i JOIN devices dv ON dv.id=i.device_id WHERE i.id=?').get(Number(m[1]));
      if (!row || row.department_code !== user.department_code) return deny(res);
      return next();
    }

    return next();
  });
}

module.exports = { attach };

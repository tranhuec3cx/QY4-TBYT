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
    // Chụp path ngay khi đang ở mount /api. Khi response trả về, Express có thể đã
    // phục hồi req.url về dạng /api/... nên không dùng req.path động trong res.json.
    const scopedPath = req.path;

    // RC1: phiếu sửa chữa đã kết thúc là hồ sơ lịch sử, không cho hủy trực tiếp qua API.
    // Đặt guard trong middleware /api hiện hữu để giữ tương thích với Express và test harness P4.
    if (req.method === 'DELETE') {
      const repairMatch = scopedPath.match(/^\/repairs\/(\d+)$/);
      if (repairMatch) {
        const row = db().prepare('SELECT processing_status FROM repairs WHERE id=?').get(Number(repairMatch[1]));
        if (row) {
          const raw = String(row.processing_status || '').trim();
          const normalized = ['Đã sửa xong', 'Bàn giao sử dụng', 'Hoàn thành'].includes(raw)
            ? 'Đã hoàn thành'
            : (['Hủy', 'Huỷ', 'Đã huỷ'].includes(raw) ? 'Đã hủy' : raw);
          if (['Đã hoàn thành', 'Không sửa được', 'Đã hủy'].includes(normalized)) {
            return res.status(409).json({
              error: 'Phiếu sửa chữa đã kết thúc nên không thể hủy trực tiếp. Hãy bổ sung/cập nhật hồ sơ để bảo toàn lịch sử thiết bị.'
            });
          }
        }
      }
      return next();
    }

    if (req.method !== 'GET') return next();
    const user = getUser(req);
    if (!user) return next();

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
        // /api/devices/:id của server cũ trả kèm toàn bộ hồ sơ kỹ thuật (sửa chữa,
        // bảo dưỡng, kiểm định, nhật ký vận hành và tài liệu). Các API con này vốn đã
        // bị P2 chặn với tài khoản khoa, vì vậy phải redaction ở payload chi tiết để
        // không thể đọc vòng qua endpoint thiết bị.
        if (/^\/devices\/\d+$/.test(scopedPath) && data && typeof data === 'object' && !Array.isArray(data)) {
          data = {
            ...data,
            repairs: [],
            maintenances: [],
            inspections: [],
            operation_logs: [],
            documents: []
          };
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

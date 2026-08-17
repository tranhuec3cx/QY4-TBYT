const crypto = require('crypto');

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
  function isAdmin(user) { return /quản trị/i.test(String(user?.role || '')); }
  function isSettingsUser(user) { return isAdmin(user) || isTech(user); }
  function safeUserRow(row) {
    if (!row) return row;
    const { password_salt, password_hash, ...safe } = row;
    return safe;
  }
  function hashPassword(password, salt) {
    return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
  }
  function makePasswordFields(password) {
    const raw = String(password || '');
    if (raw.length < 10) throw new Error('Mật khẩu phải có ít nhất 10 ký tự.');
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: hashPassword(raw, salt) };
  }
  function normalizeUserPayload(body = {}) {
    return {
      full_name: String(body.full_name || '').trim(),
      username: String(body.username || '').trim(),
      role: String(body.role || '').trim(),
      department_code: String(body.department_code || '').trim() || null,
      status: String(body.status || 'Hoạt động').trim(),
      phone: String(body.phone || '').trim()
    };
  }
  function validateUserPayload(payload) {
    if (!payload.full_name) return 'Thiếu họ và tên.';
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(payload.username)) return 'Tên đăng nhập phải có 3-50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.';
    if (!['Quản trị viên', 'Khoa Trang bị', 'Khoa sử dụng'].includes(payload.role)) return 'Vai trò không hợp lệ.';
    if (!['Hoạt động', 'Khóa'].includes(payload.status)) return 'Trạng thái không hợp lệ.';
    if (payload.role !== 'Quản trị viên' && !payload.department_code) return 'Tài khoản đơn vị phải chọn khoa/phòng.';
    return '';
  }

  app.use('/api', (req, res, next) => {
    // Chụp path ngay khi đang ở mount /api. Khi response trả về, Express có thể đã
    // phục hồi req.url về dạng /api/... nên không dùng req.path động trong res.json.
    const scopedPath = req.path;
    const user = getUser(req);

    // ===== Cài đặt / tài khoản =====
    // Server lõi vẫn giữ API /api/users cũ để tương thích, nhưng mọi request tới
    // endpoint này được chặn và xử lý tại đây để bảo đảm chỉ Quản trị viên được quản lý.
    const userIdMatch = scopedPath.match(/^\/users\/(\d+)$/);
    if (scopedPath === '/users' || userIdMatch) {
      if (!user) return res.status(401).json({ error: 'Chưa đăng nhập.' });
      if (!isAdmin(user)) return res.status(403).json({ error: 'Chỉ Quản trị viên được quản lý tài khoản người dùng.' });

      if (req.method === 'GET' && scopedPath === '/users') {
        const rows = db().prepare(`
          SELECT u.id,u.full_name,u.username,u.role,u.department_code,u.status,u.phone,
                 u.must_change_password,u.last_login_at,d.name AS department_name
          FROM users u
          LEFT JOIN departments d ON d.code=u.department_code
          ORDER BY CASE WHEN u.username='admin' THEN 0 ELSE 1 END, u.full_name COLLATE NOCASE
        `).all();
        return res.json(rows.map(safeUserRow));
      }

      if (req.method === 'POST' && scopedPath === '/users') {
        try {
          const payload = normalizeUserPayload(req.body || {});
          const validation = validateUserPayload(payload);
          if (validation) return res.status(400).json({ error: validation });
          if (db().prepare('SELECT id FROM users WHERE lower(username)=lower(?)').get(payload.username)) {
            return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
          }
          let password = String(req.body?.password || '').trim();
          let generated = false;
          if (!password) {
            password = `QY4!${crypto.randomBytes(9).toString('base64url')}`;
            generated = true;
          }
          const pw = makePasswordFields(password);
          const info = db().prepare(`
            INSERT INTO users
              (full_name,username,role,department_code,status,phone,password_salt,password_hash,must_change_password)
            VALUES (?,?,?,?,?,?,?,?,1)
          `).run(payload.full_name, payload.username, payload.role, payload.department_code,
                 payload.status, payload.phone, pw.salt, pw.hash);
          return res.status(201).json({
            id: info.lastInsertRowid,
            ok: true,
            temporary_password: generated ? password : undefined,
            must_change_password: 1
          });
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Không tạo được tài khoản.' });
        }
      }

      if (req.method === 'PUT' && userIdMatch) {
        try {
          const id = Number(userIdMatch[1]);
          const target = db().prepare('SELECT id,username,role,status FROM users WHERE id=?').get(id);
          if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
          const payload = normalizeUserPayload(req.body || {});
          const validation = validateUserPayload(payload);
          if (validation) return res.status(400).json({ error: validation });
          const duplicate = db().prepare('SELECT id FROM users WHERE lower(username)=lower(?) AND id<>?').get(payload.username, id);
          if (duplicate) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
          if (id === Number(user.id) && (payload.status !== 'Hoạt động' || payload.role !== 'Quản trị viên')) {
            return res.status(409).json({ error: 'Không thể tự khóa hoặc tự hạ quyền tài khoản Quản trị viên đang đăng nhập.' });
          }
          if (/quản trị/i.test(String(target.role || '')) && (payload.status !== 'Hoạt động' || payload.role !== 'Quản trị viên')) {
            const activeAdmins = db().prepare(`SELECT COUNT(*) AS n FROM users WHERE status='Hoạt động' AND role LIKE '%Quản trị%'`).get()?.n || 0;
            if (Number(activeAdmins) <= 1) return res.status(409).json({ error: 'Hệ thống phải còn ít nhất một Quản trị viên đang hoạt động.' });
          }
          db().prepare(`
            UPDATE users SET full_name=?,username=?,role=?,department_code=?,status=?,phone=? WHERE id=?
          `).run(payload.full_name, payload.username, payload.role, payload.department_code,
                 payload.status, payload.phone, id);
          if (payload.status !== 'Hoạt động') {
            try { db().prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id); } catch {}
          }
          return res.json({ ok: true });
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Không cập nhật được tài khoản.' });
        }
      }

      if (req.method === 'DELETE' && userIdMatch) {
        return res.status(405).json({ error: 'Không xóa tài khoản để bảo toàn nhật ký. Hãy chuyển trạng thái sang Khóa.' });
      }
    }

    // Khoa Trang bị/Quản trị được phép dùng màn Cài đặt danh mục; tài khoản khoa sử dụng không được sửa danh mục.
    if ((scopedPath === '/departments' || scopedPath.startsWith('/departments/') || scopedPath === '/device-groups' || scopedPath.startsWith('/device-groups/'))
        && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!user) return res.status(401).json({ error: 'Chưa đăng nhập.' });
      if (!isSettingsUser(user)) return res.status(403).json({ error: 'Không có quyền thay đổi danh mục dùng chung.' });
    }

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
    if (!user) return next();

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      let data = payload;
      if (scopedPath === '/users' && Array.isArray(data)) {
        data = data.map(safeUserRow);
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

const { signQrKey, verifyQrKey, normalizeKind, normalizeKey } = require('./p7-qr-token');

function connection(Database, dbPath) {
  const conn = new Database(dbPath);
  try { conn.pragma('busy_timeout = 5000'); } catch {}
  return conn;
}

function deviceByKey(conn, kind, key) {
  if (kind === 'id') return conn.prepare('SELECT id,device_code,name FROM devices WHERE id=? LIMIT 1').get(Number(key)) || null;
  return conn.prepare('SELECT id,device_code,name FROM devices WHERE device_code=? LIMIT 1').get(String(key)) || null;
}

function tokenFrom(req) {
  return String(req.query?.token || req.query?.t || '').trim();
}

function denyToken(res) {
  return res.status(403).json({ error: 'Mã QR không hợp lệ hoặc đã được thay khóa. Vui lòng quét mã QR do Khoa Trang bị phát hành.' });
}

function attachPublicGuard({ app, Database, dbPath }) {
  const conn = connection(Database, dbPath);

  app.use('/api', (req, res, next) => {
    let kind = '';
    let key = '';

    let match = req.path.match(/^\/public\/device\/(\d+)$/);
    if (req.method === 'GET' && match) {
      kind = 'id';
      key = match[1];
    } else {
      match = req.path.match(/^\/public\/device-code\/([^/]+)$/);
      if (req.method === 'GET' && match) {
        kind = 'code';
        try { key = decodeURIComponent(match[1]); } catch { key = match[1]; }
      } else if (req.method === 'POST' && req.path === '/qr/checks') {
        try {
          kind = normalizeKind(req.query?.qr_kind || '');
          key = normalizeKey(kind, req.query?.qr_key || '');
        } catch {
          return denyToken(res);
        }
      } else {
        return next();
      }
    }

    let normalizedKey;
    try { normalizedKey = normalizeKey(kind, key); } catch { return denyToken(res); }
    if (!verifyQrKey(dbPath, kind, normalizedKey, tokenFrom(req))) return denyToken(res);

    const device = deviceByKey(conn, kind, normalizedKey);
    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị của mã QR.' });

    req.qy4QrDeviceId = Number(device.id);
    req.qy4QrKind = kind;
    req.qy4QrKey = normalizedKey;
    return next();
  });
}

function attachAuthenticatedRoutes({ app, Database, dbPath, isTech }) {
  const conn = connection(Database, dbPath);

  app.get('/api/qr/sign', (req, res) => {
    const user = req.qy4User;
    if (!user) return res.status(401).json({ error: 'Chưa đăng nhập.' });
    if (!isTech(user)) return res.status(403).json({ error: 'Chỉ Khoa Trang bị/Quản trị viên được phát hành mã QR thiết bị.' });
    if (Number(user.must_change_password || 0)) return res.status(428).json({ error: 'Bạn phải đổi mật khẩu trước khi phát hành mã QR.' });

    const deviceId = Number(req.query?.device_id || 0);
    const requestedCode = String(req.query?.device_code || '').trim();
    let device = null;
    if (deviceId) device = conn.prepare('SELECT id,device_code,name FROM devices WHERE id=? LIMIT 1').get(deviceId) || null;
    else if (requestedCode) device = conn.prepare('SELECT id,device_code,name FROM devices WHERE device_code=? LIMIT 1').get(requestedCode) || null;
    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị để phát hành QR.' });

    const kind = String(device.device_code || '').trim() ? 'code' : 'id';
    const key = kind === 'code' ? String(device.device_code).trim() : String(device.id);
    const token = signQrKey(dbPath, kind, key);
    const checkPath = `/q/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ device_id: Number(device.id), device_code: device.device_code || '', kind, key, token, check_path: checkPath });
  });
}

module.exports = { attachPublicGuard, attachAuthenticatedRoutes, deviceByKey };

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const express = require('express');
const Database = require('better-sqlite3');
const { signQrKey, verifyQrKey } = require('./p7-qr-token');
const { attachPublicGuard, attachAuthenticatedRoutes } = require('./p7-qr-security');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qy4-p7-'));
  const dbDir = path.join(root, 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'qy4_ttbyt.sqlite');
  const setup = new Database(dbPath);
  setup.exec(`
    CREATE TABLE devices (
      id INTEGER PRIMARY KEY,
      device_code TEXT,
      name TEXT,
      department_code TEXT
    );
  `);
  setup.prepare('INSERT INTO devices(id,device_code,name,department_code) VALUES (?,?,?,?)').run(1, 'A10.DT.0001', 'Máy A10', 'A10');
  setup.prepare('INSERT INTO devices(id,device_code,name,department_code) VALUES (?,?,?,?)').run(2, 'C7.XQ.0001', 'Máy C7', 'C7');
  setup.close();

  const oldSecret = process.env.QR_SIGNING_SECRET;
  delete process.env.QR_SIGNING_SECRET;

  const idToken = signQrKey(dbPath, 'id', '1');
  const codeToken = signQrKey(dbPath, 'code', 'A10.DT.0001');
  assert.ok(idToken.length >= 40, 'Token QR phải đủ dài');
  assert.ok(verifyQrKey(dbPath, 'id', '1', idToken), 'Token phải xác minh đúng ID');
  assert.ok(verifyQrKey(dbPath, 'code', 'A10.DT.0001', codeToken), 'Token phải xác minh đúng device_code');
  assert.equal(verifyQrKey(dbPath, 'id', '2', idToken), false, 'Token của thiết bị A không được dùng cho thiết bị B');
  assert.equal(verifyQrKey(dbPath, 'code', 'C7.XQ.0001', codeToken), false, 'Token code phải gắn đúng mã thiết bị');

  const secretFile = path.join(dbDir, 'qr-signing-secret');
  assert.ok(fs.existsSync(secretFile), 'Khóa QR tự sinh phải được lưu cạnh DB');
  assert.ok(fs.readFileSync(secretFile, 'utf8').trim().length >= 32, 'Khóa QR cục bộ phải đủ mạnh');

  process.env.QR_SIGNING_SECRET = 'weak';
  assert.throws(() => signQrKey(dbPath, 'id', '1'), /ít nhất 32 ký tự/, 'Không được chấp nhận khóa môi trường yếu');
  delete process.env.QR_SIGNING_SECRET;

  const app = express();
  app.set('trust proxy', false);
  attachPublicGuard({ app, Database, dbPath });
  app.use(express.json());

  app.get('/api/public/device/:id', (req, res) => res.json({ id: Number(req.params.id), signed_device_id: req.qy4QrDeviceId }));
  app.get('/api/public/device-code/:code', (req, res) => res.json({ code: req.params.code, signed_device_id: req.qy4QrDeviceId }));
  app.post('/api/qr/checks', (req, res) => res.json({ signed_device_id: req.qy4QrDeviceId, body_device_id: Number(req.body?.device_id || 0) }));

  app.use('/api', (req, _res, next) => {
    if (req.path === '/qr/sign') {
      req.qy4User = req.headers['x-test-role'] === 'dept'
        ? { role: 'Người dùng khoa', must_change_password: 0 }
        : { role: 'Kỹ sư Khoa Trang bị', must_change_password: 0 };
    }
    next();
  });
  attachAuthenticatedRoutes({
    app, Database, dbPath,
    isTech: user => /kỹ|trang bị/i.test(String(user?.role || ''))
  });

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options = {}) => fetch(base + url, { redirect: 'manual', ...options });
  const json = async res => { const text = await res.text(); try { return JSON.parse(text); } catch { return text; } };

  try {
    let r = await request('/api/public/device/1');
    assert.equal(r.status, 403, 'API thiết bị public không được chấp nhận QR thiếu token');

    r = await request('/api/public/device/1?token=sai');
    assert.equal(r.status, 403, 'API thiết bị public phải từ chối token sai');

    r = await request(`/api/public/device/1?token=${encodeURIComponent(idToken)}`);
    assert.equal(r.status, 200, 'QR ký theo ID phải mở được');
    let body = await json(r);
    assert.equal(body.signed_device_id, 1);

    r = await request(`/api/public/device-code/A10.DT.0001?token=${encodeURIComponent(codeToken)}`);
    assert.equal(r.status, 200, 'QR ký theo device_code phải mở được');
    body = await json(r);
    assert.equal(body.signed_device_id, 1);

    r = await request(`/api/public/device/2?token=${encodeURIComponent(idToken)}`);
    assert.equal(r.status, 403, 'Không được dùng token thiết bị 1 để mở thiết bị 2');

    r = await request(`/api/qr/checks?qr_kind=code&qr_key=${encodeURIComponent('A10.DT.0001')}&token=${encodeURIComponent(codeToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: 2 })
    });
    assert.equal(r.status, 200, 'POST QR có token hợp lệ phải qua guard');
    body = await json(r);
    assert.equal(body.signed_device_id, 1, 'Thiết bị tin cậy phải lấy từ token, không lấy từ body giả mạo');
    assert.equal(body.body_device_id, 2, 'Test phải thực sự gửi body giả mạo khác thiết bị');

    r = await request('/api/qr/sign?device_id=1');
    assert.equal(r.status, 200, 'Khoa Trang bị phải phát hành QR được');
    body = await json(r);
    assert.equal(body.kind, 'code');
    assert.equal(body.key, 'A10.DT.0001');
    assert.ok(verifyQrKey(dbPath, body.kind, body.key, body.token), 'Token do endpoint phát hành phải hợp lệ');
    assert.ok(String(body.check_path).includes('token='), 'Đường dẫn QR phát hành phải mang token');

    r = await request('/api/qr/sign?device_id=1', { headers: { 'X-Test-Role': 'dept' } });
    assert.equal(r.status, 403, 'Tài khoản khoa không được phát hành QR');

    console.log('[P7 TEST] PASS - signed QR, device binding, public guard và phát hành token hoạt động.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (oldSecret === undefined) delete process.env.QR_SIGNING_SECRET;
    else process.env.QR_SIGNING_SECRET = oldSecret;
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exit(1); });

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const express = require('express');
const Database = require('better-sqlite3');
const { attach } = require('./p2-security');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qy4-p2-'));
  const dbDir = path.join(root, 'db');
  const publicDir = path.join(root, 'public');
  const uploadsDir = path.join(root, 'uploads', 'documents');
  const qrUploadsDir = path.join(root, 'uploads', 'qr');
  [dbDir, publicDir, uploadsDir, qrUploadsDir].forEach(x => fs.mkdirSync(x, { recursive:true }));
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<html><body>INDEX</body></html>');
  fs.writeFileSync(path.join(publicDir, 'login.html'), '<html><body>LOGIN</body></html>');
  fs.writeFileSync(path.join(publicDir, 'change-password.html'), '<html><body>CHANGE</body></html>');
  fs.writeFileSync(path.join(publicDir, 'qr-check.html'), '<html><body>QR</body></html>');
  fs.writeFileSync(path.join(uploadsDir, 'doc-a10.txt'), 'SECRET-A10');

  const dbPath = path.join(dbDir, 'qy4_ttbyt.sqlite');
  const setup = new Database(dbPath);
  setup.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL, department_code TEXT, status TEXT NOT NULL, phone TEXT);
    CREATE TABLE devices (id INTEGER PRIMARY KEY, department_code TEXT, name TEXT);
    CREATE TABLE incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER, status TEXT);
    CREATE TABLE documents (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER, stored_name TEXT, file_path TEXT);
    CREATE TABLE maintenances (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER, stored_name TEXT, file_path TEXT);
    CREATE TABLE incident_files (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER, stored_name TEXT, file_path TEXT);
  `);
  setup.prepare('INSERT INTO users(full_name,username,role,department_code,status,phone) VALUES (?,?,?,?,?,?)').run('Admin QY4','admin','Quản trị viên','C10','Hoạt động','');
  setup.prepare('INSERT INTO users(full_name,username,role,department_code,status,phone) VALUES (?,?,?,?,?,?)').run('Khoa A10','a10user','Người dùng khoa','A10','Hoạt động','');
  setup.prepare('INSERT INTO devices(id,department_code,name) VALUES (?,?,?)').run(1,'A10','Máy A10');
  setup.prepare('INSERT INTO devices(id,department_code,name) VALUES (?,?,?)').run(2,'C7','Máy C7');
  setup.prepare('INSERT INTO documents(device_id,stored_name,file_path) VALUES (?,?,?)').run(1,'doc-a10.txt','/uploads/documents/doc-a10.txt');
  setup.close();

  process.env.ADMIN_INITIAL_PASSWORD = 'AdminStrong!123';
  process.env.AUTH_SESSION_HOURS = '8';
  process.env.DEMO_MODE = 'false';

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  const security = attach({ app, express, Database, dbPath, publicDir, uploadsDir, qrUploadsDir });
  security.initialize();

  app.get('/api/users', (_req,res) => {
    const c = new Database(dbPath); const rows = c.prepare('SELECT * FROM users ORDER BY id').all(); c.close(); res.json(rows);
  });
  app.get('/api/devices', (_req,res) => {
    const c = new Database(dbPath); const rows = c.prepare('SELECT * FROM devices ORDER BY id').all(); c.close(); res.json(rows);
  });
  app.get('/api/devices/:id', (req,res) => {
    const c = new Database(dbPath); const row = c.prepare('SELECT * FROM devices WHERE id=?').get(Number(req.params.id)); c.close(); row ? res.json(row) : res.status(404).json({error:'not found'});
  });
  app.get('/api/incidents', (_req,res) => res.json([]));
  app.post('/api/incidents', (req,res) => res.json({ok:true, device_id:req.body.device_id}));
  app.post('/api/repairs', (_req,res) => res.json({ok:true}));
  app.get('/api/qr/device/:id', (req,res) => res.json({id:Number(req.params.id), public:true}));
  app.use(express.static(publicDir));

  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (url, options={}) => fetch(base + url, { redirect:'manual', ...options });
  const cookieOf = res => String(res.headers.get('set-cookie') || '').split(';')[0];
  const json = async res => { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } };

  try {
    let r = await req('/index.html');
    assert.equal(r.status, 302, 'Trang nội bộ phải yêu cầu đăng nhập');
    assert.ok(String(r.headers.get('location')).startsWith('/login.html'));

    r = await req('/api/qr/device/1');
    assert.equal(r.status, 200, 'QR public phải truy cập được không cần phiên');

    r = await req('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:'admin',password:'sai'}) });
    assert.equal(r.status, 401, 'Mật khẩu sai phải bị từ chối');

    r = await req('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:'admin',password:'AdminStrong!123'}) });
    assert.equal(r.status, 200, 'Admin phải đăng nhập được');
    let adminCookie = cookieOf(r);
    let body = await json(r);
    assert.equal(Number(body.user.must_change_password), 1, 'Admin mới phải đổi mật khẩu');

    r = await req('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json','Cookie':adminCookie}, body:JSON.stringify({current_password:'AdminStrong!123',new_password:'AdminNewStrong!456'}) });
    assert.equal(r.status, 200, 'Admin phải đổi mật khẩu được');
    adminCookie = cookieOf(r);

    r = await req('/api/users', { headers:{'Cookie':adminCookie} });
    assert.equal(r.status, 200);
    body = await json(r);
    assert.ok(Array.isArray(body) && body.length === 2);
    assert.ok(!Object.prototype.hasOwnProperty.call(body[0], 'password_hash'), 'Không được lộ password_hash');
    assert.ok(!Object.prototype.hasOwnProperty.call(body[0], 'password_salt'), 'Không được lộ password_salt');

    r = await req('/api/auth/users/2/reset-password', { method:'POST', headers:{'Content-Type':'application/json','Cookie':adminCookie}, body:JSON.stringify({password:'DeptTempStrong!1'}) });
    assert.equal(r.status, 200, 'Admin phải cấp lại mật khẩu được');

    r = await req('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:'a10user',password:'DeptTempStrong!1'}) });
    assert.equal(r.status, 200, 'Tài khoản khoa phải đăng nhập được sau khi cấp mật khẩu');
    let deptCookie = cookieOf(r);

    r = await req('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json','Cookie':deptCookie}, body:JSON.stringify({current_password:'DeptTempStrong!1',new_password:'DeptNewStrong!2'}) });
    assert.equal(r.status, 200);
    deptCookie = cookieOf(r);

    r = await req('/api/devices', { headers:{'Cookie':deptCookie} });
    assert.equal(r.status, 200);
    body = await json(r);
    assert.deepEqual(body.map(x => x.id), [1], 'Tài khoản khoa chỉ được thấy thiết bị khoa mình');

    r = await req('/api/devices/2', { headers:{'Cookie':deptCookie} });
    assert.equal(r.status, 200, 'P2 hiện kiểm soát danh sách; route chi tiết sẽ được chặn ở lớp nghiệp vụ tiếp theo nếu cần');

    r = await req('/api/incidents', { method:'POST', headers:{'Content-Type':'application/json','Cookie':deptCookie}, body:JSON.stringify({device_id:1}) });
    assert.equal(r.status, 200, 'Khoa được báo sự cố cho thiết bị thuộc khoa');

    r = await req('/api/incidents', { method:'POST', headers:{'Content-Type':'application/json','Cookie':deptCookie}, body:JSON.stringify({device_id:2}) });
    assert.equal(r.status, 403, 'Khoa không được báo sự cố cho thiết bị khoa khác');

    r = await req('/api/repairs', { method:'POST', headers:{'Content-Type':'application/json','Cookie':deptCookie}, body:'{}' });
    assert.equal(r.status, 403, 'Tài khoản khoa không được tạo phiếu sửa chữa');

    r = await req('/uploads/documents/doc-a10.txt', { headers:{'Cookie':deptCookie} });
    assert.equal(r.status, 200, 'Khoa được mở tài liệu của thiết bị khoa mình');
    assert.equal(await r.text(), 'SECRET-A10');

    r = await req('/uploads/documents/doc-a10.txt');
    assert.equal(r.status, 401, 'Tài liệu không được public khi chưa đăng nhập');

    r = await req('/index.html', { headers:{'Cookie':adminCookie} });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes('/p2-auth-client.js'), 'Trang nội bộ phải được chèn lớp client xác thực');

    const verify = new Database(dbPath);
    const auditCount = verify.prepare('SELECT COUNT(*) c FROM security_audit_logs').get().c;
    verify.close();
    assert.ok(auditCount >= 5, 'Phải có audit log cho các thao tác xác thực/thay đổi dữ liệu');

    console.log('[P2 TEST] PASS - login, password, role scope, audit và protected uploads hoạt động.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(err => { console.error(err); process.exit(1); });

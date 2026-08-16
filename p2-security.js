const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadDotEnv(baseDir) {
  const envPath = path.join(baseDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach(line => {
    const s = String(line || "").trim();
    if (!s || s.startsWith("#")) return;
    const idx = s.indexOf("=");
    if (idx <= 0) return;
    const key = s.slice(0, idx).trim();
    let value = s.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

function attach({ app, express, Database, dbPath, publicDir, uploadsDir, qrUploadsDir }) {
  const baseDir = path.dirname(dbPath);
  loadDotEnv(path.dirname(baseDir));
  let authDb = null;
  let initialized = false;
  const failedLogins = new Map();
  const publicQrPosts = new Map();
  const SESSION_COOKIE = "qy4_session";
  const SESSION_HOURS = Math.max(1, Math.min(24, Number(process.env.AUTH_SESSION_HOURS || 8)));

  function db() {
    if (!authDb) {
      authDb = new Database(dbPath);
      try { authDb.pragma("journal_mode = WAL"); } catch {}
      try { authDb.pragma("busy_timeout = 5000"); } catch {}
    }
    return authDb;
  }

  function nowSql() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function futureSql(hours) {
    const d = new Date(Date.now() + hours * 3600000);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function ensureSchema() {
    const conn = db();
    conn.exec(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT
      );
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_time TEXT NOT NULL,
        user_id INTEGER,
        username TEXT,
        full_name TEXT,
        role TEXT,
        method TEXT,
        path TEXT,
        status_code INTEGER,
        ip TEXT,
        detail TEXT
      );
    `);
    const exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!exists) return false;
    const cols = conn.prepare("PRAGMA table_info(users)").all().map(x => x.name);
    const add = (name, def) => { if (!cols.includes(name)) { try { conn.prepare(`ALTER TABLE users ADD COLUMN ${name} ${def}`).run(); } catch {} } };
    add("password_salt", "TEXT");
    add("password_hash", "TEXT");
    add("must_change_password", "INTEGER DEFAULT 1");
    add("last_login_at", "TEXT");
    return true;
  }

  function hashPassword(password, salt) {
    return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
  }

  function setPassword(userId, password, mustChange = 1) {
    if (String(password || "").length < 10) throw new Error("Mật khẩu phải có ít nhất 10 ký tự.");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    db().prepare("UPDATE users SET password_salt=?, password_hash=?, must_change_password=? WHERE id=?")
      .run(salt, hash, mustChange ? 1 : 0, Number(userId));
  }

  function verifyPassword(user, password) {
    if (!user || !user.password_salt || !user.password_hash) return false;
    const actual = Buffer.from(hashPassword(password, user.password_salt), "hex");
    const expected = Buffer.from(String(user.password_hash), "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  function bootstrapAdmin() {
    if (!ensureSchema()) return;
    const conn = db();
    const admin = conn.prepare(`
      SELECT * FROM users
      WHERE status='Hoạt động' AND (role LIKE '%Quản trị%' OR username='admin')
      ORDER BY CASE WHEN username='admin' THEN 0 ELSE 1 END, id
      LIMIT 1
    `).get();
    if (!admin || admin.password_hash) return;
    let password = String(process.env.ADMIN_INITIAL_PASSWORD || "").trim();
    let generated = false;
    if (password.length < 10) {
      password = `QY4!${crypto.randomBytes(9).toString("base64url")}`;
      generated = true;
    }
    setPassword(admin.id, password, 1);
    console.log("============================================================");
    console.log(`[P2 AUTH] Đã khởi tạo tài khoản quản trị: ${admin.username}`);
    if (generated) console.log(`[P2 AUTH] MẬT KHẨU TẠM THỜI: ${password}`);
    else console.log("[P2 AUTH] Đã dùng ADMIN_INITIAL_PASSWORD từ môi trường/.env.");
    console.log("[P2 AUTH] Bắt buộc đổi mật khẩu sau lần đăng nhập đầu tiên.");
    console.log("============================================================");
  }

  function initialize() {
    ensureSchema();
    bootstrapAdmin();
    try { db().prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(nowSql()); } catch {}
    initialized = true;
  }

  function parseCookies(req) {
    const out = {};
    String(req.headers.cookie || "").split(";").forEach(part => {
      const idx = part.indexOf("=");
      if (idx < 0) return;
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    });
    return out;
  }

  function tokenHash(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
  }

  function getUser(req) {
    if (!initialized) initialize();
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const row = db().prepare(`
      SELECT u.id,u.full_name,u.username,u.role,u.department_code,u.status,u.must_change_password,
             s.expires_at
      FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>? AND u.status='Hoạt động'
    `).get(tokenHash(token), nowSql());
    return row || null;
  }

  function setSessionCookie(req, res, token) {
    const secure = req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
    const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_HOURS * 3600}`];
    if (secure) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function clearSessionCookie(req, res) {
    const secure = req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
    const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
    if (secure) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function createSession(req, res, userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    db().prepare("INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?)")
      .run(tokenHash(token), Number(userId), nowSql(), futureSql(SESSION_HOURS), req.ip || "", String(req.headers["user-agent"] || "").slice(0, 500));
    setSessionCookie(req, res, token);
  }

  function audit(user, req, statusCode, detail = "") {
    try {
      db().prepare(`INSERT INTO security_audit_logs
        (action_time,user_id,username,full_name,role,method,path,status_code,ip,detail)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(nowSql(), user?.id || null, user?.username || "", user?.full_name || "", user?.role || "",
          req.method || "", req.originalUrl || req.path || "", Number(statusCode || 0), req.ip || "", String(detail || "").slice(0, 2000));
    } catch {}
  }

  function isAdmin(user) { return /quản trị/i.test(String(user?.role || "")); }
  function isTech(user) { return isAdmin(user) || /kỹ|ky|trang bị|ttbyt/i.test(String(user?.role || "")); }
  function isDeptUser(user) { return !isTech(user); }

  function sameOriginAllowed(req) {
    if (["GET","HEAD","OPTIONS"].includes(req.method)) return true;
    const origin = String(req.headers.origin || "").trim();
    if (!origin) return true;
    const allowed = new Set(String(process.env.AUTH_ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean));
    const own = `${req.protocol}://${req.get("host")}`;
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    if (forwardedProto && forwardedHost) allowed.add(`${forwardedProto}://${forwardedHost}`);
    allowed.add(own);
    return allowed.has(origin);
  }

  function loginKey(req, username) { return `${req.ip || "ip"}:${String(username || "").toLowerCase()}`; }
  function loginBlocked(req, username) {
    const key = loginKey(req, username);
    const row = failedLogins.get(key);
    if (!row) return false;
    if (row.blockedUntil && row.blockedUntil > Date.now()) return true;
    if (row.blockedUntil && row.blockedUntil <= Date.now()) failedLogins.delete(key);
    return false;
  }
  function failLogin(req, username) {
    const key = loginKey(req, username);
    const row = failedLogins.get(key) || { count: 0, firstAt: Date.now(), blockedUntil: 0 };
    if (Date.now() - row.firstAt > 15 * 60000) { row.count = 0; row.firstAt = Date.now(); }
    row.count += 1;
    if (row.count >= 5) row.blockedUntil = Date.now() + 15 * 60000;
    failedLogins.set(key, row);
  }

  app.post("/api/auth/login", (req, res) => {
    initialize();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) return res.status(400).json({ error: "Vui lòng nhập tài khoản và mật khẩu." });
    if (loginBlocked(req, username)) return res.status(429).json({ error: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." });
    const user = db().prepare("SELECT * FROM users WHERE username=? LIMIT 1").get(username);
    if (!user || user.status !== "Hoạt động" || !verifyPassword(user, password)) {
      failLogin(req, username);
      audit(user || { username }, req, 401, "Đăng nhập thất bại");
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
    }
    failedLogins.delete(loginKey(req, username));
    createSession(req, res, user.id);
    db().prepare("UPDATE users SET last_login_at=? WHERE id=?").run(nowSql(), user.id);
    const safeUser = { id:user.id, full_name:user.full_name, username:user.username, role:user.role, department_code:user.department_code, must_change_password:Number(user.must_change_password || 0) };
    audit(safeUser, req, 200, "Đăng nhập thành công");
    res.json({ ok:true, user:safeUser });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Chưa đăng nhập." });
    res.json({ user });
  });

  app.post("/api/auth/logout", (req, res) => {
    const user = getUser(req);
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) { try { db().prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(tokenHash(token)); } catch {} }
    clearSessionCookie(req, res);
    audit(user, req, 200, "Đăng xuất");
    res.json({ ok:true });
  });

  app.post("/api/auth/change-password", (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Chưa đăng nhập." });
    const currentPassword = String(req.body?.current_password || "");
    const newPassword = String(req.body?.new_password || "");
    const full = db().prepare("SELECT * FROM users WHERE id=?").get(user.id);
    if (!verifyPassword(full, currentPassword)) return res.status(400).json({ error: "Mật khẩu hiện tại không đúng." });
    if (newPassword.length < 10) return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 10 ký tự." });
    if (currentPassword === newPassword) return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    setPassword(user.id, newPassword, 0);
    db().prepare("DELETE FROM auth_sessions WHERE user_id=?").run(user.id);
    createSession(req, res, user.id);
    audit(user, req, 200, "Đổi mật khẩu");
    res.json({ ok:true });
  });

  app.post("/api/auth/users/:id/reset-password", (req, res) => {
    const actor = getUser(req);
    if (!actor) return res.status(401).json({ error: "Chưa đăng nhập." });
    if (!isAdmin(actor)) return res.status(403).json({ error: "Chỉ Quản trị viên được cấp lại mật khẩu." });
    const target = db().prepare("SELECT id,username,full_name FROM users WHERE id=?").get(Number(req.params.id));
    if (!target) return res.status(404).json({ error: "Không tìm thấy người dùng." });
    let password = String(req.body?.password || "").trim();
    let generated = false;
    if (!password) { password = `QY4!${crypto.randomBytes(9).toString("base64url")}`; generated = true; }
    if (password.length < 10) return res.status(400).json({ error: "Mật khẩu tạm thời phải có ít nhất 10 ký tự." });
    setPassword(target.id, password, 1);
    db().prepare("DELETE FROM auth_sessions WHERE user_id=?").run(target.id);
    audit(actor, req, 200, `Cấp lại mật khẩu cho ${target.username}`);
    res.json({ ok:true, username:target.username, temporary_password: generated ? password : null, must_change_password:true });
  });

  app.get("/api/auth/audit", (req, res) => {
    const actor = getUser(req);
    if (!actor) return res.status(401).json({ error: "Chưa đăng nhập." });
    if (!isAdmin(actor) && !isTech(actor)) return res.status(403).json({ error: "Không có quyền xem nhật ký bảo mật." });
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const rows = db().prepare("SELECT * FROM security_audit_logs ORDER BY id DESC LIMIT ?").all(limit);
    res.json(rows);
  });

  function publicApi(pathname) {
    return pathname === "/qr/png" || pathname.startsWith("/qr/device/") || pathname.startsWith("/qr/device-code/") || pathname === "/qr/checks" || pathname.startsWith("/public/") || pathname === "/system/public-qr-check" || pathname === "/system/qr-origins";
  }

  function qrPostRateAllowed(req) {
    if (req.method !== "POST" || req.path !== "/qr/checks") return true;
    const key = req.ip || "unknown";
    const now = Date.now();
    const row = publicQrPosts.get(key) || { count:0, start:now };
    if (now - row.start > 3600000) { row.count = 0; row.start = now; }
    row.count += 1;
    publicQrPosts.set(key, row);
    return row.count <= 30;
  }

  function deviceBelongsToUser(user, deviceId) {
    if (!isDeptUser(user)) return true;
    const row = db().prepare("SELECT department_code FROM devices WHERE id=?").get(Number(deviceId));
    return Boolean(row && row.department_code === user.department_code);
  }

  function deptReadAllowed(pathname) {
    return pathname === "/meta" || pathname === "/departments" || pathname === "/devices" || /^\/devices\/\d+$/.test(pathname) || pathname === "/incidents" || /^\/incidents\/\d+$/.test(pathname);
  }

  app.use("/api", (req, res, next) => {
    if (publicApi(req.path)) {
      if (!qrPostRateAllowed(req)) return res.status(429).json({ error: "Quá nhiều lượt gửi kiểm tra QR từ thiết bị này. Vui lòng thử lại sau." });
      return next();
    }
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập." });
    req.qy4User = user;
    if (Number(user.must_change_password || 0) && !req.path.startsWith("/auth/")) return res.status(428).json({ error: "Bạn phải đổi mật khẩu trước khi sử dụng phần mềm." });
    if (!sameOriginAllowed(req)) return res.status(403).json({ error: "Yêu cầu bị từ chối do nguồn truy cập không hợp lệ." });

    if (!isAdmin(user) && req.path.startsWith("/users")) return res.status(403).json({ error: "Chỉ Quản trị viên được quản lý tài khoản." });
    if (!isAdmin(user) && !isTech(user) && !deptReadAllowed(req.path) && req.method === "GET") return res.status(403).json({ error: "Tài khoản khoa chỉ được xem thiết bị và sự cố thuộc phạm vi được cấp." });
    if (isDeptUser(user) && !["GET","HEAD","OPTIONS"].includes(req.method)) {
      const isIncidentCreate = req.method === "POST" && req.path === "/incidents";
      const isIncidentUpdate = req.method === "PUT" && /^\/incidents\/\d+$/.test(req.path);
      if (!isIncidentCreate && !isIncidentUpdate) return res.status(403).json({ error: "Tài khoản khoa chỉ được báo/cập nhật sự cố của khoa mình." });
      const deviceId = Number(req.body?.device_id || 0);
      if (!deviceBelongsToUser(user, deviceId)) return res.status(403).json({ error: "Thiết bị không thuộc khoa được cấp cho tài khoản này." });
      if (isIncidentUpdate) {
        const old = db().prepare("SELECT device_id FROM incidents WHERE id=?").get(Number(req.path.split("/").pop()));
        if (!old || !deviceBelongsToUser(user, old.device_id)) return res.status(403).json({ error: "Sự cố không thuộc khoa được cấp." });
      }
    }

    if (!isAdmin(user) && !["GET","HEAD","OPTIONS"].includes(req.method)) {
      if (req.path.startsWith("/departments") || req.path.startsWith("/device-groups") || req.path === "/reset-seed") return res.status(403).json({ error: "Chỉ Quản trị viên được thay đổi cấu hình hệ thống." });
    }

    if (isAdmin(user) && req.method === "DELETE" && /^\/users\/\d+$/.test(req.path)) {
      const targetId = Number(req.path.split("/").pop());
      if (targetId === Number(user.id)) return res.status(400).json({ error: "Không thể tự xóa tài khoản đang đăng nhập." });
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      let data = payload;
      if (req.method === "GET" && req.path === "/users" && Array.isArray(data)) {
        data = data.map(({ password_salt, password_hash, ...safe }) => safe);
      }
      if (isDeptUser(user) && req.method === "GET") {
        if (req.path === "/devices" && Array.isArray(data)) data = data.filter(x => x.department_code === user.department_code);
        if (req.path === "/incidents" && Array.isArray(data)) data = data.filter(x => (x.department_code || x.department_snapshot) === user.department_code || (x.department_snapshot || "").startsWith(`${user.department_code} `) || (x.department_snapshot || "").startsWith(`${user.department_code} -`));
      }
      return originalJson(data);
    };

    const mutating = !["GET","HEAD","OPTIONS"].includes(req.method);
    if (mutating) {
      res.on("finish", () => {
        audit(user, req, res.statusCode, `role=${user.role}; department=${user.department_code || ""}`);
        if (res.statusCode < 400 && req.path.startsWith("/users/")) {
          const targetId = Number(req.path.split("/")[2] || 0);
          if (targetId && (req.method === "DELETE" || (req.method === "PUT" && req.body?.status && req.body.status !== "Hoạt động"))) {
            try { db().prepare("DELETE FROM auth_sessions WHERE user_id=?").run(targetId); } catch {}
          }
        }
      });
    }
    next();
  });

  function authorizeStoredFile(req, res, next, kind) {
    const user = getUser(req);
    if (!user) return res.status(401).send("Chưa đăng nhập.");
    if (!isDeptUser(user)) return next();
    const name = path.basename(req.path || "");
    let row = null;
    if (kind === "documents") {
      row = db().prepare(`SELECT dv.department_code FROM documents d JOIN devices dv ON dv.id=d.device_id WHERE d.stored_name=? OR d.file_path LIKE ? LIMIT 1`).get(name, `%/${name}`);
      if (!row) row = db().prepare(`SELECT dv.department_code FROM maintenances m JOIN devices dv ON dv.id=m.device_id WHERE m.stored_name=? OR m.file_path LIKE ? LIMIT 1`).get(name, `%/${name}`);
    } else {
      row = db().prepare(`SELECT dv.department_code FROM incident_files f JOIN devices dv ON dv.id=f.device_id WHERE f.stored_name=? OR f.file_path LIKE ? LIMIT 1`).get(name, `%/${name}`);
    }
    if (!row || row.department_code !== user.department_code) return res.status(403).send("Không có quyền xem tệp này.");
    next();
  }

  app.use("/uploads/documents", (req,res,next) => authorizeStoredFile(req,res,next,"documents"), express.static(uploadsDir, { index:false, fallthrough:false }));
  app.use("/uploads/qr", (req,res,next) => authorizeStoredFile(req,res,next,"qr"), express.static(qrUploadsDir, { index:false, fallthrough:false }));

  const adminPages = new Set(["/users.html","/settings.html","/settings-code.html","/settings-reminders.html","/settings-reports.html","/departments.html","/groups.html","/categories.html"]);
  const deptPages = new Set(["/index.html","/device-detail.html","/tickets.html","/dashboard.html"]);
  const publicPages = new Set(["/login.html","/change-password.html","/qr-check.html"]);

  app.use((req, res, next) => {
    if (!["GET","HEAD"].includes(req.method)) return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path.startsWith("/vendor/")) return next();
    const isHtml = req.path === "/" || req.path.endsWith(".html");
    if (!isHtml) return next();
    if (publicPages.has(req.path)) return next();
    const user = getUser(req);
    if (!user) return res.redirect(302, `/login.html?next=${encodeURIComponent(req.originalUrl || "/index.html")}`);
    if (Number(user.must_change_password || 0)) return res.redirect(302, "/change-password.html");
    const normalized = req.path === "/" ? "/index.html" : req.path;
    if (adminPages.has(normalized) && !isAdmin(user)) return res.redirect(302, isDeptUser(user) ? "/tickets.html" : "/index.html");
    if (isDeptUser(user) && !deptPages.has(normalized)) return res.redirect(302, "/tickets.html");
    const filePath = path.join(publicDir, normalized.replace(/^\//, ""));
    if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) return next();
    let html = fs.readFileSync(filePath, "utf8");
    const tag = '<script src="/p2-auth-client.js"></script>';
    html = html.includes("</body>") ? html.replace("</body>", `${tag}\n</body>`) : html + tag;
    res.type("html").setHeader("Cache-Control", "no-store");
    return res.send(html);
  });

  return { initialize, getUser, isAdmin, isTech };
}

module.exports = { attach };

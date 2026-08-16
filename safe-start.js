const fs = require("fs");
const path = require("path");
const Module = require("module");

const serverPath = path.join(__dirname, "server.js");
const p1ClientPath = path.join(__dirname, "public", "p1-incident-repair.js");
const checkOnly = process.argv.includes("--check");
const demoMode = process.argv.includes("--demo") || String(process.env.DEMO_MODE || "").toLowerCase() === "true";
if (demoMode) process.env.DEMO_MODE = "true";

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[SAFETY] Không tìm thấy điểm vá: ${label}. Dừng khởi động để tránh chạy không an toàn.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`[SAFETY] Điểm vá xuất hiện nhiều hơn 1 lần: ${label}. Dừng khởi động để tránh vá sai.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function hardenServerSource(input) {
  let source = String(input || "");

  // ===== P0: AN TOÀN DỮ LIỆU =====
  source = replaceOnce(
    source,
    "P0 auto demo refresh",
    "\nrefreshDemoTodayData();\n",
    "\nif (process.env.DEMO_MODE === \"true\") refreshDemoTodayData();\n"
  );

  source = replaceOnce(
    source,
    "P0 reset-seed guard",
    'app.post("/api/reset-seed", (req, res) => {',
    'app.post("/api/reset-seed", (req, res) => {\n  if (process.env.DEMO_MODE !== "true") return res.status(404).json({ error: "Chức năng reset dữ liệu đã bị vô hiệu trên bản production." });'
  );

  source = replaceOnce(
    source,
    "P0 serial migration",
    '    if (!r.insurance_code && r.serial) {\n      db.prepare("UPDATE devices SET insurance_code=? WHERE id=?").run(r.serial, r.id);\n      db.prepare("UPDATE devices SET serial=\'\' WHERE id=?").run(r.id);\n    }',
    '    // P0 safety: KHÔNG tự chuyển Serial hãng sang mã HIS/BHXH và KHÔNG xóa Serial.\n    // Hai trường được giữ độc lập; dữ liệu cũ chỉ được hiệu chỉnh sau khi đối chiếu có căn cứ.'
  );

  source = replaceOnce(
    source,
    "P0 device hard-delete guard",
    'app.delete("/api/devices/:id", (req, res) => {\n  const id = Number(req.params.id);',
    'app.delete("/api/devices/:id", (req, res) => {\n  const id = Number(req.params.id);\n  const relatedTables = [\n    "incidents", "incident_files", "repairs", "maintenances", "inspections",\n    "operation_logs", "documents", "daily_checks", "quality_ratings", "usage_reports",\n    "transfers", "liquidations"\n  ];\n  const related = [];\n  for (const table of relatedTables) {\n    try {\n      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE device_id=?`).get(id);\n      const count = Number(row?.c || 0);\n      if (count > 0) related.push(`${table}: ${count}`);\n    } catch (e) {}\n  }\n  if (related.length) {\n    return res.status(409).json({\n      error: "Không thể xóa thiết bị đã phát sinh lịch sử. Hãy chuyển tình trạng thiết bị sang Ngừng hoạt động/Chờ thanh lý/Đã thanh lý để bảo toàn lý lịch.",\n      related\n    });\n  }'
  );

  // ===== P1: TOÀN VẸN SỰ CỐ -> SỬA CHỮA =====

  // Nạp lớp sửa frontend sau api.js mà không phải sửa hàng loạt HTML.
  source = replaceOnce(
    source,
    "P1 client fixes bundle",
    'app.use(express.static(path.join(__dirname, "public")));',
    'app.get("/api.js", (_req, res) => {\n  const base = fs.readFileSync(path.join(__dirname, "public", "api.js"), "utf8");\n  const p1 = fs.readFileSync(path.join(__dirname, "public", "p1-incident-repair.js"), "utf8");\n  res.type("application/javascript").send(base + "\\n\\n" + p1);\n});\napp.use(express.static(path.join(__dirname, "public")));'
  );

  // Phiếu sửa chữa đã tạo phải giữ nguyên thiết bị; không cho đổi device_id khi cập nhật.
  source = replaceOnce(
    source,
    "P1 lock repair device",
    '    const old = db.prepare("SELECT * FROM repairs WHERE id=?").get(req.params.id) || {};',
    '    const old = db.prepare("SELECT * FROM repairs WHERE id=?").get(req.params.id) || {};\n    if (!old.id) return res.status(404).json({ error: "Không tìm thấy phiếu sửa chữa." });\n    if (Number(p.device_id) !== Number(old.device_id)) {\n      return res.status(409).json({ error: "Không được đổi thiết bị của phiếu sửa chữa đã tạo. Hãy hủy phiếu nhập nhầm và tạo phiếu mới để bảo toàn lịch sử." });\n    }'
  );

  // Sự cố đã liên kết phiếu sửa chữa không được chuyển sang thiết bị khác.
  source = replaceOnce(
    source,
    "P1 lock linked incident device",
    '    const old = db.prepare("SELECT * FROM incidents WHERE id=?").get(req.params.id);\n    if (!old) return res.status(404).json({ error: "Không tìm thấy sự cố." });',
    '    const old = db.prepare("SELECT * FROM incidents WHERE id=?").get(req.params.id);\n    if (!old) return res.status(404).json({ error: "Không tìm thấy sự cố." });\n    const linkedRepairForIncident = db.prepare("SELECT id FROM repairs WHERE incident_id=? ORDER BY id DESC LIMIT 1").get(old.id);\n    if (linkedRepairForIncident && Number(p.device_id) !== Number(old.device_id)) {\n      return res.status(409).json({ error: "Sự cố đã liên kết phiếu sửa chữa nên không được đổi thiết bị." });\n    }'
  );

  // Khi hủy phiếu từ sự cố: mở lại sự cố nếu không còn phiếu liên kết hoạt động và giữ thiết bị ở trạng thái chờ xử lý.
  source = replaceOnce(
    source,
    "P1 cancel repair synchronization",
    '    writeAudit("repair", "cancel", `Hủy phiếu sửa chữa #${req.params.id}: ${reason}`);\n    res.json({ ok: true });',
    '    writeAudit("repair", "cancel", `Hủy phiếu sửa chữa #${req.params.id}: ${reason}`);\n\n    if (old.incident_id) {\n      const otherRepair = db.prepare(`\n        SELECT COUNT(*) AS c FROM repairs\n        WHERE incident_id=? AND id<>?\n          AND COALESCE(processing_status,\'\') NOT IN (\'Đã hủy\',\'Hủy\',\'Huỷ\',\'Đã huỷ\')\n      `).get(old.incident_id, Number(req.params.id));\n      if (Number(otherRepair?.c || 0) === 0) {\n        db.prepare("UPDATE incidents SET status=\'Mới ghi nhận\', updated_at=?, updated_by=? WHERE id=?")\n          .run(nowSql(), "Hệ thống", old.incident_id);\n        db.prepare("UPDATE devices SET status=\'Chờ sửa chữa\' WHERE id=?").run(old.device_id);\n        writeAudit("incident", "reopen_after_repair_cancel", `Mở lại sự cố #${old.incident_id} do hủy phiếu sửa chữa #${req.params.id}`);\n      }\n    }\n\n    const remainingOpenRepairs = db.prepare(`\n      SELECT COUNT(*) AS c FROM repairs\n      WHERE device_id=? AND id<>?\n        AND COALESCE(processing_status,\'\') NOT IN (\'Đã hủy\',\'Hủy\',\'Huỷ\',\'Đã huỷ\',\'Đã hoàn thành\',\'Hoàn thành\',\'Không sửa được\',\'Không thể sửa\')\n    `).get(old.device_id, Number(req.params.id));\n    if (Number(remainingOpenRepairs?.c || 0) > 0) {\n      db.prepare("UPDATE devices SET status=\'Chờ sửa chữa\' WHERE id=?").run(old.device_id);\n    }\n\n    res.json({ ok: true });'
  );

  return source;
}

const original = fs.readFileSync(serverPath, "utf8");
const hardened = hardenServerSource(original);

if (checkOnly) {
  if (!fs.existsSync(p1ClientPath)) throw new Error("[SAFETY] Thiếu public/p1-incident-repair.js");
  new Function(hardened);
  new Function(fs.readFileSync(p1ClientPath, "utf8"));
  console.log("[SAFETY] OK - P0 + P1 đã khớp với server.js và hợp lệ cú pháp.");
  console.log("[SAFETY] P1: 3 trạng thái sự cố, khóa liên kết thiết bị, đồng bộ khi hủy phiếu và loại luồng localStorage cũ.");
  console.log(`[SAFETY] DEMO_MODE=${demoMode ? "true" : "false"}`);
  process.exit(0);
}

console.log(`[SAFETY] Khởi động QY4-TTBYT ở chế độ ${demoMode ? "DEMO" : "PRODUCTION"}.`);
if (!demoMode) console.log("[SAFETY] Đã áp dụng bảo vệ P0 + toàn vẹn luồng Sự cố -> Sửa chữa P1.");

const compiled = new Module(serverPath, module.parent);
compiled.filename = serverPath;
compiled.paths = Module._nodeModulePaths(__dirname);
compiled._compile(hardened, serverPath);

const fs = require("fs");
const path = require("path");
const Module = require("module");

const serverPath = path.join(__dirname, "server.js");
const checkOnly = process.argv.includes("--check");
const demoMode = process.argv.includes("--demo") || String(process.env.DEMO_MODE || "").toLowerCase() === "true";
if (demoMode) process.env.DEMO_MODE = "true";

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[P0 SAFETY] Không tìm thấy điểm vá: ${label}. Dừng khởi động để tránh chạy không an toàn.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`[P0 SAFETY] Điểm vá xuất hiện nhiều hơn 1 lần: ${label}. Dừng khởi động để tránh vá sai.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function hardenServerSource(input) {
  let source = String(input || "");

  // P0-1: Không tự sinh/đổi dữ liệu demo khi chạy production.
  source = replaceOnce(
    source,
    "auto demo refresh",
    "\nrefreshDemoTodayData();\n",
    "\nif (process.env.DEMO_MODE === \"true\") refreshDemoTodayData();\n"
  );

  // P0-2: Endpoint xóa và nạp lại toàn bộ dữ liệu chỉ được phép trong DEMO_MODE.
  source = replaceOnce(
    source,
    "reset-seed guard",
    'app.post("/api/reset-seed", (req, res) => {',
    'app.post("/api/reset-seed", (req, res) => {\n  if (process.env.DEMO_MODE !== "true") return res.status(404).json({ error: "Chức năng reset dữ liệu đã bị vô hiệu trên bản production." });'
  );

  // P0-3: Serial hãng và mã HIS/BHXH là các trường độc lập. Không tự chuyển Serial sang insurance_code và không xóa Serial.
  source = replaceOnce(
    source,
    "serial migration",
    '    if (!r.insurance_code && r.serial) {\n      db.prepare("UPDATE devices SET insurance_code=? WHERE id=?").run(r.serial, r.id);\n      db.prepare("UPDATE devices SET serial=\'\' WHERE id=?").run(r.id);\n    }',
    '    // P0 safety: KHÔNG tự chuyển Serial hãng sang mã HIS/BHXH và KHÔNG xóa Serial.\n    // Hai trường được giữ độc lập; dữ liệu cũ chỉ được hiệu chỉnh sau khi đối chiếu có căn cứ.'
  );

  // P0-4: Chỉ cho xóa cứng thiết bị nhập nhầm và chưa phát sinh lịch sử nghiệp vụ.
  source = replaceOnce(
    source,
    "device hard-delete guard",
    'app.delete("/api/devices/:id", (req, res) => {\n  const id = Number(req.params.id);',
    'app.delete("/api/devices/:id", (req, res) => {\n  const id = Number(req.params.id);\n  const relatedTables = [\n    "incidents", "incident_files", "repairs", "maintenances", "inspections",\n    "operation_logs", "documents", "daily_checks", "quality_ratings", "usage_reports",\n    "transfers", "liquidations"\n  ];\n  const related = [];\n  for (const table of relatedTables) {\n    try {\n      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE device_id=?`).get(id);\n      const count = Number(row?.c || 0);\n      if (count > 0) related.push(`${table}: ${count}`);\n    } catch (e) {}\n  }\n  if (related.length) {\n    return res.status(409).json({\n      error: "Không thể xóa thiết bị đã phát sinh lịch sử. Hãy chuyển tình trạng thiết bị sang Ngừng hoạt động/Chờ thanh lý/Đã thanh lý để bảo toàn lý lịch.",\n      related\n    });\n  }'
  );

  return source;
}

const original = fs.readFileSync(serverPath, "utf8");
const hardened = hardenServerSource(original);

if (checkOnly) {
  console.log("[P0 SAFETY] OK - 4 lớp bảo vệ production đã khớp với server.js hiện tại.");
  console.log(`[P0 SAFETY] DEMO_MODE=${demoMode ? "true" : "false"}`);
  process.exit(0);
}

console.log(`[P0 SAFETY] Khởi động QY4-TTBYT ở chế độ ${demoMode ? "DEMO" : "PRODUCTION"}.`);
if (!demoMode) console.log("[P0 SAFETY] Đã khóa tự sinh dữ liệu demo, reset-seed, migration Serial nguy hiểm và xóa cứng thiết bị có lịch sử.");

const compiled = new Module(serverPath, module.parent);
compiled.filename = serverPath;
compiled.paths = Module._nodeModulePaths(__dirname);
compiled._compile(hardened, serverPath);

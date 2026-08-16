let REPAIR_ROWS = [];
let FILTERED_REPAIRS = [];
let DEVICES = [];
let META = { departments: [], groups: [] };
let SOURCE_INCIDENT = null;

function norm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s]));
}
function normalizeRepairStatus(status) {
  const raw = String(status || "").trim();
  if (["Đang xử lý", "Đang kiểm tra", "Đang sửa chữa", "Mới tiếp nhận"].includes(raw)) return "Đang xử lý";
  if (raw === "Chờ linh kiện") return "Chờ linh kiện";
  if (["Chuyển hãng/Bảo hành", "Chuyển hãng", "Bảo hành", "Gửi hãng"].includes(raw)) return "Chuyển hãng/Bảo hành";
  if (["Đã sửa xong", "Bàn giao sử dụng", "Đã hoàn thành", "Hoàn thành"].includes(raw)) return "Đã hoàn thành";
  if (["Không sửa được"].includes(raw)) return "Không sửa được";
  if (["Đã hủy", "Hủy", "Huỷ", "Đã huỷ"].includes(raw)) return "Đã hủy";
  return "Đang xử lý";
}
function getDevice(id) {
  return DEVICES.find(d => Number(d.id) === Number(id)) || null;
}
function deviceLabel(d) {
  if (!d) return "";
  return `${d.device_code || "TB-" + d.id} - ${d.name || ""}${d.model ? " - " + d.model : ""}`;
}
function repairStatusClass(status) {
  const st = normalizeRepairStatus(status);
  if (st === "Đã hoàn thành") return "green";
  if (st === "Đang xử lý" || st === "Chờ linh kiện") return "orange";
  if (st === "Chuyển hãng/Bảo hành") return "blue";
  if (st === "Không sửa được") return "red";
  if (st === "Đã hủy") return "gray";
  return "gray";
}
function renderDeviceOptions() {
  const list = DEVICES.map(d => `<option value="${esc(deviceLabel(d))}" data-id="${d.id}"></option>`).join("");
  q("deviceOptions").innerHTML = list;
}
function resolveDeviceFromSearch() {
  const raw = q("repairDeviceSearch").value.trim();
  if (!raw) return null;
  const rawNorm = norm(raw);
  return DEVICES.find(d => norm(deviceLabel(d)) === rawNorm)
      || DEVICES.find(d => norm([d.device_code, d.serial, d.name, d.model].join(" ")).includes(rawNorm));
}
function setSelectedDevice(device) {
  q("selectedDeviceId").value = device ? device.id : "";
  q("repairDeviceName").value = device ? (device.name || "") : "";
  q("repairDeviceCode").value = device ? (device.device_code || "") : "";
  q("repairDept").value = device ? (device.department_name || device.department_code || "") : "";
  q("repairLocation").value = device ? (device.location || "") : "";
  q("repairModel").value = device ? (device.model || "") : "";
  q("repairSerial").value = device ? (device.serial || "") : "";
}
function clearSelectedDevice() {
  q("repairDeviceSearch").value = "";
  setSelectedDevice(null);
}
function resetRepairForm() {
  q("repairForm").reset();
  q("repairId").value = "";
  q("sourceIncidentId").value = "";
  SOURCE_INCIDENT = null;
  clearSelectedDevice();
  q("repairDialogTitle").textContent = "Tạo phiếu sửa chữa";
  q("repairDialogSubtitle").textContent = "Quy trình rút gọn: tiếp nhận sự cố → xử lý sửa chữa → nghiệm thu/đóng phiếu";
  q("sourceBadge").style.display = "none";
  q("prefillNotice").style.display = "none";
  q("saveRepairBtn").textContent = "Lưu phiếu";
  q("cost").value = 0;
  if (q("actionTime")) q("actionTime").value = toDateTimeLocalValue(new Date().toISOString().slice(0,16));
  if (q("saveHistory")) q("saveHistory").checked = true;
}
function openRepairDialog(mode = "create") {
  if (mode === "create") resetRepairForm();
  q("repairDialog").showModal();
}
function closeRepairDialog() {
  q("repairDialog").close();
}
function renderStats(rows) {
  const count = rows.length;
  const stat = (name) => rows.filter(r => normalizeRepairStatus(r.processing_status) === name).length;
  const cost = rows.reduce((s, r) => s + Number(r.cost || 0), 0);
  const cards = [
    ["Tổng phiếu", count],
    ["Đang xử lý", stat("Đang xử lý")],
    ["Chờ linh kiện", stat("Chờ linh kiện")],
    ["Chuyển hãng", stat("Chuyển hãng/Bảo hành")],
    ["Đã hoàn thành", stat("Đã hoàn thành")],
    ["Không sửa được", stat("Không sửa được")],
    ["Tổng chi phí", formatCurrency(cost)]
  ];
  q("repairStats").innerHTML = cards.map(([label, value]) => `<div class="stat-card repair-stat-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
}
function renderRows(rows) {
  q("countLabel").textContent = `${rows.length} bản ghi`;
  if (!rows.length) {
    q("rows").innerHTML = `<tr><td colspan="12" class="center-empty">Chưa có phiếu sửa chữa phù hợp.</td></tr>`;
    return;
  }
  q("rows").innerHTML = rows.map((r, i) => {
    const deptCode = r.department_code || r.department_name || "";
    const summary = (r.work || r.result || "").slice(0, 55);
    const noteIcon = r.note ? "📝" : "";
    const fileIcon = Number(r.file_count || 0) > 0 ? `📎${Number(r.file_count || 0)}` : "";
    const noteCell = (noteIcon || fileIcon) ? `<button class="btn btn-secondary" onclick="showRepairNote(${Number(r.id)})">${noteIcon}${fileIcon}</button>` : "—";
    return `
    <tr id="repair-row-${Number(r.id)}">
      <td>${i + 1}</td>
      <td class="time-cell">${formatDateTimeVN(r.received_at || r.repair_date)}</td>
      <td><b>${esc(r.device_name || "")}</b><div class="small device-code">${esc(r.device_code || "")}${r.serial ? " · SN: " + esc(r.serial) : ""}${r.model ? " · " + esc(r.model) : ""}</div></td>
      <td class="code-only">${esc(deptCode)}</td>
      <td class="wrap-text">${esc(r.issue || "")}</td>
      <td>${esc(r.method || "")}</td>
      <td>${esc(r.person || "")}</td>
      <td><span class="tag ${repairStatusClass(r.processing_status)}">${esc(normalizeRepairStatus(r.processing_status))}</span></td>
      <td><span class="tag ${r.status_after === "Đang hoạt động" ? "green" : "orange"}">${esc(r.status_after || "")}</span></td>
      <td class="wrap-text">${esc(summary)}${(r.work || r.result || "").length > 55 ? "..." : ""}</td>
      <td>${noteCell}</td>
      <td>
        <div class="table-actions compact-actions">
          <button class="btn btn-secondary" onclick="showRepairHistory(${Number(r.id)})">Xem</button>
          ${normalizeRepairStatus(r.processing_status) !== "Đã hủy" ? `<button class="btn" onclick="editRepair(${Number(r.id)})">Cập nhật</button><button class="btn btn-danger" onclick="deleteRepair(${Number(r.id)})">Hủy phiếu</button>` : ``}
        </div>
      </td>
    </tr>`;
  }).join("");
}
function openDeviceProfile(id) {
  if (id) window.location.href = `/device-detail.html?id=${id}&from=maintenance`;
}
function applyFilter() {
  const text = norm(q("searchInput").value);
  const from = q("fromDate").value;
  const to = q("toDate").value;
  const dep = q("departmentFilter").value;
  const group = q("groupFilter").value;
  const device = q("deviceFilter").value;
  const status = q("repairStatusFilter").value;
  const method = q("methodFilter").value;
  const rows = REPAIR_ROWS.filter(r =>
    inDateRange(r.received_at || r.repair_date, from, to) &&
    (dep === "ALL" || r.department_code === dep) &&
    (group === "ALL" || r.group_code === group) &&
    (device === "ALL" || String(r.device_id) === device) &&
    (status === "ALL" || normalizeRepairStatus(r.processing_status) === status) &&
    (method === "ALL" || (r.method || "") === method) &&
    (!text || norm([r.device_code, r.device_name, r.model, r.serial, r.issue, r.work, r.person, r.processing_status].join(" ")).includes(text))
  ).sort((a,b) => String(b.received_at || b.repair_date || "").localeCompare(String(a.received_at || a.repair_date || "")) || Number(b.id) - Number(a.id));
  FILTERED_REPAIRS = rows;
  renderStats(rows);
  renderRows(rows);
}
function clearFilters() {
  q("searchInput").value = "";
  q("departmentFilter").value = "ALL";
  q("groupFilter").value = "ALL";
  q("deviceFilter").value = "ALL";
  q("repairStatusFilter").value = "ALL";
  q("methodFilter").value = "ALL";
  setDefaultDateRange();
  applyFilter();
}
function editRepair(id) {
  const r = REPAIR_ROWS.find(x => Number(x.id) === Number(id));
  if (!r) return;
  resetRepairForm();
  q("repairDialogTitle").textContent = "Cập nhật phiếu sửa chữa";
  q("repairDialogSubtitle").textContent = "Chỉ cập nhật trạng thái, diễn biến xử lý, chi phí, kết quả, TTTB sau sửa, ghi chú và file";
  q("saveRepairBtn").textContent = "Cập nhật phiếu";
  q("repairId").value = r.id;
  q("sourceIncidentId").value = r.source_incident_id || r.incident_id || "";
  if (r.source_incident_id || r.incident_id) {
    q("sourceBadge").textContent = `Nguồn: Sự cố #${r.source_incident_id || r.incident_id}`;
    q("sourceBadge").style.display = "inline-flex";
  }
  const d = getDevice(r.device_id) || r;
  q("repairDeviceSearch").value = deviceLabel(d);
  setSelectedDevice(d);
  q("repairDate").value = toDateTimeLocalValue(r.received_at || r.repair_date || "");
  if (q("actionTime")) q("actionTime").value = toDateTimeLocalValue(new Date().toISOString().slice(0,16));
  if (q("saveHistory")) q("saveHistory").checked = true;
  q("issue").value = r.issue || "";
  q("work").value = r.work || "";
  q("person").value = r.person || "";
  q("method").value = r.method || "Nội bộ";
  q("cost").value = r.cost || 0;
  q("result").value = r.result || "";
  q("statusAfter").value = r.status_after || "Đang hoạt động";
  q("note").value = r.note || "";
  if (q("fileHint")) q("fileHint").textContent = r.file_names ? `Đã có: ${r.file_names}` : "Có thể đính kèm biên bản, báo giá, hóa đơn, ảnh trước/sau sửa.";
  q("repairStatus").value = normalizeRepairStatus(r.processing_status);
  openRepairDialog("edit");
}
async function deleteRepair(id) {
  const reason = prompt("Nhập lý do hủy phiếu sửa chữa:", "Nhập nhầm / không còn nhu cầu xử lý");
  if (reason === null) return;
  await api(`/api/repairs/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
  await loadData();
}
function showRepairNote(id) {
  const r = REPAIR_ROWS.find(x => Number(x.id) === Number(id));
  if (!r) return;
  alert(`GHI CHÚ\n${r.note || "Không có ghi chú"}\n\nFILE ĐÍNH KÈM\n${Number(r.file_count || 0) ? (r.file_names || `Có ${r.file_count} file`) : "Chưa có file"}`);
}
function repairHistoryTypeLabel(r) {
  const t = r.entry_type || r.action_type || "Cập nhật";
  if (t.includes("Tự động") || r.action_type === "Tạo từ sự cố") return "🤖 Tự động";
  if (t.includes("Hoàn thành") || r.action_type === "Hoàn thành") return "👤 Hoàn thành";
  return "👤 Cập nhật";
}
function repairTimelineDotClass(status) {
  const s = normalizeRepairStatus(status || "Đang xử lý");
  if (s === "Đã hoàn thành") return "done";
  if (s === "Chờ linh kiện" || s === "Chuyển hãng/Bảo hành") return "waiting";
  if (s === "Không sửa được" || s === "Đã hủy") return "failed";
  return "active";
}
function renderRepairTimeline(rows, repair = {}) {
  if (!rows.length) return `<div class="center-empty">Chưa có lịch sử xử lý.</div>`;
  return rows.map((r) => {
    const status = normalizeRepairStatus(r.new_status || r.old_status || repair.processing_status || "Đang xử lý");
    const cost = Number(r.cost ?? repair.cost ?? 0);
    return `
      <div class="timeline-item ${repairTimelineDotClass(status)}">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-head">
            <div>
              <div class="timeline-time">${formatDateTimeVN(r.action_time)}</div>
              <div class="timeline-actor">Đơn vị/người xử lý: ${esc(r.actor || "Hệ thống")}</div>
            </div>
            <span class="tag ${repairStatusClass(status)}">${esc(status)}</span>
          </div>
          <div class="timeline-content">${esc(r.note || r.action_type || "")}</div>
          <div class="timeline-meta">
            <span>Chi phí: <b>${formatCurrency(cost)}</b></span>
            <span>${esc(repairHistoryTypeLabel(r))}</span>
          </div>
        </div>
      </div>`;
  }).join("");
}
async function showRepairHistory(id) {
  const rows = await api(`/api/repairs/${id}/history`);
  const repair = REPAIR_ROWS.find(x => Number(x.id) === Number(id)) || {};
  q("repairHistoryBody").innerHTML = renderRepairTimeline(rows, repair);
  q("repairHistoryDialog").showModal();
}
async function updateSourceIncidentStatus() {
  if (!SOURCE_INCIDENT || !SOURCE_INCIDENT.id) return;
  const p = {
    device_id: SOURCE_INCIDENT.device_id,
    incident_datetime: SOURCE_INCIDENT.incident_datetime,
    description: SOURCE_INCIDENT.description,
    severity: SOURCE_INCIDENT.severity,
    reporter: SOURCE_INCIDENT.reporter,
    status: "Đã chuyển sửa chữa",
    note: SOURCE_INCIDENT.note || ""
  };
  try { await api(`/api/incidents/${SOURCE_INCIDENT.id}`, { method: "PUT", body: JSON.stringify(p) }); } catch (e) { console.warn(e); }
}
async function saveRepair(e) {
  e.preventDefault();
  const deviceId = Number(q("selectedDeviceId").value);
  if (!deviceId) return alert("Vui lòng chọn thiết bị trước khi lưu phiếu sửa chữa.");
  if (!q("repairDate").value) return alert("Vui lòng nhập thời gian tiếp nhận.");
  if (!q("issue").value.trim()) return alert("Vui lòng nhập tình trạng/nguyên nhân hỏng.");
  const fileInput = q("repairFiles");
  const pickedFiles = fileInput && fileInput.files ? Array.from(fileInput.files).map(f => f.name) : [];
  const existingFileNames = q("repairId").value ? ((REPAIR_ROWS.find(x => Number(x.id) === Number(q("repairId").value)) || {}).file_names || "") : "";
  const mergedFileNames = [existingFileNames, pickedFiles.join(", ")].filter(Boolean).join(existingFileNames && pickedFiles.length ? ", " : "");
  const payload = {
    device_id: deviceId,
    repair_date: fromDateTimeLocalValue(q("repairDate").value),
    received_at: fromDateTimeLocalValue(q("repairDate").value),
    issue: q("issue").value.trim(),
    work: q("work").value.trim(),
    person: q("person").value.trim(),
    method: q("method").value,
    cost: Number(q("cost").value || 0),
    result: q("result").value.trim(),
    status_after: (() => {
      const s = normalizeRepairStatus(q("repairStatus").value);
      if (s === "Đã hoàn thành") return "Đang hoạt động";
      if (s === "Không sửa được") return "Ngừng hoạt động";
      return q("statusAfter").value || "Chờ sửa chữa";
    })(),
    processing_status: normalizeRepairStatus(q("repairStatus").value),
    incident_id: q("sourceIncidentId") ? Number(q("sourceIncidentId").value || 0) || null : null,
    action_time: q("actionTime") ? fromDateTimeLocalValue(q("actionTime").value) : "",
    note: q("note") ? q("note").value.trim() : "",
    file_count: mergedFileNames ? mergedFileNames.split(",").map(x => x.trim()).filter(Boolean).length : 0,
    file_names: mergedFileNames,
    skip_history: q("saveHistory") ? !q("saveHistory").checked : false
  };
  const id = q("repairId").value;
  if (id) await api(`/api/repairs/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  else {
    await api("/api/repairs", { method: "POST", body: JSON.stringify(payload) });
    await updateSourceIncidentStatus();
  }
  closeRepairDialog();
  await loadData();
}
function applyIncidentPrefill() {
  const raw = localStorage.getItem("repair_prefill_from_incident");
  if (!raw) return;
  try {
    const r = JSON.parse(raw);
    SOURCE_INCIDENT = r;
    resetRepairForm();
    q("sourceIncidentId").value = r.id || "";
    q("repairDialogTitle").textContent = "Tạo phiếu sửa chữa từ sự cố";
    q("repairDialogSubtitle").textContent = "Thông tin sự cố đã được chuyển sang phiếu sửa chữa, vui lòng kiểm tra trước khi lưu";
    q("sourceBadge").style.display = "inline-flex";
    const d = getDevice(r.device_id) || r;
    q("repairDeviceSearch").value = deviceLabel(d);
    setSelectedDevice(d);
    q("repairDate").value = toDateTimeLocalValue(new Date().toISOString().slice(0,16));
    if (q("actionTime")) q("actionTime").value = toDateTimeLocalValue(new Date().toISOString().slice(0,16));
    if (q("saveHistory")) q("saveHistory").checked = true;
    q("issue").value = r.description || "";
    if (q("reporter")) q("reporter").value = r.reporter || "";
    if (q("priority")) if (q("priority")) q("priority").value = r.severity || "Bình thường";
    q("repairStatus").value = "Đang xử lý";
    q("person").value = "Khoa Trang bị";
    q("method").value = "Nội bộ";
    q("work").value = "";
    if (q("note")) q("note").value = r.note || "";
    q("statusAfter").value = "Chờ sửa chữa";
    q("prefillNotice").textContent = `Đã chuyển thông tin từ sự cố #${r.id || ""}. Phiếu chỉ được lưu khi bấm “Lưu phiếu”.`;
    q("prefillNotice").style.display = "block";
    localStorage.removeItem("repair_prefill_from_incident");
    openRepairDialog("prefill");
  } catch (e) {
    console.error(e);
    localStorage.removeItem("repair_prefill_from_incident");
  }
}
async function loadData() {
  DEVICES = await api("/api/devices");
  REPAIR_ROWS = (await api("/api/repairs")).map(r => ({ ...r, processing_status: normalizeRepairStatus(r.processing_status) }));
  META = await api("/api/meta");
  q("departmentFilter").innerHTML = `<option value="ALL">Tất cả khoa/phòng</option>` + (META.departments || []).map(d => `<option value="${d.code}">${esc(d.code)} - ${esc(d.name)}</option>`).join("");
  q("groupFilter").innerHTML = `<option value="ALL">Tất cả nhóm thiết bị</option>` + (META.groups || []).map(g => `<option value="${g.code}">${esc(g.code)} - ${esc(g.name)}</option>`).join("");
  q("deviceFilter").innerHTML = `<option value="ALL">Tất cả thiết bị</option>` + DEVICES.map(d => `<option value="${d.id}">${esc(deviceLabel(d))}</option>`).join("");
  renderDeviceOptions();
  applyFilter();
}
function openRepairFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const repairId = params.get("repair_id");
  if (!repairId) return;
  const row = REPAIR_ROWS.find(x => Number(x.id) === Number(repairId));
  if (!row) {
    alert("Không tìm thấy phiếu sửa chữa liên kết.");
    return;
  }
  // Mở đúng phiếu sửa chữa; đồng thời đánh dấu dòng để người dùng không phải tự tìm.
  setTimeout(() => {
    const tr = document.getElementById(`repair-row-${Number(repairId)}`);
    if (tr) {
      tr.classList.add("highlight-row");
      tr.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
  editRepair(Number(repairId));
}

function exportRepairsExcel() {
  exportA4Report('repairs', { fromId: 'fromDate', toId: 'toDate', deptId: 'departmentFilter', groupId: 'groupFilter' });
}

document.addEventListener("DOMContentLoaded", async () => {
  setLayout("maintenance", "Sửa chữa", "Theo dõi phiếu sửa chữa từ sự cố đến hoàn thành");
  setDefaultDateRange();
  await loadData();
  applyIncidentPrefill();
  openRepairFromUrl();
  q("createRepairBtn").onclick = () => openRepairDialog("create");
  q("closeRepairDialogBtn").onclick = closeRepairDialog;
  q("cancelRepairBtn").onclick = closeRepairDialog;
  q("repairForm").addEventListener("submit", saveRepair);
  q("repairDeviceSearch").addEventListener("change", () => setSelectedDevice(resolveDeviceFromSearch()));
  q("repairDeviceSearch").addEventListener("input", () => { if (!q("repairDeviceSearch").value.trim()) setSelectedDevice(null); });
  ["filterBtn","searchInput","fromDate","toDate","departmentFilter","groupFilter","deviceFilter","repairStatusFilter","methodFilter"].forEach(id => {
    const el = q(id); if (!el) return;
    el.addEventListener(id === "filterBtn" ? "click" : "input", applyFilter);
    el.addEventListener("change", applyFilter);
  });
  q("clearFilterBtn").onclick = clearFilters;
  q("exportRepairExcelBtn").onclick = exportRepairsExcel;
  q("closeRepairHistoryBtn").onclick = () => q("repairHistoryDialog").close();
});

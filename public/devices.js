
let META = { departments: [], groups: [] };
let DEVICES = [];
let FILTERED = [];

function byId(id) { return DEVICES.find(x => x.id === id); }
function departmentName(code) { return META.departments.find(x => x.code === code)?.name || code; }
function groupName(code) { return META.groups.find(x => x.code === code)?.name || code; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#039;"}[ch] || ch));
}

function applyFilters() {
  const qText = q("searchInput").value.trim().toLowerCase();
  const dep = q("departmentFilter").value;
  const grp = q("groupFilter").value;
  const year = q("yearFilter").value;
  const status = q("statusFilter").value;
  const quality = q("qualityFilter").value;
  const funding = q("fundingFilter") ? q("fundingFilter").value : "ALL";
  FILTERED = DEVICES.filter(d => {
    const okText = !qText || [d.device_code, d.insurance_code, d.name, d.manufacturer, d.model, d.serial, departmentName(d.department_code)].join(" ").toLowerCase().includes(qText);
    return okText &&
      (dep === "ALL" || d.department_code === dep) &&
      (grp === "ALL" || d.group_code === grp) &&
      (year === "ALL" || String(d.year_in_use) === String(year)) &&
      (status === "ALL" || d.status === status) &&
      (quality === "ALL" || String(d.quality_level || "") === String(quality)) &&
      (funding === "ALL" || String(d.funding || "") === funding);
  });
  renderRows();
}
function renderStats() {
  if (q("listCount")) q("listCount").textContent = `${FILTERED.length} thiết bị`;
}
function renderRows() {
  if (q("listCount")) q("listCount").textContent = `${FILTERED.length} thiết bị`;
  q("deviceRows").innerHTML = FILTERED.map((d, i) => `
    <tr>
      <td class="col-stt">${i+1}</td>
      <td class="device-code">${escapeHtml(d.device_code || "")}</td>
      <td class="device-name-cell"><div class="device-name" title="${escapeHtml(d.name || "")}">${escapeHtml(d.name || "")}</div></td>
      <td class="department-cell code-only">${escapeHtml(d.department_code || "")}</td>
      <td>${escapeHtml(d.model || "")}</td>
      <td>${escapeHtml(d.serial || "")}</td>
      <td>${escapeHtml(d.year_in_use || "")}</td>
      <td>${escapeHtml(d.location || "")}</td>
      <td><span class="tag ${statusTagClass(d.status)}">${escapeHtml(d.status || "")}</span></td>
      <td>
        <div class="table-actions device-row-actions">
          <a class="btn btn-sm" href="/device-detail.html?id=${Number(d.id)}">Xem hồ sơ</a>
          <button class="btn btn-sm" onclick="showDeviceQrModal(byId(${Number(d.id)}))">QR</button>
          <button class="btn btn-sm" onclick="editDevice(${Number(d.id)})">Cập nhật</button>
          <button class="btn btn-sm danger-light" onclick="deleteDevice(${Number(d.id)})">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="10" class="center-empty">Chưa có dữ liệu.</td></tr>`;
}
function editDevice(id) {
  const d = byId(id);
  q("deviceId").value = d.id;
  q("departmentInput").value = d.department_code;
  q("groupInput").value = d.group_code;
  q("nameInput").value = d.name || "";
  q("manufacturerInput").value = d.manufacturer || "";
  q("modelInput").value = d.model || "";
  q("insuranceInput").value = d.insurance_code || "";
  q("serialInput").value = d.serial || "";
  q("countryInput").value = d.country || "";
  q("yearManufacturedInput").value = d.year_manufactured || "";
  q("yearUseInput").value = d.year_in_use || "";
  q("warrantyInput").value = d.warranty_end || "";
  q("statusInput").value = d.status || "Đang hoạt động";
  q("qualityInput").value = String(d.quality_level || 3);
  q("costInput").value = d.cost || 0;
  q("fundingInput").value = d.funding || "";
  q("locationInput").value = d.location || "";
  q("noteInput").value = d.note || "";
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}
async function deleteDevice(id) {
  if (!confirm("Xóa thiết bị này? Chỉ thiết bị chưa phát sinh lịch sử mới có thể xóa.")) return;
  try {
    await api(`/api/devices/${id}`, { method: "DELETE" });
    await loadData();
  } catch (e) {
    alert(e?.message || "Không thể xóa thiết bị.");
  }
}
function resetForm() {
  q("deviceForm").reset();
  q("deviceId").value = "";
}
async function saveDevice(e) {
  e.preventDefault();
  const payload = {
    department_code: q("departmentInput").value,
    group_code: q("groupInput").value,
    name: q("nameInput").value.trim(),
    manufacturer: q("manufacturerInput").value.trim(),
    model: q("modelInput").value.trim(),
    insurance_code: q("insuranceInput").value.trim(),
    // Serial Number của hãng là trường độc lập. Tuyệt đối không tự suy từ mã HIS/BHXH.
    serial: q("serialInput").value.trim(),
    country: q("countryInput").value.trim(),
    year_manufactured: Number(q("yearManufacturedInput").value || 0),
    year_in_use: Number(q("yearUseInput").value || 0),
    warranty_end: q("warrantyInput").value,
    status: q("statusInput").value,
    quality_level: Number(q("qualityInput").value || 3),
    cost: Number(q("costInput").value || 0),
    funding: q("fundingInput").value.trim(),
    location: q("locationInput").value.trim(),
    note: q("noteInput").value.trim()
  };
  const id = q("deviceId").value;
  try {
    if (id) await api(`/api/devices/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(`/api/devices`, { method: "POST", body: JSON.stringify(payload) });
    resetForm();
    await loadData();
    alert("Đã lưu thiết bị.");
  } catch (e) {
    alert(e?.message || "Không lưu được thiết bị.");
  }
}
function exportDevices() {
  const rows = [["Mã thiết bị","Tên thiết bị","Nhóm","Khoa/Phòng","Hãng SX","Model","Năm SD","Hạn BH","Tình trạng","Cấp chất lượng","Serial","Nước sản xuất","Năm sản xuất","Nguyên giá","Nguồn kinh phí","Vị trí","Ghi chú"]];
  FILTERED.forEach(d => rows.push([d.device_code,d.name,d.group_name,d.department_name,d.manufacturer,d.model,d.year_in_use,formatDateVN(d.warranty_end),d.status,d.quality_level,d.serial,d.country,d.year_manufactured,d.cost,d.funding,d.location,d.note]));
  exportCsv("danh_sach_thiet_bi.csv", rows);
}
async function loadData() {
  META = await api("/api/meta");
  DEVICES = await api("/api/devices");
  q("departmentFilter").innerHTML = optDepartmentFilter(META.departments, "Tất cả khoa/phòng");
  q("groupFilter").innerHTML = opt(META.groups, "Tất cả nhóm");
  const years = [...new Set(DEVICES.map(d => d.year_in_use))].sort((a,b)=>b-a);
  q("yearFilter").innerHTML = '<option value="ALL">Tất cả năm</option>' + years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join("");
  q("statusFilter").innerHTML = '<option value="ALL">Tất cả trạng thái</option><option>Đang hoạt động</option><option>Chờ sửa chữa</option><option>Ngừng hoạt động</option>';
  q("qualityFilter").innerHTML = '<option value="ALL">Tất cả cấp chất lượng</option><option value="1">Cấp 1</option><option value="2">Cấp 2</option><option value="3">Cấp 3</option><option value="4">Cấp 4</option><option value="5">Cấp 5</option>';
  const fundings = [...new Set(DEVICES.map(d => (d.funding || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b, "vi"));
  if (q("fundingFilter")) q("fundingFilter").innerHTML = '<option value="ALL">Tất cả nguồn kinh phí</option>' + fundings.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
  q("departmentInput").innerHTML = opt(META.departments);
  q("groupInput").innerHTML = opt(META.groups);
  FILTERED = DEVICES.slice();
  applyFilters();
}
document.addEventListener("DOMContentLoaded", async () => {
  setLayout("devices","Thiết bị","Quản lý hồ sơ thiết bị, Serial Number, khoa sử dụng và tình trạng");
  applyFieldLabels("deviceForm", {departmentInput:"Khoa sử dụng",groupInput:"Nhóm thiết bị",nameInput:"Tên thiết bị",manufacturerInput:"Hãng sản xuất",modelInput:"Model",insuranceInput:"Mã máy BHXH / mã quản lý",serialInput:"Serial Number của hãng",countryInput:"Nước sản xuất",yearManufacturedInput:"Năm sản xuất",yearUseInput:"Năm sử dụng",warrantyInput:"Hạn bảo hành",statusInput:"Tình trạng",qualityInput:"Cấp chất lượng",costInput:"Nguyên giá",fundingInput:"Nguồn kinh phí",locationInput:"Vị trí đặt máy",noteInput:"Ghi chú"});
  await loadData();
  q("filterBtn").onclick = applyFilters;
  q("resetBtn").onclick = () => {
    q("searchInput").value = "";
    q("departmentFilter").value = "ALL";
    q("groupFilter").value = "ALL";
    q("yearFilter").value = "ALL";
    q("statusFilter").value = "ALL";
    q("qualityFilter").value = "ALL";
    if (q("fundingFilter")) q("fundingFilter").value = "ALL";
    applyFilters();
  };
  ["searchInput","departmentFilter","groupFilter","yearFilter","statusFilter","qualityFilter","fundingFilter"].forEach(id => q(id).addEventListener(id==="searchInput"?"input":"change", applyFilters));
  q("deviceForm").addEventListener("submit", saveDevice);
  q("exportBtn")?.addEventListener("click", exportDevices);
  if (q("exportExcelBtn")) q("exportExcelBtn").onclick = exportDevicesExcel;
});

function exportDevicesExcel() {
  exportA4Report('devices', { deptId: 'departmentFilter', groupId: 'groupFilter' });
}

function resolveDepartmentCodeFromExcel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const byCode = META.departments.find(d => d.code === s);
  if (byCode) return byCode.code;
  const prefix = s.split("-")[0].trim();
  const byPrefix = META.departments.find(d => d.code === prefix);
  if (byPrefix) return byPrefix.code;
  const byName = META.departments.find(d => d.name === s);
  return byName ? byName.code : "";
}
function resolveGroupCodeFromExcel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const byCode = META.groups.find(g => g.code === s);
  if (byCode) return byCode.code;
  const byName = META.groups.find(g => g.name === s);
  return byName ? byName.code : "";
}

function reportFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

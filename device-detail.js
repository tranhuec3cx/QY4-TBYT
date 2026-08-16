
let META = { departments: [], groups: [] };
let DEVICE = null;
let DEVICE_ID = null;

function extractSerialFromHisCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split('.').map(x => x.trim()).filter(Boolean);
  const idx = parts.findIndex(x => x === '40026');
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) return parts[parts.length - 1];
  const m = raw.match(/40026[.\-_/ ]+(\d+)$/);
  return m ? m[1] : '';
}
function autoFillGeneralSerial() {
  const sn = extractSerialFromHisCode(q('generalInsuranceCode')?.value || '');
  if (sn && q('generalSerial') && !String(q('generalSerial').value || '').trim()) q('generalSerial').value = sn;
}


function esc(value) { return String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function infoItem(label, value) {
  return `<div class="info-item"><div class="info-label">${label}</div><div class="info-value">${value || "—"}</div></div>`;
}
function rowBtns(editFn, delFn, id) {
  return `<div class="table-actions"><button class="btn" onclick="${editFn}(${id})">Cập nhật</button><button class="btn btn-danger" onclick="${delFn}(${id})">Xóa</button></div>`;
}
function renderRows(id, rows, fn, colspan) {
  q(id).innerHTML = rows.length ? rows.map((row, idx) => fn(row, idx)).join("") : `<tr><td colspan="${colspan}" class="center-empty">Chưa có dữ liệu.</td></tr>`;
}
function showForm(wrapId, show) { q(wrapId).style.display = show ? "block" : "none"; }
function resetAccessoryForm(){ q("accessoryForm").reset(); q("accessoryId").value=""; showForm("accessoryFormWrap", false); }
function resetRepairForm(){ q("repairForm").reset(); q("repairId").value=""; showForm("repairFormWrap", false); }
function resetMaintForm(){ q("maintForm").reset(); q("maintId").value=""; showForm("maintFormWrap", false); }
function resetOpForm(){ q("opForm").reset(); q("opId").value=""; showForm("opFormWrap", false); }
function resetDocForm(){ q("docForm").reset(); q("docId").value=""; if (q("docCurrentFile")) q("docCurrentFile").textContent="Chưa có file đính kèm."; showForm("docFormWrap", false); }
function docFileLabel(x) {
  if (!x.file_path) return "—";
  const name = x.original_name || x.stored_name || "Tệp đính kèm";
  return `<a href="${x.file_path}" target="_blank" rel="noopener">${name}</a>`;
}
function docExtraBtns(x) {
  const html = `<button class="btn btn-sm" onclick="editDoc(${x.id})">Cập nhật</button><button class="btn btn-danger btn-sm" onclick="deleteDoc(${x.id})">Xóa</button>`;
  return `<div class="table-actions">${html}</div>`;
}
function attachedPath(value){ const v = String(value || "").trim(); return v.startsWith("/uploads/") ? v : ""; }
function fileDownloadCell(path, name){
  if(!path) return "";
  const label = name || String(path).split("/").pop() || "Tệp đính kèm";
  return `<a class="btn btn-secondary btn-sm" href="${esc(path)}" target="_blank" rel="noopener">Tải file</a><div class="small file-name-line">${esc(label)}</div>`;
}

function fillGeneralForm() {
  q("generalDepartment").innerHTML = META.departments.map(x=>`<option value="${x.code}">${x.name}</option>`).join("");
  q("generalGroup").innerHTML = META.groups.map(x=>`<option value="${x.code}">${x.name}</option>`).join("");
  q("generalDepartment").value = DEVICE.department_code;
  q("generalGroup").value = DEVICE.group_code;
  q("generalDeviceCode").value = DEVICE.device_code || "";
  q("generalInsuranceCode").value = DEVICE.insurance_code || "";
  q("generalName").value = DEVICE.name || "";
  q("generalManufacturer").value = DEVICE.manufacturer || "";
  q("generalModel").value = DEVICE.model || "";
  q("generalSerial").value = DEVICE.serial || "";
  q("generalCountry").value = DEVICE.country || "";
  q("generalYearManufactured").value = DEVICE.year_manufactured || "";
  q("generalYearInUse").value = DEVICE.year_in_use || "";
  q("generalWarranty").value = DEVICE.warranty_end || "";
  q("generalStatus").value = DEVICE.status || "Đang hoạt động";
  q("generalQuality").value = String(DEVICE.quality_level || 3);
  q("generalCost").value = DEVICE.cost || 0;
  q("generalFunding").value = DEVICE.funding || "";
  q("generalLocation").value = DEVICE.location || "";
  q("generalNote").value = DEVICE.note || "";
}
function renderGeneralInfo() {
  q("infoGeneral").innerHTML = `
    <div class="info-section"><h3>Định danh thiết bị</h3>${infoItem("Mã thiết bị", DEVICE.device_code)}${infoItem("Mã bảo hiểm", DEVICE.insurance_code)}${infoItem("Tên thiết bị", DEVICE.name)}${infoItem("Serial hãng", DEVICE.serial)}</div>
    <div class="info-section"><h3>Thông tin kỹ thuật</h3>${infoItem("Nhóm thiết bị", DEVICE.group_name)}${infoItem("Hãng sản xuất", DEVICE.manufacturer)}${infoItem("Model", DEVICE.model)}${infoItem("Nước sản xuất", DEVICE.country)}${infoItem("Năm sản xuất", DEVICE.year_manufactured)}</div>
    <div class="info-section"><h3>Quản lý sử dụng</h3>${infoItem("Khoa/Phòng", DEVICE.department_name)}${infoItem("Vị trí đặt máy", DEVICE.location)}${infoItem("Năm sử dụng", DEVICE.year_in_use)}${infoItem("Hạn bảo hành", formatDateVN(DEVICE.warranty_end))}</div>
    <div class="info-section"><h3>Tài chính / tình trạng</h3>${infoItem("Nguyên giá", formatCurrency(DEVICE.cost))}${infoItem("Nguồn kinh phí", DEVICE.funding)}${infoItem("Tình trạng", DEVICE.status)}${infoItem("Cấp chất lượng", DEVICE.quality_level ? `Cấp ${DEVICE.quality_level}` : "—")}${infoItem("Ghi chú", DEVICE.note || "—")}</div>
  `;
}
function renderAll() {
  q("detailName").textContent = DEVICE.name;
  q("detailMeta").innerHTML = `<b>Mã:</b> ${esc(DEVICE.device_code)} &nbsp; | &nbsp; <b>Khoa:</b> ${esc(DEVICE.department_name)} &nbsp; | &nbsp; <b>Nhóm:</b> ${esc(DEVICE.group_name)} &nbsp; | &nbsp; <b>Model:</b> ${esc(DEVICE.model || "—")}`;
  q("detailStatus").innerHTML = `<span class="tag ${statusTagClass(DEVICE.status)}">${DEVICE.status}</span>`;
  if (q("detailQrBtn")) q("detailQrBtn").onclick = () => showDeviceQrModal(DEVICE);
  const latestMaint = (DEVICE.maintenances || []).slice().sort((a,b)=>String(b.maintenance_date||"").localeCompare(String(a.maintenance_date||"")))[0];
  const latestInspection = (DEVICE.inspections || []).slice().sort((a,b)=>String(b.inspection_date||"").localeCompare(String(a.inspection_date||"")))[0];
  const openIncidents = (DEVICE.incidents || []).filter(x => x.status === "Mới ghi nhận" || x.status === "Mới báo").length;
  const openRepairs = (DEVICE.repairs || []).filter(x => ["Đang xử lý","Chờ linh kiện","Mới tiếp nhận","Đang sửa chữa"].includes(String(x.processing_status||""))).length;
  if(q("deviceCurrentState")) q("deviceCurrentState").innerHTML = `
    <div><span>Tình trạng</span><b><span class="tag ${statusTagClass(DEVICE.status)}">${esc(DEVICE.status||"—")}</span></b></div>
    <div><span>Bảo dưỡng gần nhất</span><b>${latestMaint ? formatDateTimeVN(latestMaint.maintenance_date) : "—"}</b></div>
    <div><span>Kiểm định gần nhất</span><b>${latestInspection ? formatDateTimeVN(latestInspection.inspection_date) : "—"}</b></div>
    <div><span>Sự cố đang mở</span><b>${openIncidents}</b></div>
    <div><span>Phiếu sửa chữa</span><b>${openRepairs}</b></div>`;
  q("quickAccessories").textContent = DEVICE.accessories.length;
  q("quickRepairs").textContent = DEVICE.repairs.length;
  q("quickMaint").textContent = DEVICE.maintenances.length;
  if (q("quickInspection")) q("quickInspection").textContent = (DEVICE.inspections || []).length;
  q("quickDocs").textContent = DEVICE.documents.length;
  renderGeneralInfo();
  renderRows("accessoryRows", DEVICE.accessories, x => `<tr><td>${x.name||""}</td><td>${x.code||""}</td><td>${x.maker_country||""}</td><td>${x.serial||""}</td><td>${x.note||""}</td><td>${rowBtns('editAccessory','deleteAccessory',x.id)}</td></tr>`, 6);
  if (q("addIncidentFromDeviceBtn")) q("addIncidentFromDeviceBtn").href = `/tickets.html?from=device-detail&device_id=${encodeURIComponent(DEVICE_ID)}`;
  if (q("incidentRows")) renderRows("incidentRows", DEVICE.incidents || [], x => `<tr><td>${formatDateTimeVN(x.incident_datetime)}</td><td class="wrap-text">${esc(x.description||"")}</td><td>${esc(x.reporter||"")}</td><td><span class="tag ${statusTagClass(x.status)}">${esc(x.status||"")}</span></td><td class="wrap-text">${esc(x.local_resolution_note||"")}</td><td>${x.linked_repair_id ? `<button class="btn btn-sm" onclick="showRepairDetail(${Number(x.linked_repair_id)})">Xem sửa chữa</button>` : "—"}</td></tr>`, 6);
  renderRows("repairRows", DEVICE.repairs, (x, idx) => `<tr><td>${idx+1}</td><td>${formatDateTimeVN(x.received_at || x.repair_date)}</td><td class="wrap-text">${esc(x.person || "")}</td><td class="wrap-text">${esc(x.issue||"")}</td><td class="wrap-text">${esc(x.work || x.action_summary || "")}</td><td><span class="tag ${statusTagClass(x.processing_status)}">${esc(x.processing_status||"")}</span></td><td>${formatCurrency(x.cost)}</td><td class="wrap-text">${esc(x.result||"")}</td><td><button class="btn btn-sm" onclick="showRepairDetail(${Number(x.id)})">Xem chi tiết</button></td></tr>`, 9);
  renderRows("maintRows", DEVICE.maintenances, x => `<tr><td>${formatDateTimeVN(x.maintenance_date)}</td><td>${esc(x.type||"")}</td><td class="wrap-text">${esc(x.content||"")}</td><td>${esc(x.result||"")}</td><td>${esc(x.performer||"")}</td><td>${esc(x.user_confirm||"")}</td><td>${esc(x.vendor||"")}</td><td>${formatDateVN(x.next_date)}</td><td>${fileDownloadCell(x.file_path, x.original_name || x.stored_name)}</td><td>${rowBtns('editMaint','deleteMaint',x.id)}</td></tr>`, 10);
  if (q("inspectionRows")) renderRows("inspectionRows", DEVICE.inspections || [], x => `<tr><td>${formatDateTimeVN(x.inspection_date)}</td><td>${esc(x.type||"")}</td><td>${esc(x.organization||"")}</td><td>${esc(x.certificate_no||"")}</td><td>${esc(x.result||"")}</td><td>${formatDateVN(x.next_date)}</td><td>${fileDownloadCell(attachedPath(x.file_note), "")}</td><td><div class="table-actions"><button class="btn btn-sm" onclick="editInspection(${Number(x.id)})">Cập nhật</button><button class="btn btn-danger btn-sm" onclick="deleteInspection(${Number(x.id)})">Xóa</button></div></td></tr>`, 8);
  renderRows("opRows", DEVICE.operation_logs, x => `<tr><td>${x.log_datetime||""}</td><td>${x.user_name||""}</td><td>${x.department_code||""}</td><td>${x.usage_count||""}</td><td>${x.status_before||""}</td><td>${x.status_after||""}</td><td>${x.note||""}</td><td>${rowBtns('editOp','deleteOp',x.id)}</td></tr>`, 8);
  renderRows("docRows", DEVICE.documents, x => `<tr><td>${x.name||""}</td><td>${x.type||""}</td><td>${formatDateVN(x.doc_date)}</td><td>${x.updated_by||""}</td><td>${docFileLabel(x)}</td><td>${x.note||""}</td><td>${docExtraBtns(x)}</td></tr>`, 7);
}
async function loadDevice() {
  META = await api("/api/meta");
  DEVICE = await api(`/api/devices/${DEVICE_ID}`);
  renderAll();
}
async function saveGeneral() {
  const payload = {
    department_code: q("generalDepartment").value,
    group_code: q("generalGroup").value,
    device_code: q("generalDeviceCode").value,
    insurance_code: q("generalInsuranceCode").value.trim(),
    name: q("generalName").value.trim(),
    manufacturer: q("generalManufacturer").value.trim(),
    model: q("generalModel").value.trim(),
    serial: q("generalSerial").value.trim() || extractSerialFromHisCode(q("generalInsuranceCode").value),
    country: q("generalCountry").value.trim(),
    year_manufactured: Number(q("generalYearManufactured").value || 0),
    year_in_use: Number(q("generalYearInUse").value || 0),
    warranty_end: q("generalWarranty").value,
    status: q("generalStatus").value,
    quality_level: Number(q("generalQuality").value || 3),
    cost: Number(q("generalCost").value || 0),
    funding: q("generalFunding").value.trim(),
    location: q("generalLocation").value.trim(),
    note: q("generalNote").value.trim()
  };
  await api(`/api/devices/${DEVICE_ID}`, { method: "PUT", body: JSON.stringify(payload) });
  toggleGeneral(false);
  await loadDevice();
}
function toggleGeneral(editing) {
  q("infoGeneral").style.display = editing ? "none" : "grid";
  q("generalForm").style.display = editing ? "block" : "none";
  q("editGeneralBtn").style.display = editing ? "none" : "inline-block";
  q("saveGeneralBtn").style.display = editing ? "inline-block" : "none";
  q("cancelGeneralBtn").style.display = editing ? "inline-block" : "none";
  if (editing) fillGeneralForm();
}
function editAccessory(id) {
  const x = DEVICE.accessories.find(r => r.id === id);
  q("accessoryId").value = x.id; q("accessoryName").value = x.name || ""; q("accessoryCode").value = x.code || ""; q("accessoryMakerCountry").value = x.maker_country || ""; q("accessorySerial").value = x.serial || ""; q("accessoryNote").value = x.note || "";
  showForm("accessoryFormWrap", true);
}
async function deleteAccessory(id) { if (!confirm("Xóa phụ kiện này?")) return; await api(`/api/accessories/${id}`, { method:"DELETE" }); await loadDevice(); }
async function saveAccessory(e) {
  e.preventDefault();
  const payload = { device_id: Number(DEVICE_ID), name: q("accessoryName").value.trim(), code: q("accessoryCode").value.trim(), maker_country: q("accessoryMakerCountry").value.trim(), serial: q("accessorySerial").value.trim(), note: q("accessoryNote").value.trim() };
  const id = q("accessoryId").value;
  if (id) await api(`/api/accessories/${id}`, { method:"PUT", body: JSON.stringify(payload) });
  else await api(`/api/accessories`, { method:"POST", body: JSON.stringify(payload) });
  resetAccessoryForm(); await loadDevice();
}

async function showRepairDetail(id) {
  const x = DEVICE.repairs.find(r => Number(r.id) === Number(id));
  if (!x) return alert("Không tìm thấy phiếu sửa chữa.");
  const history = await api(`/api/repairs/${id}/history`);
  const historyRows = history.length ? history.map((h) => {
    const status = h.new_status || h.old_status || x.processing_status || "Đang xử lý";
    const type = h.entry_type || h.action_type || "Cập nhật";
    const typeLabel = (type.includes("Tự động") || h.action_type === "Tạo từ sự cố") ? "🤖 Tự động" : (type.includes("Hoàn thành") || h.action_type === "Hoàn thành" ? "👤 Hoàn thành" : "👤 Cập nhật");
    const dotClass = status === "Đã hoàn thành" ? "done" : (status === "Chờ linh kiện" ? "waiting" : (status === "Không sửa được" ? "failed" : "active"));
    return `
      <div class="timeline-item ${dotClass}">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-head">
            <div>
              <div class="timeline-time">${formatDateTimeVN(h.action_time)}</div>
              <div class="timeline-actor">${esc(h.actor || "Hệ thống")}</div>
            </div>
            <span class="tag ${statusTagClass(status)}">${esc(status)}</span>
          </div>
          <div class="timeline-content">${esc(h.note || h.action_type || "")}</div>
          <div class="timeline-meta">
            <span>Chi phí: <b>${formatCurrency(h.cost ?? x.cost ?? 0)}</b></span>
            <span>${esc(typeLabel)}</span>
          </div>
        </div>
      </div>`;
  }).join("") : `<div class="center-empty">Chưa có lịch sử xử lý.</div>`;
  q("repairDetailBody").innerHTML = `
    <div class="info-grid compact-info-grid">
      ${infoItem("Thời gian tiếp nhận", formatDateTimeVN(x.received_at || x.repair_date))}
      ${infoItem("Đơn vị/người xử lý", esc(x.person || ""))}
      ${infoItem("Nguồn phát sinh", x.source_incident_id ? `Từ sự cố #${x.source_incident_id}` : "Tạo trực tiếp")}
      ${infoItem("Trạng thái", `<span class="tag ${statusTagClass(x.processing_status)}">${esc(x.processing_status || "")}</span>`)}
      ${infoItem("Nguyên nhân hỏng", esc(x.issue || ""))}
      ${infoItem("Nội dung sửa chữa", esc(x.work || ""))}
      ${infoItem("Kinh phí", formatCurrency(x.cost || 0))}
      ${infoItem("Kết quả sau sửa", esc(x.result || x.status_after || ""))}
    </div>
    <h3 style="margin-top:16px">Lịch sử sửa chữa</h3>
    <div class="repair-timeline">${historyRows}</div>
  `;
  q("repairDetailDialog").showModal();
}

function editInspection(id) {
  window.location.href = `/inspections.html?edit_id=${encodeURIComponent(id)}&from=device-detail&device_id=${encodeURIComponent(DEVICE_ID)}`;
}
async function deleteInspection(id) {
  if (!confirm("Xóa hồ sơ kiểm định/hiệu chuẩn này?")) return;
  await api(`/api/inspections/${id}`, { method:"DELETE" });
  await loadDevice();
}

function editRepair(id) {
  const x = DEVICE.repairs.find(r => r.id === id);
  q("repairId").value = x.id; q("repairDate").value = toDateTimeLocalValue(x.repair_date || ""); q("repairMethod").value = x.method || "Nội bộ"; q("repairPerson").value = x.person || ""; q("repairIssue").value = x.issue || ""; q("repairWork").value = x.work || ""; q("repairCost").value = x.cost || 0; q("repairResult").value = x.result || ""; q("repairStatusAfter").value = x.status_after || "Đang hoạt động";
  showForm("repairFormWrap", true);
}
async function deleteRepair(id) { if (!confirm("Xóa bản ghi sửa chữa này?")) return; await api(`/api/repairs/${id}`, { method:"DELETE" }); await loadDevice(); }
async function saveRepair(e) {
  e.preventDefault();
  const payload = { device_id: Number(DEVICE_ID), repair_date: fromDateTimeLocalValue(q("repairDate").value), issue: q("repairIssue").value.trim(), work: q("repairWork").value.trim(), person: q("repairPerson").value.trim(), method: q("repairMethod").value, cost: Number(q("repairCost").value||0), result: q("repairResult").value.trim(), status_after: q("repairStatusAfter").value, processing_status: "Đang xử lý" };
  const id = q("repairId").value;
  if (id) await api(`/api/repairs/${id}`, { method:"PUT", body: JSON.stringify(payload) });
  else await api(`/api/repairs`, { method:"POST", body: JSON.stringify(payload) });
  resetRepairForm(); await loadDevice();
}
function editMaint(id) {
  const x = DEVICE.maintenances.find(r => r.id === id);
  q("maintId").value = x.id; q("maintDate").value = toDateTimeLocalValue(x.maintenance_date || ""); q("maintType").value = x.type || "Bảo dưỡng định kỳ"; q("maintResult").value = x.result || "Đạt"; q("maintContent").value = x.content || ""; q("maintPerformer").value = x.performer || ""; q("maintUserConfirm").value = x.user_confirm || ""; q("maintVendor").value = x.vendor || ""; q("maintNextDate").value = x.next_date || ""; q("maintNote").value = x.note || "";
  showForm("maintFormWrap", true);
}
async function deleteMaint(id) { if (!confirm("Xóa bản ghi bảo dưỡng này?")) return; await api(`/api/maintenances/${id}`, { method:"DELETE" }); await loadDevice(); }
async function saveMaint(e) {
  e.preventDefault();
  const fd = new FormData();
  fd.append("device_id", String(DEVICE_ID));
  fd.append("maintenance_date", fromDateTimeLocalValue(q("maintDate").value));
  fd.append("type", q("maintType").value);
  fd.append("content", q("maintContent").value.trim());
  fd.append("result", q("maintResult").value);
  fd.append("performer", q("maintPerformer").value.trim());
  fd.append("user_confirm", q("maintUserConfirm").value.trim());
  fd.append("vendor", q("maintVendor").value.trim());
  fd.append("next_date", q("maintNextDate").value);
  fd.append("note", q("maintNote").value.trim());
  const f = q("maintFile"); if (f && f.files && f.files[0]) fd.append("file", f.files[0]);
  const id = q("maintId").value;
  const res = await fetch(id ? `/api/maintenances/${id}` : `/api/maintenances`, { method: id ? "PUT" : "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  resetMaintForm(); await loadDevice();
}
function editOp(id) {
  const x = DEVICE.operation_logs.find(r => r.id === id);
  q("opId").value = x.id; q("opDatetime").value = (x.log_datetime || "").replace(" ","T"); q("opUser").value = x.user_name || ""; q("opDepartmentCode").value = x.department_code || ""; q("opUsageCount").value = x.usage_count || ""; q("opBefore").value = x.status_before || ""; q("opAfter").value = x.status_after || ""; q("opNote").value = x.note || "";
  showForm("opFormWrap", true);
}
async function deleteOp(id) { if (!confirm("Xóa nhật ký vận hành này?")) return; await api(`/api/operation-logs/${id}`, { method:"DELETE" }); await loadDevice(); }
async function saveOp(e) {
  e.preventDefault();
  const payload = { device_id: Number(DEVICE_ID), log_datetime: q("opDatetime").value.replace("T"," "), user_name: q("opUser").value.trim(), department_code: q("opDepartmentCode").value.trim(), usage_count: q("opUsageCount").value.trim(), status_before: q("opBefore").value.trim(), status_after: q("opAfter").value.trim(), note: q("opNote").value.trim() };
  const id = q("opId").value;
  if (id) await api(`/api/operation-logs/${id}`, { method:"PUT", body: JSON.stringify(payload) });
  else await api(`/api/operation-logs`, { method:"POST", body: JSON.stringify(payload) });
  resetOpForm(); await loadDevice();
}
function editDoc(id) {
  const x = DEVICE.documents.find(r => r.id === id);
  q("docId").value = x.id; q("docName").value = x.name || ""; q("docType").value = x.type || ""; q("docDate").value = x.doc_date || ""; q("docBy").value = x.updated_by || ""; q("docNote").value = x.note || ""; if (q("docCurrentFile")) q("docCurrentFile").innerHTML = x.file_path ? `File hiện tại: <a href="${x.file_path}" target="_blank" rel="noopener">${x.original_name || x.stored_name || "Tệp đính kèm"}</a>` : "Chưa có file đính kèm.";
  showForm("docFormWrap", true);
}
async function deleteDoc(id) { if (!confirm("Xóa tài liệu này?")) return; await api(`/api/documents/${id}`, { method:"DELETE" }); await loadDevice(); }
async function saveDoc(e) {
  e.preventDefault();
  const fd = new FormData();
  fd.append("device_id", String(DEVICE_ID));
  fd.append("name", q("docName").value.trim());
  fd.append("type", q("docType").value.trim());
  fd.append("doc_date", q("docDate").value);
  fd.append("updated_by", q("docBy").value.trim());
  fd.append("note", q("docNote").value.trim());
  const fileInput = q("docFile");
  if (fileInput && fileInput.files && fileInput.files[0]) fd.append("file", fileInput.files[0]);
  const id = q("docId").value;
  const url = id ? `/api/documents/${id}` : `/api/documents`;
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, { method, body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Không thể lưu tài liệu.");
  }
  resetDocForm();
  await loadDevice();
}
document.addEventListener("DOMContentLoaded", async () => {
  DEVICE_ID = new URL(window.location.href).searchParams.get("id");
  setLayout("devices","Lý lịch thiết bị","Thông tin chung, sửa chữa, bảo dưỡng, kiểm định và tài liệu");
  applyFieldLabels("generalForm", {
    generalDepartment:"Khoa sử dụng", generalGroup:"Nhóm thiết bị", generalName:"Tên thiết bị",
    generalDeviceCode:"Mã thiết bị", generalInsuranceCode:"Mã bảo hiểm", generalManufacturer:"Hãng sản xuất", generalModel:"Model", generalSerial:"Serial hãng",
    generalCountry:"Nước sản xuất", generalYearManufactured:"Năm sản xuất", generalYearInUse:"Năm sử dụng",
    generalWarranty:"Hạn bảo hành", generalStatus:"Tình trạng", generalQuality:"Cấp chất lượng",
    generalCost:"Nguyên giá", generalFunding:"Nguồn kinh phí", generalLocation:"Vị trí đặt máy", generalNote:"Ghi chú / Nội dung"
  });
  applyFieldLabels("maintForm", {maintDate:"Thời gian thực hiện", maintType:"Loại bảo dưỡng", maintResult:"Đánh giá", maintContent:"Nội dung bảo dưỡng", maintPerformer:"Người thực hiện", maintUserConfirm:"Người sử dụng xác nhận", maintVendor:"Đơn vị / nhà cung cấp", maintNextDate:"Ngày bảo dưỡng tiếp theo", maintFile:"Tải file đính kèm", maintNote:"Ghi chú"});
  applyFieldLabels("repairForm", {repairDate:"Thời gian tiếp nhận", repairMethod:"Hình thức sửa chữa", repairPerson:"Đơn vị/người xử lý", repairIssue:"Tình trạng / nguyên nhân hỏng", repairWork:"Nội dung sửa chữa", repairCost:"Kinh phí", repairResult:"Kết quả sửa chữa", repairStatusAfter:"TTTB sau sửa chữa"});
  applyFieldLabels("accessoryForm", {accessoryName:"Tên bộ phận / phụ kiện", accessoryCode:"Ký mã hiệu", accessoryMakerCountry:"Hãng, nước sản xuất", accessorySerial:"Số series", accessoryNote:"Ghi chú"});
  await loadDevice();

  document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    q(btn.dataset.tab).classList.add("active");
  }));

  if (q("closeRepairDetailBtn")) q("closeRepairDetailBtn").onclick = () => q("repairDetailDialog").close();
  q("editGeneralBtn").onclick = () => toggleGeneral(true);
  q("saveGeneralBtn").onclick = saveGeneral;
  q("cancelGeneralBtn").onclick = () => toggleGeneral(false);
  q("generalInsuranceCode")?.addEventListener("input", autoFillGeneralSerial);

  q("toggleAccessoryBtn").onclick = () => { resetAccessoryForm(); showForm("accessoryFormWrap", true); };
  q("cancelAccessoryBtn").onclick = resetAccessoryForm;
  q("accessoryForm").addEventListener("submit", saveAccessory);

  q("toggleRepairBtn").onclick = () => { resetRepairForm(); showForm("repairFormWrap", true); };
  q("cancelRepairBtn").onclick = resetRepairForm;
  q("repairForm").addEventListener("submit", saveRepair);

  q("toggleMaintBtn").onclick = () => { resetMaintForm(); showForm("maintFormWrap", true); };
  q("cancelMaintBtn").onclick = resetMaintForm;
  q("maintForm").addEventListener("submit", saveMaint);

  q("toggleOpBtn").onclick = () => { resetOpForm(); showForm("opFormWrap", true); };
  q("cancelOpBtn").onclick = resetOpForm;
  q("opForm").addEventListener("submit", saveOp);

  q("toggleDocBtn").onclick = () => { resetDocForm(); showForm("docFormWrap", true); };
  q("cancelDocBtn").onclick = resetDocForm;
  q("docForm").addEventListener("submit", saveDoc);
});

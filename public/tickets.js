let INCIDENT_ROWS = [];
let FILTERED_INCIDENTS = [];
let DEVICES = [];
function norm(value){ return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function esc(value){ return String(value ?? "").replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }
function getDevice(id){ return DEVICES.find(d => Number(d.id) === Number(id)) || null; }
function deviceLabel(d){ return d ? `${d.device_code || d.serial || "TB-"+d.id} - ${d.name || ""}${d.serial ? " - " + d.serial : ""}` : ""; }
function renderDeviceDatalist(){ if(q("deviceOptions")) q("deviceOptions").innerHTML = DEVICES.map(d=>`<option value="${esc(deviceLabel(d))}" data-id="${d.id}"></option>`).join(""); }
function resolveIncidentDevice(){
  const raw = q("deviceSearch") ? q("deviceSearch").value.trim() : "";
  if(!raw) return null;
  const rawNorm = norm(raw);
  return DEVICES.find(d => norm(deviceLabel(d)) === rawNorm) || DEVICES.find(d => norm([d.device_code,d.name,d.serial,d.model].join(" ")).includes(rawNorm));
}
function setIncidentDevice(d){
  if(q("deviceId")) q("deviceId").value = d ? d.id : "";
  if(q("deviceSearch")) q("deviceSearch").value = d ? deviceLabel(d) : "";
  fillDeviceMeta();
}
function statusClass(v){ if(v==="Đã chuyển sửa chữa") return "green"; if(v==="Mới báo" || v==="Mới ghi nhận") return "yellow"; return "gray"; }

function normalizeIncidentStatus(status, linkedRepairId){
  const raw = String(status || "").trim();
  if(raw === "Đã chuyển sửa chữa" || raw === "Chuyển sửa chữa" || raw === "Chờ linh kiện") return "Đã chuyển sửa chữa";
  if(raw === "Đã xử lý tại chỗ" || raw === "Đã xử lý" || raw === "Đóng" || raw === "Không cần sửa chữa") return linkedRepairId ? "Đã chuyển sửa chữa" : "Mới báo";
  if(raw === "Mới báo" || raw === "Mới ghi nhận" || raw === "Đã ghi nhận" || raw === "Đang xử lý" || raw === "Theo dõi") return "Mới báo";
  const repairStatuses = ["Đang xử lý","Chờ linh kiện","Đã hoàn thành","Không sửa được","Mới tiếp nhận","Đang sửa chữa","Đang kiểm tra","Đã sửa xong","Bàn giao sử dụng","Hủy"];
  if(repairStatuses.includes(raw)) return linkedRepairId ? "Đã chuyển sửa chữa" : "Mới báo";
  return linkedRepairId ? "Đã chuyển sửa chữa" : "Mới báo";
}
function normalizeIncidentRow(r){ return { ...r, status: normalizeIncidentStatus(r.status, r.linked_repair_id) }; }
function fillDeviceMeta(){ const d=getDevice(q("deviceId").value); q("incidentDept").value=d?(d.department_name||d.department_code||""):""; q("incidentLocation").value=d?(d.location||""):""; }
function localDateTimeInputValue(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function resetIncidentForm(){
  q("incidentForm").reset();
  q("incidentId").value="";
  q("incidentFormTitle").textContent="Phiếu báo sự cố";
  q("saveIncidentBtn").textContent="Lưu sự cố";
  q("incidentTime").value = localDateTimeInputValue();
  q("status").value = "Mới báo";
  if(q("localResolutionNote")) q("localResolutionNote").value = "";
  toggleLocalResolutionField();
  if(!q("reporter").value) q("reporter").value = "Quản trị viên";
  fillDeviceMeta();
}

function incidentActions(r){
  const id = Number(r.id);
  const deviceId = Number(r.device_id);
  const actions = [`<button class="btn btn-secondary" onclick="openDeviceProfile(${deviceId})">Xem HS</button>`];
  if (r.status === "Mới báo" || r.status === "Mới ghi nhận") {
    actions.push(`<button class="btn btn-primary" onclick="transferToRepair(${id})">Chuyển SC</button>`);
  } else if (r.status === "Đã chuyển sửa chữa") {
    actions.push(`<button class="btn btn-primary" onclick="openLinkedRepair(${id})">Mở phiếu SC</button>`);
  }
  return actions.join("");
}

function renderIncidentStats(rows){
  const stat = st => rows.filter(r => r.status === st).length;
  if(q("stTotalIncidents")) q("stTotalIncidents").textContent = rows.length;
  if(q("stNewIncidents")) q("stNewIncidents").textContent = stat("Mới báo") + stat("Mới ghi nhận");
  if(q("stTransferIncidents")) q("stTransferIncidents").textContent = stat("Đã chuyển sửa chữa");
}
function toggleLocalResolutionField(){
  const show = false;
  const box = q("localResolutionField");
  if(box) box.style.display = show ? "flex" : "none";
  if(!show && q("localResolutionNote")) q("localResolutionNote").value = "";
}

function mediaCell(r){
  const files = Array.isArray(r.files) ? r.files : [];
  if (!files.length) return "";
  const img = files.find(f => String(f.file_mime||"").startsWith("image/"));
  const hasVideo = files.some(f => String(f.file_mime||"").startsWith("video/") || /\.(mp4|mov)$/i.test(f.original_name||""));
  const count = files.length;
  const thumb = img ? `<img class="media-thumb" src="${esc(img.file_path)}" alt="Ảnh sự cố" />` : "";
  const video = hasVideo ? `<span class="video-pill">Video</span>` : "";
  const more = count > 1 ? `<span class="media-count">+${count-1}</span>` : "";
  return `<button type="button" class="media-cell" onclick="openIncidentMedia(${Number(r.id)})">${thumb}${video}${more}</button>`;
}
function openIncidentMedia(id){
  const r = INCIDENT_ROWS.find(x => Number(x.id) === Number(id));
  const files = Array.isArray(r?.files) ? r.files : [];
  if (!files.length) return;
  q("mediaDialogBody").innerHTML = files.map(f => {
    const mime = String(f.file_mime||"");
    if (mime.startsWith("video/") || /\.(mp4|mov)$/i.test(f.original_name||"")) return `<div class="media-item"><video controls src="${esc(f.file_path)}"></video><a href="${esc(f.file_path)}" target="_blank">${esc(f.original_name||"Video")}</a></div>`;
    return `<div class="media-item"><img src="${esc(f.file_path)}" alt="Ảnh sự cố" /><a href="${esc(f.file_path)}" target="_blank">${esc(f.original_name||"Ảnh")}</a></div>`;
  }).join("");
  q("mediaDialog").showModal();
}
function validateMediaInput(){
  const input = q("incidentMedia");
  if(!input) return true;
  const files = Array.from(input.files || []);
  const images = files.filter(f => f.type.startsWith("image/"));
  const videos = files.filter(f => f.type.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name));
  if(images.length > 5){ alert("Chỉ được tải tối đa 5 ảnh."); return false; }
  if(videos.length > 1){ alert("Chỉ được tải tối đa 1 video."); return false; }
  if(images.some(f => f.size > 5*1024*1024)){ alert("Mỗi ảnh tối đa 5MB."); return false; }
  if(videos.some(f => f.size > 30*1024*1024)){ alert("Video tối đa 30MB."); return false; }
  return true;
}
function buildIncidentFormData(payload){
  const fd = new FormData();
  Object.entries(payload).forEach(([k,v]) => fd.append(k, v ?? ""));
  Array.from(q("incidentMedia")?.files || []).forEach(f => fd.append("media", f));
  return fd;
}
async function apiForm(url, options={}){
  const res = await fetch(url, options);
  if(!res.ok) throw new Error(await res.text());
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return text; }
}

function renderRows(rows){
  q("countLabel").textContent = `${rows.length} sự cố`;
  renderIncidentStats(rows);
  if(!rows.length){ q("rows").innerHTML = `<tr><td colspan="10" class="center-empty">Chưa có sự cố phù hợp.</td></tr>`; return; }
  q("rows").innerHTML = rows.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${formatDateTimeVN(r.incident_datetime)}</td>
      <td class="device-code">${esc(r.device_code || "")}</td>
      <td><b>${esc(r.device_name || "")}</b></td>
      <td>${esc(r.location || "")}</td>
      <td class="wrap-text">${esc(r.description || "")}</td>
      <td>${esc(r.reporter || "")}</td>
      <td><span class="tag ${statusClass(r.status)}">${esc(r.status === "Đã chuyển sửa chữa" ? "Đã chuyển SC" : (r.status || ""))}</span></td>
      <td>${mediaCell(r)}</td>
      <td><div class="table-actions compact-actions">${incidentActions(r)}</div></td>
    </tr>`).join("");
  const incidentScroll = document.querySelector(".incident-table-v2")?.closest(".scroll-area");
  if (incidentScroll) incidentScroll.scrollLeft = 0;
}
function applyFilter(){
  const text=norm(q("searchInput").value); const from=q("fromDate").value; const to=q("toDate").value; const dev=q("deviceFilter").value; const st=q("statusFilter").value;
  const rows=INCIDENT_ROWS.filter(r => inDateRange(String(r.incident_datetime||"").slice(0,10), from, to) && (dev==="ALL"||String(r.device_id)===dev) && (st==="ALL"||r.status===st) && (!text || norm([r.device_code,r.device_name,r.description,r.reporter,r.status,r.note].join(" ")).includes(text))).sort((a,b)=>String(b.incident_datetime||"").localeCompare(String(a.incident_datetime||"")) || Number(b.id)-Number(a.id));
  FILTERED_INCIDENTS=rows; renderRows(rows);
}
function clearFilters(){ q("searchInput").value=""; q("deviceFilter").value="ALL"; q("statusFilter").value="ALL"; setDefaultDateRange(); applyFilter(); }
function openDeviceProfile(id){ if(id) window.location.href = `/device-detail.html?id=${id}&from=tickets`; }
function editIncident(id){ const r=INCIDENT_ROWS.find(x=>Number(x.id)===Number(id)); if(!r) return; q("incidentId").value=r.id; setIncidentDevice(getDevice(r.device_id)); q("incidentTime").value=String(r.incident_datetime||"").replace(" ","T").slice(0,16); q("description").value=r.description||""; q("reporter").value=r.reporter||""; q("status").value=(r.status==="Đã chuyển sửa chữa"?"Đã chuyển sửa chữa":"Mới báo"); if(q("localResolutionNote")) q("localResolutionNote").value=r.local_resolution_note||""; if(q("reporterPhone")) q("reporterPhone").value=r.reporter_phone||""; q("note").value=r.note||""; q("incidentFormTitle").textContent="Cập nhật phiếu báo sự cố"; q("saveIncidentBtn").textContent="Cập nhật phiếu"; q("incidentForm").scrollIntoView({behavior:"smooth"}); }
async function deleteIncident(id){ if(!confirm("Xóa sự cố này?")) return; await api(`/api/incidents/${id}`, {method:"DELETE"}); await loadData(); }
async function transferToRepair(id){
  const r=INCIDENT_ROWS.find(x=>Number(x.id)===Number(id));
  if(!r) return;
  if(!confirm(`Tạo phiếu sửa chữa từ sự cố #${id}? Sau khi tạo, sự cố sẽ chuyển trạng thái “Đã chuyển sửa chữa”.`)) return;
  try {
    const res = await api(`/api/incidents/${id}/transfer-repair`, {method:"POST", body:JSON.stringify({actor:r.reporter||"Quản trị viên"})});
    if (res && res.repair_id) {
      window.location.href = `/maintenance.html?repair_id=${encodeURIComponent(res.repair_id)}&from=tickets`;
      return;
    }
    await loadData();
  } catch(e) { alert(e.message || "Không chuyển được sự cố sang sửa chữa."); }
}
async function markOnsite(id){
  const r=INCIDENT_ROWS.find(x=>Number(x.id)===Number(id));
  if(!r) return;
  const detail = prompt("Nhập nội dung xử lý tại chỗ (bắt buộc):\nVí dụ: Kiểm tra nguồn, bật lại CB điện, máy hoạt động bình thường.", r.local_resolution_note || "");
  if(detail === null) return;
  if(!detail.trim()) return alert("Vui lòng nhập nội dung xử lý tại chỗ.");
  const payload={...r, status:"Đã xử lý tại chỗ", local_resolution_note: detail.trim()};
  await api(`/api/incidents/${id}`, {method:"PUT", body:JSON.stringify(payload)});
  await loadData();
}
async function openLinkedRepair(id){
  const incident = INCIDENT_ROWS.find(x => Number(x.id) === Number(id));
  let repairId = incident?.linked_repair_id;
  if (!repairId) {
    const repairs = await api('/api/repairs');
    const repair = repairs.find(x => Number(x.incident_id || x.source_incident_id) === Number(id));
    repairId = repair?.id;
  }
  if (repairId) window.location.href = `/maintenance.html?repair_id=${encodeURIComponent(repairId)}&from=tickets`;
  else alert('Chưa tìm thấy phiếu sửa chữa liên kết.');
}
async function fetchIncidentRows(){
  const from = q("fromDate")?.value || "1900-01-01";
  const to = q("toDate")?.value || "2999-12-31";
  INCIDENT_ROWS = (await api(`/api/incidents?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}`)).map(normalizeIncidentRow);
}
async function saveIncident(e){
  e.preventDefault();
  const payload={
    device_id:Number(q("deviceId").value),
    incident_datetime:fromDateTimeLocalValue(q("incidentTime").value),
    description:q("description").value.trim(),
    severity:"Trung bình",
    reporter:(q("reporter").value.trim() || "Quản trị viên"),
    reporter_phone:(q("reporterPhone")?.value.trim() || ""),
    status:"Mới báo",
    note:q("note").value.trim(),
    local_resolution_note:(q("localResolutionNote") ? q("localResolutionNote").value.trim() : "")
  };
  if(!payload.device_id) return alert("Vui lòng chọn thiết bị.");
  if(!payload.incident_datetime) return alert("Vui lòng nhập thời gian báo.");
  if(!payload.description) return alert("Vui lòng nhập nội dung sự cố.");
  
  if(!validateMediaInput()) return;
  const id=q("incidentId").value;
  const formData = buildIncidentFormData(payload);
  try {
    const result = id
      ? await apiForm(`/api/incidents/${id}`, {method:"PUT", body:formData})
      : await apiForm("/api/incidents", {method:"POST", body:formData});

    // Bảo đảm bản ghi vừa tạo luôn nằm trong khoảng lọc hiện tại.
    const d = String(payload.incident_datetime).slice(0,10);
    if(q("fromDate").value && d < q("fromDate").value) q("fromDate").value = d;
    if(q("toDate").value && d > q("toDate").value) q("toDate").value = d;

    if (!id && result?.row) {
      INCIDENT_ROWS = [normalizeIncidentRow(result.row), ...INCIDENT_ROWS.filter(x => Number(x.id) !== Number(result.id))];
    } else {
      await fetchIncidentRows();
    }
    applyFilter();
    resetIncidentForm();
    alert(id ? "Đã cập nhật phiếu báo sự cố." : `Đã lưu phiếu báo sự cố${result?.id ? " #" + result.id : ""}. Bản ghi đã hiển thị trong bảng.`);
  } catch(err) {
    console.error("saveIncident error", err);
    alert(`Không lưu được sự cố: ${err.message || err}`);
  }
}
async function loadData(){
  DEVICES=await api("/api/devices");
  await fetchIncidentRows();
  q("deviceFilter").innerHTML=`<option value="ALL">Tất cả thiết bị</option>`+DEVICES.map(d=>`<option value="${d.id}">${esc(deviceLabel(d))}</option>`).join("");
  renderDeviceDatalist();
  const params = new URLSearchParams(window.location.search);
  const presetDeviceId = params.get("device_id");
  if (presetDeviceId) setIncidentDevice(getDevice(presetDeviceId));
  else fillDeviceMeta();
  applyFilter();
}
function exportIncidentsExcel(){
  exportA4Report('incidents', { fromId: 'fromDate', toId: 'toDate' });
}
document.addEventListener("DOMContentLoaded", async()=>{ setLayout("tickets","Sự cố","Khoa sử dụng báo hỏng, Khoa Trang bị chuyển sửa chữa khi cần"); setDefaultDateRange(); await loadData(); resetIncidentForm(); q("deviceSearch").addEventListener("input", () => { const d = resolveIncidentDevice(); if(d) setIncidentDevice(d); else { q("deviceId").value=""; fillDeviceMeta(); } });
  q("deviceSearch").addEventListener("change", () => { const d = resolveIncidentDevice(); if(d) setIncidentDevice(d); }); q("status").addEventListener("change", toggleLocalResolutionField); toggleLocalResolutionField(); q("incidentForm").addEventListener("submit", saveIncident); q("resetIncidentBtn").onclick=resetIncidentForm; q("newIncidentBtn").onclick=()=>q("incidentForm").scrollIntoView({behavior:"smooth"}); q("filterBtn").onclick=async()=>{ await fetchIncidentRows(); applyFilter(); }; q("clearFilterBtn").onclick=clearFilters; ["searchInput","deviceFilter","statusFilter"].forEach(id=>{ const el=q(id); el.addEventListener("input", applyFilter); el.addEventListener("change", applyFilter); });
  ["fromDate","toDate"].forEach(id=>{ const el=q(id); el.addEventListener("change", async()=>{ await fetchIncidentRows(); applyFilter(); }); }); q("exportIncidentExcelBtn").onclick=exportIncidentsExcel; });

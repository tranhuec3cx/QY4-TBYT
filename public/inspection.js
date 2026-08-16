let ROWS = [];
let FILTERED_MAINTS = [];
let DEVICES = [];
function esc(value){ return String(value ?? "").replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }
function norm(value){ return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function getDevice(id){ return DEVICES.find(d => Number(d.id) === Number(id)) || null; }
function deviceLabel(d){ return d ? `${d.device_code || d.serial || "TB-"+d.id} - ${d.name || ""}` : ""; }
function deviceSearchLabel(d){
  if(!d) return "";
  const extra = [d.model, d.serial].filter(Boolean).join(" • ");
  return `${d.device_code || d.serial || "TB-"+d.id} - ${d.name || ""}${extra ? " (" + extra + ")" : ""}`;
}
function resolveMaintDevice(){
  const v = String(q("deviceSearch")?.value || "").trim();
  if(!v){ q("deviceId").value = ""; fillMaintDeviceInfo(); return null; }
  const nv = norm(v);
  const found = DEVICES.find(d => deviceSearchLabel(d) === v)
    || DEVICES.find(d => norm([d.device_code,d.name,d.model,d.serial,d.insurance_code,d.department_code,d.department_name].join(" ")).includes(nv));
  q("deviceId").value = found ? found.id : "";
  fillMaintDeviceInfo();
  return found;
}
function setMaintDevice(deviceId){
  const d = getDevice(deviceId);
  q("deviceId").value = d ? d.id : "";
  if(q("deviceSearch")) q("deviceSearch").value = d ? deviceSearchLabel(d) : "";
  fillMaintDeviceInfo();
}
function fillMaintDeviceInfo(){ const d=getDevice(q("deviceId").value); q("maintDept").value=d?(d.department_name||d.department_code||""):""; q("maintLocation").value=d?(d.location||""):""; }
function resetForm(){ q("form").reset(); q("maintId").value=""; q("deviceId").value=""; if(q("deviceSearch")) q("deviceSearch").value=""; q("formTitle").textContent="Phiếu bảo dưỡng"; q("saveMaintBtn").textContent="Lưu bảo dưỡng"; q("fileHint").textContent="Chọn tệp nếu có biên bản hoặc ảnh hiện trạng."; fillMaintDeviceInfo(); }
function resultClass(v){ if(v==="Đạt") return "green"; if(v==="Đạt có lưu ý" || v==="Cần theo dõi thêm") return "yellow"; return "red"; }
function fileCell(r){
  if(!r.file_path) return "";
  const name = r.original_name || r.stored_name || String(r.file_path).split("/").pop() || "Tệp đính kèm";
  return `<a class="btn btn-secondary btn-sm" href="${esc(r.file_path)}" target="_blank" rel="noopener">Tải file</a><div class="small file-name-line">${esc(name)}</div>`;
}
function renderRows(data){ q("countLabel").textContent=`${data.length} bản ghi`; if(!data.length){ q("rows").innerHTML=`<tr><td colspan="13" class="center-empty">Chưa có bản ghi bảo dưỡng phù hợp.</td></tr>`; return; } q("rows").innerHTML=data.map((r,i)=>`<tr><td>${i+1}</td><td>${formatDateTimeVN(r.maintenance_date)}</td><td class="device-code">${esc(r.device_code||"")}</td><td><b>${esc(r.device_name||"")}</b></td><td class="code-only">${esc(r.department_code||r.department_name||"")}</td><td>${esc(r.type||"")}</td><td class="wrap-text">${esc(r.content||"")}</td><td><span class="tag ${resultClass(r.result)}">${esc(r.result||"")}</span></td><td>${esc(r.performer||"")}</td><td>${esc(r.vendor||"")}</td><td>${formatDateVN(r.next_date)}</td><td>${fileCell(r)}</td><td><div class="table-actions compact-actions"><button class="btn btn-secondary" onclick="openDeviceProfile(${Number(r.device_id)})">Xem</button><button class="btn" onclick="editMaint(${Number(r.id)})">Cập nhật</button><button class="btn btn-danger" onclick="deleteMaint(${Number(r.id)})">Hủy</button></div></td></tr>`).join(""); }
function applyFilter(){ const text=norm(q("searchInput").value); const device=q("deviceFilter").value; const type=q("typeFilter").value; const vendor=q("vendorFilter").value; const from=q("fromDate").value; const to=q("toDate").value; const data=ROWS.filter(r=>inDateRange(r.maintenance_date,from,to)&&(device==="ALL"||String(r.device_id)===device)&&(type==="ALL"||r.type===type)&&(vendor==="ALL"||(r.vendor||"")===vendor)&&(!text||norm([r.device_code,r.device_name,r.type,r.content,r.performer,r.vendor,r.result].join(" ")).includes(text))).sort((a,b)=>String(b.maintenance_date||"").localeCompare(String(a.maintenance_date||""))||Number(b.id)-Number(a.id)); FILTERED_MAINTS=data; renderRows(data); }
function clearFilters(){ q("searchInput").value=""; q("deviceFilter").value="ALL"; q("typeFilter").value="ALL"; q("vendorFilter").value="ALL"; setDefaultDateRange(); applyFilter(); }
function openDeviceProfile(id){ if(id) window.open(`/device-detail.html?id=${id}`,"_blank"); }
function editMaint(id){ const r=ROWS.find(x=>Number(x.id)===Number(id)); if(!r) return; q("maintId").value=r.id; setMaintDevice(r.device_id); q("date").value=toDateTimeLocalValue(r.maintenance_date||""); q("type").value=(r.type==="Đột xuất"?"Đột xuất":"Định kỳ"); q("content").value=r.content||""; q("result").value=r.result||"Đạt"; q("performer").value=r.performer||""; q("userConfirm").value=r.user_confirm||""; q("vendor").value=r.vendor||""; q("nextDate").value=r.next_date||""; q("note").value=r.note||""; q("file").value=""; q("fileHint").textContent=r.original_name?`File hiện tại: ${r.original_name}. Chọn tệp mới nếu muốn thay thế.`:"Chọn tệp nếu muốn đính kèm."; q("formTitle").textContent="Cập nhật phiếu bảo dưỡng"; q("saveMaintBtn").textContent="Cập nhật bảo dưỡng"; q("form").scrollIntoView({behavior:"smooth"}); }
async function deleteMaint(id){
  const reason = prompt("Nhập lý do hủy bản ghi bảo dưỡng:", "Nhập nhầm / không còn áp dụng");
  if(reason === null) return;
  if(!reason.trim()) return alert("Vui lòng nhập lý do hủy.");
  await api(`/api/maintenances/${id}`,{method:"DELETE",body:JSON.stringify({reason:reason.trim()})});
  await loadData();
}
async function saveMaint(e){ e.preventDefault(); if(!q("deviceId").value) return alert("Vui lòng chọn thiết bị."); if(!q("date").value) return alert("Vui lòng nhập thời gian bảo dưỡng."); if(!q("content").value.trim()) return alert("Vui lòng nhập nội dung bảo dưỡng."); const fd=new FormData(); fd.append("device_id", q("deviceId").value); fd.append("maintenance_date", fromDateTimeLocalValue(q("date").value)); fd.append("type", q("type").value); fd.append("content", q("content").value.trim()); fd.append("result", q("result").value); fd.append("performer", q("performer").value.trim()); fd.append("user_confirm", q("userConfirm").value.trim()); fd.append("vendor", q("vendor").value.trim()); fd.append("next_date", q("nextDate").value); fd.append("note", q("note").value.trim()); if(q("file").files[0]) fd.append("file", q("file").files[0]); const id=q("maintId").value; const res=await fetch(id?`/api/maintenances/${id}`:"/api/maintenances", {method:id?"PUT":"POST", body:fd}); if(!res.ok) return alert(await res.text()); resetForm(); await loadData(); }

function exportMaintExcel(){
  exportA4Report('maintenances', { fromId: 'fromDate', toId: 'toDate' });
}

async function loadData(){ DEVICES=await api("/api/devices"); ROWS=await api("/api/maintenances"); q("deviceFilter").innerHTML=`<option value="ALL">Tất cả thiết bị</option>`+DEVICES.map(d=>`<option value="${d.id}">${esc(deviceLabel(d))}</option>`).join(""); if(q("maintDeviceOptions")) q("maintDeviceOptions").innerHTML=DEVICES.map(d=>`<option value="${esc(deviceSearchLabel(d))}"></option>`).join(""); const vendors=[...new Set(ROWS.map(r=>r.vendor).filter(Boolean))].sort(); q("vendorFilter").innerHTML=`<option value="ALL">Tất cả đơn vị</option>`+vendors.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(""); fillMaintDeviceInfo(); applyFilter(); }
document.addEventListener("DOMContentLoaded", async()=>{ setLayout("inspection","Bảo dưỡng","Ghi nhận bảo dưỡng định kỳ/đột xuất và file biên bản"); setDefaultDateRange(); await loadData(); resetForm(); q("deviceSearch")?.addEventListener("input", resolveMaintDevice); q("deviceSearch")?.addEventListener("change", resolveMaintDevice); q("form").addEventListener("submit",saveMaint); q("resetBtn2").onclick=resetForm; q("filterBtn").onclick=applyFilter; q("clearFilterBtn").onclick=clearFilters; q("exportMaintBtn").onclick=exportMaintExcel; if(q("addMaintTopBtn")) q("addMaintTopBtn").onclick=()=>{ resetForm(); q("form").scrollIntoView({behavior:"smooth", block:"start"}); setTimeout(()=>q("deviceSearch")?.focus(),250); }; ["searchInput","fromDate","toDate","deviceFilter","typeFilter","vendorFilter"].forEach(id=>{const el=q(id); el.addEventListener("input",applyFilter); el.addEventListener("change",applyFilter);}); q("file").addEventListener("change",()=>{q("fileHint").textContent=q("file").files[0]?`Đã chọn: ${q("file").files[0].name}`:"Chọn tệp nếu có biên bản hoặc ảnh hiện trạng.";}); });

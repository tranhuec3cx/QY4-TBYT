let QR_DEVICE = null;
function getParam(name){ return new URLSearchParams(window.location.search).get(name); }
function qrEsc(v){ return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch])); }
function latestLabel(row, dateField, emptyText){
  if(!row) return emptyText;
  const d = row[dateField] || row.next_date || "";
  const detail = [row.type, row.result].filter(Boolean).join(" - ");
  return `${formatDateTimeVN(d) || formatDateVN(d)}${detail ? ` (${qrEsc(detail)})` : ""}`;
}
function renderDevice(){
  const d = QR_DEVICE;
  q("deviceCard").innerHTML = `
    <div class="qr-device-title-row">
      <div class="qr-device-icon">▣</div>
      <div><h2>${qrEsc(d.name)}</h2><p>${qrEsc(d.device_code)}</p></div>
    </div>
    <div class="qr-info-list">
      <div><span>Khoa sử dụng</span><b>${qrEsc(d.department_name || d.department_code || "—")}</b></div>
      <div><span>Vị trí</span><b>${qrEsc(d.location || "—")}</b></div>
      <div><span>Hãng / Model</span><b>${qrEsc([d.manufacturer, d.model].filter(Boolean).join(" - ") || "—")}</b></div>
      <div><span>Serial</span><b>${qrEsc(d.serial || "—")}</b></div>
      <div><span>Tình trạng</span><b><span class="tag ${statusTagClass(d.status)}">${qrEsc(d.status || "—")}</span></b></div>
      <div><span>Bảo dưỡng gần nhất</span><b>${latestLabel(d.latest_maintenance, "maintenance_date", "Chưa có dữ liệu")}</b></div>
      <div><span>Kiểm định gần nhất</span><b>${latestLabel(d.latest_inspection, "inspection_date", "Chưa có dữ liệu")}</b></div>
      <div><span>Phiếu sửa chữa mở</span><b>${d.open_repair ? `#${d.open_repair.id} - ${qrEsc(d.open_repair.processing_status)}` : "Không có"}</b></div>
    </div>
  `;
}
async function loadQrDevice(){
  const id = getParam("device_id");
  const code = getParam("code");
  if(!id && !code){ q("deviceCard").innerHTML = '<div class="center-empty">Thiếu mã thiết bị trên đường dẫn QR.</div>'; return; }
  QR_DEVICE = await api(id ? `/api/qr/device/${encodeURIComponent(id)}` : `/api/qr/device-code/${encodeURIComponent(code)}`);
  renderDevice();
}
function conditionValue(){ return document.querySelector('input[name="condition"]:checked')?.value || "Bình thường"; }
function updateCheckFormState(){
  const st = conditionValue();
  const isIssue = st === "Có vấn đề";
  const desc = q("checkDescription");
  const issueBox = q("issueFields");
  if(issueBox) issueBox.style.display = isIssue ? "block" : "none";
  if(desc){ desc.required = isIssue; if(!isIssue) desc.value = ""; }
}
function validateQrFiles(){
  const fileEl = q("checkFile");
  const files = Array.from(fileEl?.files || []);
  const images = files.filter(f => f.type.startsWith("image/"));
  const videos = files.filter(f => f.type.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name));
  if(images.length > 5){ alert("Chỉ được tải tối đa 5 ảnh."); return false; }
  if(videos.length > 1){ alert("Chỉ được tải tối đa 1 video."); return false; }
  if(images.some(f => f.size > 5*1024*1024)){ alert("Mỗi ảnh tối đa 5MB."); return false; }
  if(videos.some(f => f.size > 30*1024*1024)){ alert("Video tối đa 30MB."); return false; }
  return true;
}
async function sendMultipart(url, fields, fileInputId){
  const fd = new FormData();
  Object.entries(fields).forEach(([k,v]) => fd.append(k, v ?? ""));
  const fileEl = q(fileInputId);
  Array.from(fileEl?.files || []).forEach(f => fd.append("media", f));
  const res = await fetch(url, { method:"POST", body: fd });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function submitCheck(e){
  e.preventDefault();
  if(!QR_DEVICE) return;
  const condition = conditionValue();
  const description = q("checkDescription").value.trim();
  if(condition === "Có vấn đề" && !description){ alert("Vui lòng nhập mô tả vấn đề."); return; }
  if(!validateQrFiles()) return;
  const result = await sendMultipart("/api/qr/checks", {
    device_id: QR_DEVICE.id,
    inspector: q("inspectorInput").value.trim(),
    reporter_phone: q("phoneInput")?.value.trim() || "",
    condition,
    description,
    note: q("checkNote").value.trim(),
    severity: "Trung bình",
    create_incident: condition === "Có vấn đề" ? "1" : "0"
  }, "checkFile");
  alert(result.incident_id ? "Đã lưu kiểm tra và tạo sự cố." : "Đã lưu kết quả kiểm tra bình thường.");
  q("checkForm").reset();
  updateCheckFormState();
  await loadQrDevice();
}
document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll('input[name="condition"]').forEach(x => x.addEventListener("change", updateCheckFormState));
  q("checkForm").addEventListener("submit", submitCheck);
  updateCheckFormState();
  try { await loadQrDevice(); } catch(e){ q("deviceCard").innerHTML = `<div class="center-empty">${qrEsc(e.message || e)}</div>`; }
});

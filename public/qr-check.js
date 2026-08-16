let QR_DEVICE = null;
let QR_AUTH = null;

function getParam(name){ return new URLSearchParams(window.location.search).get(name); }
function qrEsc(v){ return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch])); }
function hideQrForm(){ const form=q("checkForm"); if(form) form.style.display="none"; }
function showQrError(message){ q("deviceCard").innerHTML = `<div class="center-empty">${qrEsc(message)}</div>`; hideQrForm(); }

function renderDevice(){
  const d = QR_DEVICE;
  q("deviceCard").innerHTML = `
    <div class="qr-device-title-row">
      <div class="qr-device-icon">▣</div>
      <div><h2>${qrEsc(d.name)}</h2><p>${qrEsc(d.device_code || "—")}</p></div>
    </div>
    <div class="qr-info-list">
      <div><span>Khoa sử dụng</span><b>${qrEsc(d.department_name || d.department_code || "—")}</b></div>
      <div><span>Vị trí</span><b>${qrEsc(d.location || "—")}</b></div>
      <div><span>Model</span><b>${qrEsc(d.model || "—")}</b></div>
      <div><span>Tình trạng</span><b><span class="tag ${statusTagClass(d.status)}">${qrEsc(d.status || "—")}</span></b></div>
      <div><span>Xác thực QR</span><b><span class="tag green">Hợp lệ</span></b></div>
    </div>
  `;
}

async function loadQrDevice(){
  const id = getParam("id") || getParam("device_id");
  const code = getParam("code") || getParam("device_code");
  const token = getParam("token") || getParam("t");
  if(!id && !code){ showQrError("Thiếu mã thiết bị trên đường dẫn QR."); return; }
  if(!token){ showQrError("Mã QR chưa có chữ ký bảo mật hoặc là nhãn cũ. Vui lòng liên hệ Khoa Trang bị để in lại QR."); return; }

  const kind = id ? "id" : "code";
  const key = String(id || code);
  QR_AUTH = { kind, key, token: String(token) };
  const endpoint = id
    ? `/api/public/device/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`
    : `/api/public/device-code/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`;
  QR_DEVICE = await api(endpoint);
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
  if(!QR_DEVICE || !QR_AUTH) return;
  const condition = conditionValue();
  const description = q("checkDescription").value.trim();
  if(condition === "Có vấn đề" && !description){ alert("Vui lòng nhập mô tả vấn đề."); return; }
  if(!validateQrFiles()) return;
  const query = new URLSearchParams({ qr_kind: QR_AUTH.kind, qr_key: QR_AUTH.key, token: QR_AUTH.token });
  const result = await sendMultipart(`/api/qr/checks?${query.toString()}`, {
    // Chỉ giữ device_id để tương thích; backend P7 lấy ID tin cậy từ chữ ký QR.
    device_id: QR_DEVICE.id,
    inspector: q("inspectorInput").value.trim().slice(0,120),
    reporter_phone: q("phoneInput")?.value.trim().slice(0,40) || "",
    condition,
    description: description.slice(0,2000),
    note: q("checkNote").value.trim().slice(0,2000),
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
  try { await loadQrDevice(); } catch(e){ showQrError(e.message || e); }
});

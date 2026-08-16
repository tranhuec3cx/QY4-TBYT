let PUBLIC_DEVICE = null;

function publicParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function publicEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
}
function publicCondition() {
  return document.querySelector('input[name="publicCondition"]:checked')?.value || "Bình thường";
}
function renderPublicDevice() {
  const d = PUBLIC_DEVICE;
  q("publicDeviceCard").innerHTML = `
    <div class="public-device-top">
      <div>
        <div class="public-label">THÔNG TIN THIẾT BỊ</div>
        <h1>${publicEsc(d.name)}</h1>
        <span class="tag ${statusTagClass(d.status)}">${publicEsc(d.status || "—")}</span>
      </div>
    </div>
    <div class="public-info-grid">
      <div><span>Mã thiết bị</span><b>${publicEsc(d.device_code || "—")}</b></div>
      <div><span>Khoa/Phòng</span><b>${publicEsc(d.department_name || "—")}</b></div>
      <div><span>Vị trí</span><b>${publicEsc(d.location || "—")}</b></div>
      <div><span>Model</span><b>${publicEsc(d.model || "—")}</b></div>
    </div>
  `;
}
async function loadPublicDevice() {
  const id = publicParam("id") || publicParam("device_id");
  if (!id) {
    q("publicDeviceCard").innerHTML = '<div class="center-empty">Thiếu mã thiết bị trên đường dẫn QR.</div>';
    q("publicCheckForm").style.display = "none";
    return;
  }
  PUBLIC_DEVICE = await api(`/api/public/device/${encodeURIComponent(id)}`);
  renderPublicDevice();
}
function updatePublicForm() {
  const isIssue = publicCondition() === "Có vấn đề";
  const box = q("publicIssueFields");
  const desc = q("publicDescription");
  if (box) box.style.display = isIssue ? "block" : "none";
  if (desc) {
    desc.required = isIssue;
    if (!isIssue) desc.value = "";
  }
}
function validatePublicMedia() {
  const files = Array.from(q("publicMedia")?.files || []);
  const images = files.filter(f => f.type.startsWith("image/"));
  const videos = files.filter(f => f.type.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name));
  if (images.length > 5) { alert("Chỉ được tải tối đa 5 ảnh."); return false; }
  if (videos.length > 1) { alert("Chỉ được tải tối đa 1 video."); return false; }
  if (images.some(f => f.size > 5 * 1024 * 1024)) { alert("Mỗi ảnh tối đa 5MB."); return false; }
  if (videos.some(f => f.size > 30 * 1024 * 1024)) { alert("Video tối đa 30MB."); return false; }
  return true;
}
async function postPublicCheck(e) {
  e.preventDefault();
  if (!PUBLIC_DEVICE) return;
  const condition = publicCondition();
  const description = q("publicDescription").value.trim();
  if (condition === "Có vấn đề" && !description) {
    alert("Vui lòng nhập mô tả sự cố.");
    return;
  }
  if (!validatePublicMedia()) return;

  const btn = q("publicSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Đang gửi...";
  try {
    const fd = new FormData();
    fd.append("device_id", PUBLIC_DEVICE.id);
    fd.append("inspector", q("publicInspector").value.trim());
    fd.append("reporter_phone", q("publicPhone").value.trim());
    fd.append("condition", condition);
    fd.append("description", description);
    fd.append("note", q("publicNote").value.trim());
    fd.append("severity", "Trung bình");
    fd.append("create_incident", condition === "Có vấn đề" ? "1" : "0");
    Array.from(q("publicMedia")?.files || []).forEach(f => fd.append("media", f));

    const res = await fetch("/api/qr/checks", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    q("publicCheckForm").innerHTML = `
      <div class="public-success">
        <h2>✓ Đã gửi thành công</h2>
        <p>${data.incident_id ? "Thông tin sự cố đã được gửi về Khoa Trang bị." : "Kết quả kiểm tra bình thường đã được lưu."}</p>
      </div>
    `;
  } catch (err) {
    alert(err.message || err);
    btn.disabled = false;
    btn.textContent = "Gửi kết quả kiểm tra";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll('input[name="publicCondition"]').forEach(el => el.addEventListener("change", updatePublicForm));
  q("publicCheckForm").addEventListener("submit", postPublicCheck);
  updatePublicForm();
  try { await loadPublicDevice(); } catch (err) {
    q("publicDeviceCard").innerHTML = `<div class="center-empty">${publicEsc(err.message || err)}</div>`;
    q("publicCheckForm").style.display = "none";
  }
});

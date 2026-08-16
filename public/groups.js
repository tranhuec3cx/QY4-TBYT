
let GROUPS = [];
function resetForm() {
  q("form").reset();
  q("originalCode").value = "";
}
function render() {
  const qText = q("searchInput").value.trim().toLowerCase();
  const data = GROUPS.filter(x => !qText || [x.code, x.name].join(" ").toLowerCase().includes(qText));
  q("countLabel").textContent = `${data.length} nhóm thiết bị`;
  q("rows").innerHTML = data.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="device-code">${x.code}</td>
      <td>${x.name}</td>
      <td>${x.device_count || 0}</td>
      <td>
        <div class="table-actions">
          <button class="btn" onclick="editRow('${x.code}')">Cập nhật</button>
          <button class="btn btn-danger" onclick="deleteRow('${x.code}')">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="center-empty">Chưa có dữ liệu.</td></tr>';
}
function editRow(code) {
  const x = GROUPS.find(r => r.code === code);
  if (!x) return;
  q("originalCode").value = x.code;
  q("code").value = x.code;
  q("name").value = x.name;
  window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
}
async function deleteRow(code) {
  if (!confirm("Xóa nhóm thiết bị này?")) return;
  try {
    await api(`/api/device-groups/${encodeURIComponent(code)}`, { method: "DELETE" });
    await loadData();
  } catch (e) {
    alert("Không thể xóa. Có thể nhóm thiết bị đang được sử dụng.");
  }
}
async function loadData() {
  GROUPS = await api("/api/device-groups");
  render();
}
document.addEventListener("DOMContentLoaded", async () => {
  setLayout("groups", "Danh mục nhóm thiết bị", "Quản lý danh mục nhóm thiết bị để dùng cho mã thiết bị, bộ lọc và hồ sơ máy");
  await loadData();
  q("filterBtn").onclick = render;
  q("searchInput").addEventListener("input", render);
  q("resetBtn").onclick = resetForm;
  q("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const original = q("originalCode").value.trim();
    const payload = { code: q("code").value.trim().toUpperCase(), name: q("name").value.trim() };
    try {
      if (original) await api(`/api/device-groups/${encodeURIComponent(original)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/device-groups", { method: "POST", body: JSON.stringify(payload) });
      resetForm();
      await loadData();
      alert("Đã lưu nhóm thiết bị.");
    } catch (e) {
      alert("Không lưu được. Mã nhóm có thể bị trùng hoặc dữ liệu chưa hợp lệ.");
    }
  });
});

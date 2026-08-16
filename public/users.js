
let META = { departments: [] };
let USERS = [];
function render() {
  const qText = q("searchInput").value.trim().toLowerCase();
  const data = USERS.filter(u => !qText || [u.full_name, u.username, u.role, u.department_name || "", u.phone || ""].join(" ").toLowerCase().includes(qText));
  q("countLabel").textContent = `${data.length} người dùng`;
  q("rows").innerHTML = data.map((u,i) => `<tr><td>${i+1}</td><td>${u.full_name}</td><td>${u.username}</td><td>${u.role}</td><td>${u.department_name || ""}</td><td>${u.phone || ""}</td><td><span class="tag ${u.status === 'Hoạt động' ? 'green' : 'red'}">${u.status}</span></td><td><div class="actions"><button class="icon-btn" title="Cấp lại mật khẩu" onclick="resetPassword(${u.id})">🔑</button><button class="icon-btn" title="Cập nhật" onclick="editUser(${u.id})">✏️</button><button class="icon-btn" title="Xóa" onclick="deleteUser(${u.id})">🗑️</button></div></td></tr>`).join("");
}
function editUser(id) {
  const u = USERS.find(x => x.id === id);
  q("userId").value = u.id;
  q("fullName").value = u.full_name;
  q("username").value = u.username;
  q("role").value = u.role;
  q("departmentCode").value = u.department_code || "";
  q("phone").value = u.phone || "";
  q("status").value = u.status || "Hoạt động";
}
function resetForm() {
  q("userForm").reset();
  q("userId").value = "";
}
async function resetPassword(id) {
  const u = USERS.find(x => Number(x.id) === Number(id));
  if (!u) return;
  const value = prompt(`Cấp lại mật khẩu cho ${u.full_name} (${u.username}).\n\nNhập mật khẩu tạm thời tối thiểu 10 ký tự, hoặc để trống để hệ thống tự sinh:`, "");
  if (value === null) return;
  if (value && value.length < 10) return alert("Mật khẩu tạm thời phải có ít nhất 10 ký tự.");
  const result = await api(`/api/auth/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password: value }) });
  if (result.temporary_password) {
    alert(`Đã cấp lại mật khẩu.\n\nTài khoản: ${result.username}\nMật khẩu tạm thời: ${result.temporary_password}\n\nHãy chuyển mật khẩu này trực tiếp cho người dùng. Hệ thống sẽ bắt buộc đổi sau lần đăng nhập đầu.`);
  } else {
    alert("Đã đặt mật khẩu tạm thời. Người dùng sẽ phải đổi mật khẩu sau lần đăng nhập tiếp theo.");
  }
}
async function deleteUser(id) {
  if (!confirm("Xóa người dùng này?")) return;
  await api(`/api/users/${id}`, { method: "DELETE" });
  await loadData();
}
async function loadData() {
  META = await api("/api/meta");
  USERS = await api("/api/users");
  q("departmentCode").innerHTML = opt(META.departments);
  render();
}
document.addEventListener("DOMContentLoaded", async () => {
  setLayout("users","Người dùng","Danh sách tài khoản sử dụng phần mềm quản lý trang thiết bị y tế");
  await loadData();
  q("filterBtn").onclick = render;
  q("searchInput").addEventListener("input", render);
  q("userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      full_name: q("fullName").value.trim(),
      username: q("username").value.trim(),
      role: q("role").value,
      department_code: q("departmentCode").value,
      phone: q("phone").value.trim(),
      status: q("status").value
    };
    const id = q("userId").value;
    if (id) await api(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(`/api/users`, { method: "POST", body: JSON.stringify(payload) });
    resetForm();
    await loadData();
    alert("Đã lưu người dùng. Nếu là tài khoản mới, hãy bấm biểu tượng 🔑 để cấp mật khẩu tạm thời.");
  });
});

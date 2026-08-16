
let META = { departments: [] };
let USERS = [];
function render() {
  const qText = q("searchInput").value.trim().toLowerCase();
  const data = USERS.filter(u => !qText || [u.full_name, u.username, u.role, u.department_name || "", u.phone || ""].join(" ").toLowerCase().includes(qText));
  q("countLabel").textContent = `${data.length} người dùng`;
  q("rows").innerHTML = data.map((u,i) => `<tr><td>${i+1}</td><td>${u.full_name}</td><td>${u.username}</td><td>${u.role}</td><td>${u.department_name || ""}</td><td>${u.phone || ""}</td><td><span class="tag ${u.status === 'Hoạt động' ? 'green' : 'red'}">${u.status}</span></td><td><div class="actions"><button class="icon-btn" onclick="editUser(${u.id})">✏️</button><button class="icon-btn" onclick="deleteUser(${u.id})">🗑️</button></div></td></tr>`).join("");
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
    alert("Đã lưu người dùng.");
  });
});

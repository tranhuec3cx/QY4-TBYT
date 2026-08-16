
let DEPARTMENTS = [];
let GROUPS = [];

function resetDeptForm() {
  q("deptForm").reset();
  q("deptOriginalCode").value = "";
}
function resetGroupForm() {
  q("groupForm").reset();
  q("groupOriginalCode").value = "";
}
function renderDepartments() {
  const qText = q("deptSearch").value.trim().toLowerCase();
  const data = DEPARTMENTS.filter(x => !qText || [x.code, x.name].join(" ").toLowerCase().includes(qText));
  q("deptRows").innerHTML = data.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="device-code">${x.code}</td>
      <td>${x.name}</td>
      <td>${x.device_count || 0}</td>
      <td>
        <div class="table-actions">
          <button class="btn" onclick="editDept('${x.code}')">Cập nhật</button>
          <button class="btn btn-danger" onclick="deleteDept('${x.code}')">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="center-empty">Chưa có dữ liệu.</td></tr>';
}
function renderGroups() {
  const qText = q("groupSearch").value.trim().toLowerCase();
  const data = GROUPS.filter(x => !qText || [x.code, x.name].join(" ").toLowerCase().includes(qText));
  q("groupRows").innerHTML = data.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="device-code">${x.code}</td>
      <td>${x.name}</td>
      <td>${x.device_count || 0}</td>
      <td>
        <div class="table-actions">
          <button class="btn" onclick="editGroup('${x.code}')">Cập nhật</button>
          <button class="btn btn-danger" onclick="deleteGroup('${x.code}')">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="center-empty">Chưa có dữ liệu.</td></tr>';
}
function editDept(code) {
  const x = DEPARTMENTS.find(r => r.code === code);
  if (!x) return;
  q("deptOriginalCode").value = x.code;
  q("deptCode").value = x.code;
  q("deptName").value = x.name;
}
function editGroup(code) {
  const x = GROUPS.find(r => r.code === code);
  if (!x) return;
  q("groupOriginalCode").value = x.code;
  q("groupCode").value = x.code;
  q("groupName").value = x.name;
}
async function deleteDept(code) {
  if (!confirm("Xóa khoa/phòng này?")) return;
  try {
    await api(`/api/departments/${encodeURIComponent(code)}`, { method: "DELETE" });
    await loadData();
  } catch (e) {
    alert("Không thể xóa. Có thể khoa/phòng đang được sử dụng.");
  }
}
async function deleteGroup(code) {
  if (!confirm("Xóa nhóm thiết bị này?")) return;
  try {
    await api(`/api/device-groups/${encodeURIComponent(code)}`, { method: "DELETE" });
    await loadData();
  } catch (e) {
    alert("Không thể xóa. Có thể nhóm thiết bị đang được sử dụng.");
  }
}
async function loadData() {
  DEPARTMENTS = await api("/api/departments");
  GROUPS = await api("/api/device-groups");
  renderDepartments();
  renderGroups();
}
document.addEventListener("DOMContentLoaded", async () => {
  setLayout("settings", "Danh mục dùng chung", "", "categories");
  await loadData();

  q("deptFilterBtn").onclick = renderDepartments;
  q("groupFilterBtn").onclick = renderGroups;
  q("deptSearch").addEventListener("input", renderDepartments);
  q("groupSearch").addEventListener("input", renderGroups);
  q("deptResetBtn").onclick = resetDeptForm;
  q("groupResetBtn").onclick = resetGroupForm;

  q("deptForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const original = q("deptOriginalCode").value.trim();
    const payload = { code: q("deptCode").value.trim().toUpperCase(), name: q("deptName").value.trim() };
    try {
      if (original) await api(`/api/departments/${encodeURIComponent(original)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/departments", { method: "POST", body: JSON.stringify(payload) });
      resetDeptForm();
      await loadData();
      alert("Đã lưu khoa/phòng.");
    } catch (e) {
      alert("Không lưu được. Mã khoa có thể bị trùng hoặc dữ liệu chưa hợp lệ.");
    }
  });

  q("groupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const original = q("groupOriginalCode").value.trim();
    const payload = { code: q("groupCode").value.trim().toUpperCase(), name: q("groupName").value.trim() };
    try {
      if (original) await api(`/api/device-groups/${encodeURIComponent(original)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/device-groups", { method: "POST", body: JSON.stringify(payload) });
      resetGroupForm();
      await loadData();
      alert("Đã lưu nhóm thiết bị.");
    } catch (e) {
      alert("Không lưu được. Mã nhóm có thể bị trùng hoặc dữ liệu chưa hợp lệ.");
    }
  });
});

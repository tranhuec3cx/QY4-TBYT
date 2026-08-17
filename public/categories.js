let DEPARTMENTS = [];
let GROUPS = [];
let USERS = [];
let CURRENT_USER = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function isAdminUser(user) { return /quản trị/i.test(String(user?.role || '')); }
function isSettingsUser(user) { return isAdminUser(user) || /kỹ|ky|trang bị|ttbyt/i.test(String(user?.role || '')); }
function escapeRegex(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cleanDepartmentName(code, name) {
  const c = String(code || '').trim();
  let n = String(name || '').trim();
  if (!c || !n) return n;
  n = n.replace(new RegExp(`^${escapeRegex(c)}\\s*[-–—:]\\s*`, 'i'), '').trim();
  return n || String(name || '').trim();
}
function departmentLabel(code, name) {
  const c = String(code || '').trim();
  const n = cleanDepartmentName(c, name);
  return c && n ? `${c} - ${n}` : (n || c);
}
function formatLastLogin(value) {
  if (!value) return '—';
  try { return formatDateTimeVN(String(value)); } catch { return String(value); }
}

function resetDeptForm() {
  q('deptForm').reset();
  q('deptOriginalCode').value = '';
}
function resetGroupForm() {
  q('groupForm').reset();
  q('groupOriginalCode').value = '';
}
function resetUserForm() {
  q('userForm')?.reset();
  if (q('userId')) q('userId').value = '';
  if (q('userStatus')) q('userStatus').value = 'Hoạt động';
  if (q('initialPasswordField')) q('initialPasswordField').classList.remove('hidden');
  syncUserDepartmentRequirement();
}

function renderDepartments() {
  const qText = q('deptSearch').value.trim().toLowerCase();
  const data = DEPARTMENTS.filter(x => !qText || [x.code, x.name].join(' ').toLowerCase().includes(qText));
  q('deptRows').innerHTML = data.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="device-code">${esc(x.code)}</td>
      <td>${esc(departmentLabel(x.code, x.name))}</td>
      <td class="center-number">${Number(x.device_count || 0)}</td>
      <td><div class="table-actions"><button class="btn" type="button" onclick="editDept('${esc(x.code)}')">Cập nhật</button><button class="btn btn-danger" type="button" onclick="deleteDept('${esc(x.code)}')">Xóa</button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="center-empty">Chưa có dữ liệu.</td></tr>';
}
function renderGroups() {
  const qText = q('groupSearch').value.trim().toLowerCase();
  const data = GROUPS.filter(x => !qText || [x.code, x.name].join(' ').toLowerCase().includes(qText));
  q('groupRows').innerHTML = data.map((x,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="device-code">${esc(x.code)}</td>
      <td>${esc(x.name)}</td>
      <td class="center-number">${Number(x.device_count || 0)}</td>
      <td><div class="table-actions"><button class="btn" type="button" onclick="editGroup('${esc(x.code)}')">Cập nhật</button><button class="btn btn-danger" type="button" onclick="deleteGroup('${esc(x.code)}')">Xóa</button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="center-empty">Chưa có dữ liệu.</td></tr>';
}
function renderUsers() {
  if (!q('userRows')) return;
  const qText = q('userSearch').value.trim().toLowerCase();
  const role = q('userRoleFilter').value;
  const status = q('userStatusFilter').value;
  const data = USERS.filter(x => {
    const text = [x.full_name, x.username, x.department_code, x.department_name, x.role].join(' ').toLowerCase();
    return (!qText || text.includes(qText)) && (role === 'ALL' || x.role === role) && (status === 'ALL' || x.status === status);
  });
  q('userRows').innerHTML = data.map((x,i) => {
    const dept = x.department_code ? departmentLabel(x.department_code, x.department_name || x.department_code) : '—';
    const statusClass = x.status === 'Hoạt động' ? 'green' : 'red';
    return `<tr>
      <td>${i+1}</td>
      <td><b>${esc(x.full_name)}</b></td>
      <td class="device-code">${esc(x.username)}</td>
      <td>${esc(dept)}</td>
      <td>${esc(x.role)}</td>
      <td><span class="tag ${statusClass}">${esc(x.status || '')}</span></td>
      <td>${esc(formatLastLogin(x.last_login_at))}</td>
      <td><div class="table-actions"><button class="btn" type="button" onclick="editUser(${Number(x.id)})">Cập nhật</button><button class="btn" type="button" onclick="resetUserPassword(${Number(x.id)})">Đặt lại mật khẩu</button></div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="center-empty">Chưa có tài khoản phù hợp.</td></tr>';
}

function editDept(code) {
  const x = DEPARTMENTS.find(r => r.code === code);
  if (!x) return;
  q('deptOriginalCode').value = x.code;
  q('deptCode').value = x.code;
  q('deptName').value = cleanDepartmentName(x.code, x.name);
  q('deptName').focus();
}
function editGroup(code) {
  const x = GROUPS.find(r => r.code === code);
  if (!x) return;
  q('groupOriginalCode').value = x.code;
  q('groupCode').value = x.code;
  q('groupName').value = x.name;
  q('groupName').focus();
}
function editUser(id) {
  const x = USERS.find(r => Number(r.id) === Number(id));
  if (!x) return;
  q('userId').value = x.id;
  q('userFullName').value = x.full_name || '';
  q('userUsername').value = x.username || '';
  q('userDepartment').value = x.department_code || '';
  q('userRole').value = x.role || 'Khoa sử dụng';
  q('userStatus').value = x.status || 'Hoạt động';
  q('userPhone').value = x.phone || '';
  q('userPassword').value = '';
  q('initialPasswordField').classList.add('hidden');
  syncUserDepartmentRequirement();
  q('userFullName').focus();
}

async function deleteDept(code) {
  if (!confirm('Xóa khoa/phòng này? Chỉ danh mục chưa được sử dụng mới có thể xóa.')) return;
  try { await api(`/api/departments/${encodeURIComponent(code)}`, { method:'DELETE' }); await loadCategories(); }
  catch (e) { alert(e?.message || 'Không thể xóa. Khoa/phòng có thể đang được sử dụng.'); }
}
async function deleteGroup(code) {
  if (!confirm('Xóa nhóm thiết bị này? Chỉ nhóm chưa được sử dụng mới có thể xóa.')) return;
  try { await api(`/api/device-groups/${encodeURIComponent(code)}`, { method:'DELETE' }); await loadCategories(); }
  catch (e) { alert(e?.message || 'Không thể xóa. Nhóm thiết bị có thể đang được sử dụng.'); }
}
async function resetUserPassword(id) {
  const x = USERS.find(r => Number(r.id) === Number(id));
  if (!x || !confirm(`Cấp lại mật khẩu tạm thời cho ${x.full_name} (${x.username})?`)) return;
  try {
    const result = await api(`/api/auth/users/${id}/reset-password`, { method:'POST', body:JSON.stringify({}) });
    const temp = result?.temporary_password || '';
    alert(temp ? `Mật khẩu tạm thời của ${x.username}:\n\n${temp}\n\nNgười dùng bắt buộc đổi mật khẩu sau lần đăng nhập tiếp theo.` : 'Đã đặt lại mật khẩu.');
    await loadUsers();
  } catch (e) { alert(e?.message || 'Không đặt lại được mật khẩu.'); }
}

function departmentOptions(selected = '') {
  return '<option value="">— Chọn khoa/phòng —</option>' + DEPARTMENTS.map(x => `<option value="${esc(x.code)}" ${String(x.code)===String(selected)?'selected':''}>${esc(departmentLabel(x.code,x.name))}</option>`).join('');
}
function syncUserDepartmentRequirement() {
  if (!q('userRole') || !q('userDepartment')) return;
  const admin = q('userRole').value === 'Quản trị viên';
  q('userDepartment').required = !admin;
  if (admin && !q('userDepartment').value) q('userDepartment').value = '';
}

async function loadCategories() {
  DEPARTMENTS = await api('/api/departments');
  GROUPS = await api('/api/device-groups');
  renderDepartments();
  renderGroups();
  if (q('userDepartment')) q('userDepartment').innerHTML = departmentOptions(q('userDepartment').value);
}
async function loadUsers() {
  if (!isAdminUser(CURRENT_USER)) return;
  USERS = await api('/api/users');
  renderUsers();
}

function activateTab(tab) {
  const allowed = ['departments','groups','users'];
  let target = allowed.includes(tab) ? tab : 'departments';
  if (target === 'users' && !isAdminUser(CURRENT_USER)) target = 'departments';
  document.querySelectorAll('.settings-local-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === target));
  document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${target}`));
  history.replaceState(null, '', `#${target}`);
}

document.addEventListener('DOMContentLoaded', async () => {
  setLayout('settings', 'Cài đặt', 'Quản lý danh mục dùng chung và tài khoản người dùng');
  try {
    const me = await api('/api/auth/me');
    CURRENT_USER = me?.user || null;
  } catch {
    window.location.href = '/login.html?next=%2Fsettings.html';
    return;
  }
  if (!isSettingsUser(CURRENT_USER)) {
    alert('Tài khoản này không có quyền truy cập Cài đặt.');
    window.location.href = '/index.html';
    return;
  }

  if (!isAdminUser(CURRENT_USER)) {
    q('usersTabBtn')?.classList.add('hidden');
    q('panel-users')?.classList.add('hidden');
  }

  await loadCategories();
  if (isAdminUser(CURRENT_USER)) await loadUsers();

  document.querySelectorAll('.settings-local-tab').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  activateTab(location.hash.replace('#','') || 'departments');

  q('deptFilterBtn').onclick = renderDepartments;
  q('groupFilterBtn').onclick = renderGroups;
  q('deptSearch').addEventListener('input', renderDepartments);
  q('groupSearch').addEventListener('input', renderGroups);
  q('deptResetBtn').onclick = resetDeptForm;
  q('groupResetBtn').onclick = resetGroupForm;

  q('deptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const original = q('deptOriginalCode').value.trim();
    const code = q('deptCode').value.trim().toUpperCase();
    const payload = { code, name: cleanDepartmentName(code, q('deptName').value) };
    try {
      if (original) await api(`/api/departments/${encodeURIComponent(original)}`, { method:'PUT', body:JSON.stringify(payload) });
      else await api('/api/departments', { method:'POST', body:JSON.stringify(payload) });
      resetDeptForm(); await loadCategories(); alert('Đã lưu khoa/phòng.');
    } catch (err) { alert(err?.message || 'Không lưu được. Mã khoa có thể bị trùng hoặc dữ liệu chưa hợp lệ.'); }
  });

  q('groupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const original = q('groupOriginalCode').value.trim();
    const payload = { code:q('groupCode').value.trim().toUpperCase(), name:q('groupName').value.trim() };
    try {
      if (original) await api(`/api/device-groups/${encodeURIComponent(original)}`, { method:'PUT', body:JSON.stringify(payload) });
      else await api('/api/device-groups', { method:'POST', body:JSON.stringify(payload) });
      resetGroupForm(); await loadCategories(); alert('Đã lưu nhóm thiết bị. Nhóm mới có thể chọn ngay ở màn hình Thiết bị.');
    } catch (err) { alert(err?.message || 'Không lưu được. Mã nhóm có thể bị trùng hoặc dữ liệu chưa hợp lệ.'); }
  });

  if (isAdminUser(CURRENT_USER)) {
    ['userSearch','userRoleFilter','userStatusFilter'].forEach(id => q(id)?.addEventListener(id === 'userSearch' ? 'input' : 'change', renderUsers));
    q('userResetBtn').onclick = resetUserForm;
    q('userRole').addEventListener('change', syncUserDepartmentRequirement);
    q('userForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = Number(q('userId').value || 0);
      const payload = {
        full_name:q('userFullName').value.trim(), username:q('userUsername').value.trim(),
        department_code:q('userDepartment').value, role:q('userRole').value,
        status:q('userStatus').value, phone:q('userPhone').value.trim()
      };
      if (!id) payload.password = q('userPassword').value;
      try {
        const result = id
          ? await api(`/api/users/${id}`, { method:'PUT', body:JSON.stringify(payload) })
          : await api('/api/users', { method:'POST', body:JSON.stringify(payload) });
        const temp = result?.temporary_password || '';
        resetUserForm(); await loadUsers();
        if (temp) alert(`Đã tạo tài khoản ${payload.username}.\n\nMật khẩu tạm thời:\n${temp}\n\nHãy bàn giao trực tiếp cho người dùng. Hệ thống bắt buộc đổi mật khẩu khi đăng nhập lần đầu.`);
        else alert(id ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản. Người dùng bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.');
      } catch (err) { alert(err?.message || 'Không lưu được tài khoản.'); }
    });
  }
});

// Bổ sung Model và Serial Number tham chiếu cho bảng Nhóm thiết bị.
// Chỉ đọc /api/devices; không thay đổi dữ liệu thiết bị hay danh mục.
let SETTINGS_GROUP_DEVICES = [];

function groupDeviceValues(groupCode, field) {
  return [...new Set(
    SETTINGS_GROUP_DEVICES
      .filter(d => String(d.group_code || '') === String(groupCode || ''))
      .map(d => String(d[field] || '').trim())
      .filter(Boolean)
  )];
}

function groupHintCell(values, limit = 2) {
  if (!values.length) return '<span class="settings-empty-hint">—</span>';
  const shown = values.slice(0, limit);
  const more = values.length > limit ? ` +${values.length - limit}` : '';
  const text = shown.join(', ') + more;
  return `<span class="settings-group-hint" title="${esc(values.join(', '))}">${esc(text)}</span>`;
}

// Ghi đè riêng renderer của bảng nhóm để giữ nguyên CRUD cũ nhưng thêm 2 cột tham chiếu.
renderGroups = function renderGroupsWithDeviceHints() {
  const qText = q('groupSearch').value.trim().toLowerCase();
  const data = GROUPS.filter(x => {
    const models = groupDeviceValues(x.code, 'model');
    const serials = groupDeviceValues(x.code, 'serial');
    const searchText = [x.code, x.name, ...models, ...serials].join(' ').toLowerCase();
    return !qText || searchText.includes(qText);
  });

  q('groupRows').innerHTML = data.map((x, i) => {
    const models = groupDeviceValues(x.code, 'model');
    const serials = groupDeviceValues(x.code, 'serial');
    return `
      <tr>
        <td>${i + 1}</td>
        <td class="device-code">${esc(x.code)}</td>
        <td>${esc(x.name)}</td>
        <td class="center-number">${Number(x.device_count || 0)}</td>
        <td class="settings-hint-cell">${groupHintCell(models)}</td>
        <td class="settings-hint-cell settings-serial-cell">${groupHintCell(serials)}</td>
        <td><div class="table-actions"><button class="btn" type="button" onclick="editGroup('${esc(x.code)}')">Cập nhật</button><button class="btn btn-danger" type="button" onclick="deleteGroup('${esc(x.code)}')">Xóa</button></div></td>
      </tr>`;
  }).join('') || '<tr><td colspan="7" class="center-empty">Chưa có dữ liệu.</td></tr>';
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const rows = await api('/api/devices');
    SETTINGS_GROUP_DEVICES = Array.isArray(rows) ? rows : [];
    renderGroups();
  } catch (e) {
    console.warn('[Cài đặt] Không tải được Model/Serial tham chiếu:', e?.message || e);
  }
});

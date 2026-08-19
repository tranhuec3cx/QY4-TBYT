(() => {
  const originalApi = window.api;
  if (typeof originalApi !== 'function') return;

  function cleanPart(value, fallback) {
    const cleaned = String(value || fallback || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9Đ]/g, '');
    return cleaned || fallback;
  }

  function expectedPrefix(departmentCode, groupCode) {
    return cleanPart(departmentCode, 'XX') + '.' + cleanPart(groupCode, 'K') + '.';
  }

  function hasExpectedPrefix(device) {
    return String(device?.device_code || '').startsWith(expectedPrefix(device?.department_code, device?.group_code));
  }

  function allocateCode(currentDevice, departmentCode, groupCode, allDevices, reserved = new Map()) {
    const prefix = expectedPrefix(departmentCode, groupCode);
    const currentCode = String(currentDevice?.device_code || '').trim();
    const currentId = Number(currentDevice?.id || 0);
    const used = new Map();

    (allDevices || []).forEach(d => {
      const code = String(d?.device_code || '').trim();
      if (code) used.set(code, Number(d?.id || 0));
    });
    reserved.forEach((id, code) => used.set(code, id));
    if (currentCode) used.delete(currentCode);

    const suffixMatch = currentCode.match(/(\d{4})$/);
    if (suffixMatch) {
      const preferred = prefix + suffixMatch[1];
      const owner = used.get(preferred);
      if (!owner || owner === currentId) return preferred;
    }

    let max = 0;
    for (const code of used.keys()) {
      if (!code.startsWith(prefix)) continue;
      const m = code.match(/\.(\d{4})$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    let next = max + 1;
    let candidate = prefix + String(next).padStart(4, '0');
    while (used.has(candidate) && used.get(candidate) !== currentId) {
      next += 1;
      candidate = prefix + String(next).padStart(4, '0');
    }
    return candidate;
  }

  function payloadFromDevice(d, deviceCode) {
    return {
      department_code: d.department_code,
      group_code: d.group_code,
      name: d.name || '',
      manufacturer: d.manufacturer || '',
      model: d.model || '',
      insurance_code: d.insurance_code || '',
      serial: d.serial || '',
      country: d.country || '',
      year_manufactured: Number(d.year_manufactured || 0),
      year_in_use: Number(d.year_in_use || 0),
      warranty_end: d.warranty_end || '',
      status: d.status || 'Đang hoạt động',
      quality_level: Number(d.quality_level || 3),
      cost: Number(d.cost || 0),
      funding: d.funding || '',
      location: d.location || '',
      note: d.note || '',
      device_code: deviceCode
    };
  }

  window.api = async function qy4ApiWithDeviceCodeSync(url, options = {}) {
    const match = String(url || '').match(/^\/api\/devices\/(\d+)$/);
    const method = String(options.method || 'GET').toUpperCase();
    if (!match || method !== 'PUT' || !options.body) return originalApi(url, options);

    let payload;
    try { payload = JSON.parse(options.body); } catch { return originalApi(url, options); }

    const id = Number(match[1]);
    const current = await originalApi(`/api/devices/${id}`);
    const departmentCode = String(payload.department_code || current.department_code || '').trim();
    const groupCode = String(payload.group_code || current.group_code || '').trim();
    const prefix = expectedPrefix(departmentCode, groupCode);
    const currentCode = String(current.device_code || '').trim();

    if (!currentCode.startsWith(prefix)) {
      const allDevices = await originalApi('/api/devices');
      payload.device_code = allocateCode(current, departmentCode, groupCode, allDevices);
    }

    return originalApi(url, { ...options, body: JSON.stringify(payload) });
  };

  async function syncVisibleCodes() {
    try {
      const visible = (typeof FILTERED !== 'undefined' && Array.isArray(FILTERED))
        ? FILTERED.slice()
        : await originalApi('/api/devices');
      const mismatches = visible.filter(d => !hasExpectedPrefix(d));
      if (!mismatches.length) {
        alert('Các mã thiết bị trong phạm vi đang hiển thị đã khớp Khoa/Nhóm.');
        return;
      }
      if (!confirm(`Có ${mismatches.length} thiết bị có mã chưa khớp Khoa/Nhóm. Đồng bộ ngay?`)) return;

      const allDevices = await originalApi('/api/devices');
      const reserved = new Map();
      for (const d of allDevices) {
        const code = String(d.device_code || '').trim();
        if (code) reserved.set(code, Number(d.id || 0));
      }

      let updated = 0;
      for (const d of mismatches) {
        const currentCode = String(d.device_code || '').trim();
        if (currentCode) reserved.delete(currentCode);
        const newCode = allocateCode(d, d.department_code, d.group_code, allDevices, reserved);
        reserved.set(newCode, Number(d.id || 0));
        await originalApi(`/api/devices/${d.id}`, {
          method: 'PUT',
          body: JSON.stringify(payloadFromDevice(d, newCode))
        });
        updated += 1;
      }

      if (typeof loadData === 'function') await loadData();
      alert(`Đã đồng bộ mã cho ${updated} thiết bị theo Khoa/Nhóm hiện tại.`);
    } catch (e) {
      alert(e?.message || 'Không đồng bộ được mã thiết bị.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!/\/index\.html$|\/$/.test(window.location.pathname)) return;
    const actions = document.querySelector('.table-footer-actions');
    if (!actions || document.getElementById('syncDeviceCodesBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'syncDeviceCodesBtn';
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Đồng bộ mã Khoa/Nhóm';
    btn.title = 'Cập nhật tiền tố mã thiết bị theo Khoa và Nhóm đang quản lý';
    btn.onclick = syncVisibleCodes;
    actions.insertBefore(btn, actions.firstChild);
  });

  window.qy4DeviceCodeSync = { cleanPart, expectedPrefix, hasExpectedPrefix, allocateCode };
})();

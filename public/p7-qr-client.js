// P7 - lớp tương thích QR có chữ ký. Được nối sau public/api.js khi server chạy.
(function () {
  if (typeof window === 'undefined') return;

  function p7SignedQrUrl(device, baseUrl) {
    const base = normalizeQrBaseUrl(baseUrl || getQrBaseUrl()) || normalizeQrBaseUrl(window.location.origin || '');
    const key = String(device?.__qy4QrKey || device?.device_code || device?.id || '').trim();
    const token = String(device?.__qy4QrToken || '').trim();
    const path = `${base}/q/${encodeURIComponent(key)}`;
    return token ? `${path}?token=${encodeURIComponent(token)}` : path;
  }

  if (typeof buildQrCheckUrl === 'function') {
    buildQrCheckUrl = p7SignedQrUrl;
  }

  if (typeof showDeviceQrModal === 'function') {
    const originalShowDeviceQrModal = showDeviceQrModal;
    showDeviceQrModal = async function p7ShowDeviceQrModal(device) {
      try {
        const deviceId = Number(device?.id || 0);
        if (!deviceId) throw new Error('Thiếu ID thiết bị để phát hành QR.');
        const signed = await api(`/api/qr/sign?device_id=${encodeURIComponent(deviceId)}`);
        if (!signed?.token || !signed?.key) throw new Error('Máy chủ không trả về chữ ký QR hợp lệ.');
        device.__qy4QrToken = String(signed.token);
        device.__qy4QrKey = String(signed.key);
        device.__qy4QrKind = String(signed.kind || (device.device_code ? 'code' : 'id'));
        const result = originalShowDeviceQrModal(device);
        const hint = document.querySelector('#qrPrintArea .hint');
        if (hint) hint.textContent = 'Quét để kiểm tra / báo sự cố thiết bị • QR bảo mật';
        return result;
      } catch (err) {
        alert(`Không thể phát hành mã QR bảo mật. ${err?.message || err}`);
        return null;
      }
    };
  }

  // ===== Cài đặt hệ thống =====
  // Giữ api.js lõi ổn định: thêm mục Cài đặt tại lớp runtime chung đã được nạp trên mọi màn hình.
  if (typeof renderMenu === 'function') {
    const originalRenderMenu = renderMenu;
    renderMenu = function qy4RenderMenuWithSettings(active) {
      const html = originalRenderMenu(active);
      const settingsLink = `<a id="settingsMenuLink" class="settings-menu-link hidden ${active === 'settings' ? 'active' : ''}" href="/settings.html"><span class="menu-icon">⚙</span><span>Cài đặt</span></a>`;
      return html.replace('</nav>', `${settingsLink}</nav>`);
    };
  }

  // Loại lỗi hiển thị “A1 - A1 - Khoa Quốc tế” khi dữ liệu tên khoa đã chứa mã.
  if (typeof optDepartmentFilter === 'function') {
    optDepartmentFilter = function qy4DepartmentOptions(list, allLabel = null, selected = 'ALL') {
      const rows = allLabel ? [{ code:'ALL', name:allLabel }, ...(list || [])] : (list || []);
      return rows.map(x => {
        const code = String(x.code || '').trim();
        let name = String(x.name || '').trim();
        if (code !== 'ALL' && code) {
          const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          name = name.replace(new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i'), '').trim();
        }
        const label = code === 'ALL' ? name : (name ? `${code} - ${name}` : code);
        return `<option value="${code}" ${String(code) === String(selected) ? 'selected' : ''}>${label}</option>`;
      }).join('');
    };
  }

  function canOpenSettings(user) {
    const role = String(user?.role || '');
    return /quản trị|kỹ|ky|trang bị|ttbyt/i.test(role);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const result = await api('/api/auth/me');
      const user = result?.user || null;
      const allowed = canOpenSettings(user);
      const menuLink = document.getElementById('settingsMenuLink');
      if (menuLink) menuLink.classList.toggle('hidden', !allowed);
      const deviceShortcut = document.getElementById('deviceSettingsBtn');
      if (deviceShortcut) deviceShortcut.classList.toggle('hidden', !allowed);
    } catch {
      document.getElementById('settingsMenuLink')?.classList.add('hidden');
      document.getElementById('deviceSettingsBtn')?.classList.add('hidden');
    }
  });
})();

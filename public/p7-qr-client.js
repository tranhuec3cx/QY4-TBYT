// P7 - lớp tương thích QR có chữ ký. Được nối sau public/api.js khi server chạy qua p7-start.js.
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
})();

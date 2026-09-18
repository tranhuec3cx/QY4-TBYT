(() => {
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function splitDateTime(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return { date:'—', time:'' };
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (match) {
      return {
        date: `${match[3]}/${match[2]}/${match[1]}`,
        time: match[4] && match[5] ? `${match[4]}:${match[5]}` : ''
      };
    }
    return { date: raw, time:'' };
  }

  function time(value) {
    const parts = splitDateTime(value);
    return `<div class="op-time-cell"><div class="op-time-date">${esc(parts.date)}</div>${parts.time ? `<div class="op-time-clock">${esc(parts.time)}</div>` : ''}</div>`;
  }

  function deviceData(record = {}, device = {}) {
    return {
      name: device.name || record.device_name || record.name || '',
      model: device.model || record.model || '',
      manufacturer: device.manufacturer || record.manufacturer || record.manufacturer_name || '',
      device_code: device.device_code || record.device_code || '',
      department_code: device.department_code || record.department_code || '',
      location: device.location || record.location || ''
    };
  }

  function device(record = {}, master = {}) {
    const d = deviceData(record, master);
    return `<div class="op-device-cell">
      <div class="op-device-name">${esc(d.name || '—')}</div>
      <div class="op-device-meta"><span>Model:</span> ${esc(d.model || '—')}</div>
      <div class="op-device-meta"><span>Hãng:</span> ${esc(d.manufacturer || '—')}</div>
      <div class="op-device-meta op-device-code"><span>Mã TB:</span> ${esc(d.device_code || '—')}</div>
    </div>`;
  }

  function departmentLocation(record = {}, master = {}) {
    const d = deviceData(record, master);
    return `<div class="op-dept-cell">
      <div class="op-dept-code">${esc(d.department_code || '—')}</div>
      <div class="op-location">${esc(d.location || '—')}</div>
    </div>`;
  }

  window.QY4OperationCells = Object.freeze({ esc, splitDateTime, time, device, departmentLocation, deviceData });
})();
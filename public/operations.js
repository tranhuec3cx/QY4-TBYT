let backups = [];
function humanSize(bytes){
  const b=Number(bytes||0); if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB';
}
async function loadStats(){
  const s = await api('/api/system/stats');
  const c = s.counts || {};
  q('opsKpis').innerHTML = `
    <div class="kpi-card"><span>Thiết bị</span><strong>${c.devices||0}</strong><small>Hồ sơ đang quản lý</small></div>
    <div class="kpi-card"><span>Sự cố</span><strong>${c.incidents||0}</strong><small>Phiếu báo hỏng</small></div>
    <div class="kpi-card"><span>Sửa chữa</span><strong>${c.repairs||0}</strong><small>Phiếu sửa chữa</small></div>
    <div class="kpi-card"><span>Dữ liệu</span><strong>${humanSize(s.size_bytes)}</strong><small>Cập nhật: ${formatDateTimeVN(String(s.updated_at||'').replace('T',' ').slice(0,16))}</small></div>
  `;
}
async function loadBackups(){
  backups = await api('/api/backups');
  q('backupRows').innerHTML = backups.map(b => `
    <tr>
      <td class="device-code">${b.filename}</td>
      <td>${humanSize(b.size_bytes)}</td>
      <td>${formatDateTimeVN(String(b.created_at||'').replace('T',' ').slice(0,16))}</td>
      <td><div class="table-actions">
        <a class="btn" href="/api/backups/${encodeURIComponent(b.filename)}/download">Tải</a>
        <button class="btn btn-danger" onclick="restoreBackup('${b.filename}')">Phục hồi</button>
      </div></td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="center-empty">Chưa có bản sao lưu.</td></tr>';
}
async function restoreBackup(file){
  if(!confirm('Phục hồi database từ bản sao lưu này? Hệ thống sẽ tạo một bản sao lưu tự động trước khi phục hồi. Sau khi phục hồi cần tắt và chạy lại npm start.')) return;
  const r = await api(`/api/backups/${encodeURIComponent(file)}/restore`, { method:'POST' });
  alert(r.message || 'Đã phục hồi.');
}
async function createBackup(){
  const r = await api('/api/backups', { method:'POST' });
  alert('Đã tạo bản sao lưu: ' + r.filename);
  await loadBackups(); await loadStats(); await loadAudit();
}
async function loadAudit(){
  const rows = await api('/api/audit-logs?limit=80');
  q('auditRows').innerHTML = rows.map(x => `
    <tr><td>${formatDateTimeVN(x.action_time)}</td><td>${x.module||''}</td><td>${x.action||''}</td><td>${x.detail||''}</td></tr>
  `).join('') || '<tr><td colspan="4" class="center-empty">Chưa có nhật ký.</td></tr>';
}
async function loadParts(){
  const parts = await api('/api/spare-parts');
  const low = parts.filter(p => Number(p.quantity||0) <= Number(p.min_quantity||0));
  q('partRows').innerHTML = low.map(p => `
    <tr><td class="device-code">${p.code||''}</td><td>${p.name}</td><td><b>${p.quantity||0}</b></td><td>${p.min_quantity||0}</td><td>${p.unit||''}</td></tr>
  `).join('') || '<tr><td colspan="5" class="center-empty">Không có vật tư dưới mức tối thiểu.</td></tr>';
}
async function loadAlerts(){
  const alerts = await api('/api/alerts?limit=20');
  q('alertRows').innerHTML = alerts.map(a => `
    <a class="alert-item ${a.level||'info'}" href="${a.link||'#'}">
      <b>${a.title}</b><span>${a.content||''}</span><small>${a.due_date ? 'Hạn: '+formatDateVN(a.due_date) : ''}</small>
    </a>
  `).join('') || '<div class="center-empty">Chưa có cảnh báo.</div>';
}

async function loadHealth(){
  const h = await api('/api/system/health');
  q('healthRows').innerHTML = (h.checks||[]).map(x => `
    <div class="health-item ${x.ok ? 'ok' : 'warn'}">
      <b>${x.ok ? '✓' : '!' } ${x.label}</b>
      <span>${x.detail||''}</span>
    </div>
  `).join('');
}
async function loadDataQuality(){
  const rows = await api('/api/data-quality?limit=80');
  q('qualityRows').innerHTML = rows.map(r => `
    <tr>
      <td><span class="status ${r.level==='warning'?'orange':'yellow'}">${r.level==='warning'?'Cần bổ sung':'Gợi ý'}</span></td>
      <td>${r.type||''}</td>
      <td class="device-code">${r.device_code||''}</td>
      <td>${r.device_name||''}</td>
      <td>${r.department_code||''}</td>
      <td>${r.detail||''}</td>
      <td>${r.link ? `<a class="btn" href="${r.link}">Mở</a>` : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="center-empty">Dữ liệu thiết bị đã đầy đủ theo các tiêu chí kiểm tra nhanh.</td></tr>';
}

document.addEventListener('DOMContentLoaded', async () => {
  setLayout('operations', 'Vận hành hệ thống', 'Sao lưu dữ liệu, nhật ký thao tác và cảnh báo phục vụ dùng thực tế');
  q('createBackupBtn').onclick = createBackup;
  q('reloadBackupBtn').onclick = loadBackups;
  q('reloadHealthBtn').onclick = async () => { await loadHealth(); await loadDataQuality(); };
  await Promise.all([loadStats(), loadBackups(), loadAudit(), loadParts(), loadAlerts(), loadHealth(), loadDataQuality()]);
});

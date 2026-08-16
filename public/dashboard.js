function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function plusDaysISO(n){ const d=new Date(); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function esc(value){ return String(value ?? "").replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }
function fmtDate(v){ return v ? String(v).slice(0,10).split("-").reverse().join("/") : ""; }
function setText(id, value){ const el=q(id); if(el) el.textContent=value; }
function renderAlertLevel(level){
  if(level === 'danger') return 'red';
  if(level === 'warning') return 'orange';
  if(level === 'info') return 'yellow';
  return 'green';
}
function renderBarRows(rows){
  if(!rows || !rows.length) return '<div class="center-empty">Chưa có dữ liệu.</div>';
  const max = Math.max(...rows.map(x => Number(x.count || 0)), 1);
  return rows.slice(0,8).map(x => `
    <div class="metric-row">
      <div class="metric-row-head"><b>${esc(x.name || x.status || x.code || 'Khác')}</b><span>${Number(x.count||0)}</span></div>
      <div class="metric-bar"><i style="width:${Math.round(Number(x.count||0)*100/max)}%"></i></div>
    </div>`).join('');
}

document.addEventListener("DOMContentLoaded", async () => {
  setLayout("dashboard", "Tổng quan", "Trung tâm điều hành quản lý trang thiết bị y tế - Khoa Trang bị BV Quân y 4");
  const [data, devices, checksToday, maints, inspections] = await Promise.all([
    api('/api/leadership-dashboard'),
    api('/api/devices'),
    api(`/api/checks?from_date=${todayISO()}&to_date=${todayISO()}`),
    api(`/api/maintenances?from_date=${todayISO()}&to_date=${plusDaysISO(30)}`),
    api(`/api/inspections?from_date=2020-01-01&to_date=${plusDaysISO(365)}`)
  ]);

  setText("dbTotal", data.total ?? devices.length);
  setText("dbActive", data.active ?? devices.filter(d => d.status === "Đang hoạt động").length);
  setText("dbWaitingRepair", data.openRepairs ?? devices.filter(d => d.status === "Chờ sửa chữa").length);
  setText("dbStopped", devices.filter(d => ["Ngừng hoạt động","Chờ thanh lý"].includes(d.status)).length);
  setText("dbRepairCost", formatCurrency(data.repairCost || 0));
  setText("dbOpenIncidents", data.openIncidents || 0);
  setText("dbDueMaint", (data.dueMaint || 0) + (data.overdueMaint || 0));
  setText("dbDueInspection", (data.dueInspections || 0) + (data.overdueInspections || 0));
  setText("dbQrTotal", checksToday.length);
  setText("dbQrNormal", checksToday.filter(x => ["Bình thường","Tốt","Đạt"].includes(String(x.result||"").trim())).length);
  setText("dbQrIssue", checksToday.filter(x => ["Có vấn đề","Nghiêm trọng","Đạt có lưu ý","Không đạt"].includes(String(x.result||"").trim())).length);

  const dueMaint = maints.filter(x => x.next_date && x.next_date >= todayISO() && x.next_date <= plusDaysISO(30)).sort((a,b)=>String(a.next_date).localeCompare(String(b.next_date))).slice(0,5);
  q("dueMaints").innerHTML = dueMaint.length ? dueMaint.map(x => `<li>${esc(x.device_code||"")} - ${esc(x.device_name||"")} <b>${fmtDate(x.next_date || x.maintenance_date)}</b></li>`).join("") : `<li>Không có bảo dưỡng sắp đến hạn.</li>`;
  const dueIns = inspections.filter(x => x.next_date && x.next_date >= todayISO()).sort((a,b)=>String(a.next_date).localeCompare(String(b.next_date))).slice(0,5);
  q("dueInspections").innerHTML = dueIns.length ? dueIns.map(x => `<li>${esc(x.device_code||"")} - ${esc(x.device_name||"")} <b>${fmtDate(x.next_date)}</b></li>`).join("") : `<li>Không có kiểm định sắp đến hạn.</li>`;

  q('alertsList').innerHTML = (data.alerts || []).length ? data.alerts.map(a => `
    <a class="alert-row" href="${esc(a.link || '#')}">
      <span class="tag ${renderAlertLevel(a.level)}">${esc(a.type)}</span>
      <div><b>${esc(a.title)}</b><p>${esc(a.content)}</p></div>
    </a>`).join('') : '<div class="center-empty">Không có cảnh báo quan trọng.</div>';
  q('deptChart').innerHTML = renderBarRows(data.byDept || []);
  q('statusChart').innerHTML = renderBarRows(data.byStatus || []);
});

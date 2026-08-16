let ROWS=[], DEVICES=[], FILTERED=[], CURRENT_INSPECTION_FILE_PATH="";
function meta(id){return DEVICES.find(d=>Number(d.id)===Number(id))||{};}
function deviceSearchLabel(d){ return [d.device_code, d.name, d.model, d.serial ? 'SN: '+d.serial : '', d.department_code].filter(Boolean).join(' - '); }
function findDeviceBySearch(value){
  const raw = String(value || '').trim();
  if(!raw) return null;
  const rawNorm = raw.toLowerCase();
  return DEVICES.find(d => deviceSearchLabel(d).toLowerCase() === rawNorm)
    || DEVICES.find(d => [d.device_code,d.name,d.model,d.serial,d.insurance_code,d.department_code].filter(Boolean).join(' ').toLowerCase().includes(rawNorm));
}
function setSelectedDevice(device){
  q('deviceId').value = device ? device.id : '';
  if(q('deviceSearch')) q('deviceSearch').value = device ? deviceSearchLabel(device) : '';
  fillInfo();
}
function fillInfo(){const m=meta(q('deviceId').value); q('dept').value=m.department_code||''; q('location').value=m.location||'';}
function resetForm(){q('form').reset(); q('recordId').value=''; CURRENT_INSPECTION_FILE_PATH=''; if(q('fileUpload')) q('fileUpload').value=''; setSelectedDevice(null);}
function daysTo(dateStr){ if(!dateStr) return 99999; const t=new Date(dateStr+'T00:00:00').getTime(); const n=new Date(); n.setHours(0,0,0,0); return Math.ceil((t-n.getTime())/86400000); }
function dueTag(d){ const x=daysTo(d); if(x<0) return '<span class="tag red">Quá hạn</span>'; if(x<=30) return '<span class="tag orange">Sắp hạn</span>'; return '<span class="tag green">Còn hạn</span>'; }
function esc(value){ return String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function attachedFilePath(r){ const f = String(r.file_note || "").trim(); return f.startsWith("/uploads/") ? f : ""; }
function fileNameFromPath(path){ return String(path || "").split("/").pop() || "Tệp đính kèm"; }
function fileCell(r){
  const path = attachedFilePath(r);
  if(!path) return "";
  return `<a class="btn btn-secondary btn-sm" href="${esc(path)}" target="_blank" rel="noopener">Tải file</a><div class="small file-name-line">${esc(fileNameFromPath(path))}</div>`;
}
function render(data){q('countLabel').textContent=`${data.length} bản ghi`; q('rows').innerHTML=data.length?data.map(r=>`<tr><td class="time-cell">${formatDateTimeVN(r.inspection_date)}</td><td class="device-code">${esc(r.device_code)}</td><td>${esc(r.device_name)}</td><td class="code-only">${esc(r.department_code||'')}</td><td>${esc(r.type||'')}</td><td>${esc(r.organization||'')}</td><td>${formatDateVN(r.next_date)}<br>${dueTag(r.next_date)}</td><td><span class="tag ${statusTagClass(r.result)}">${esc(r.result||'')}</span></td><td>${fileCell(r)}</td><td><div class="table-actions compact-actions"><button class="btn btn-secondary" onclick="openDeviceProfile(${r.device_id})">Xem</button><button class="btn" onclick="editRow(${r.id})">Cập nhật</button><button class="btn btn-danger" onclick="delRow(${r.id})">Xóa</button></div></td></tr>`).join(''):'<tr><td colspan="10" class="center-empty">Chưa có dữ liệu.</td></tr>';}
function applyFilter(){const text=q('searchInput').value.toLowerCase(); const dev=q('deviceFilter').value; const typ=q('typeFilter').value; const org=q('orgFilter') ? q('orgFilter').value : 'ALL'; const from=q('fromDate')?.value||''; const to=q('toDate')?.value||''; FILTERED=ROWS.filter(r=>inDateRange(r.inspection_date,from,to)&&(!text||[r.device_code,r.device_name,r.certificate_no,r.organization].join(' ').toLowerCase().includes(text))&&(dev==='ALL'||String(r.device_id)===dev)&&(typ==='ALL'||r.type===typ)&&(org==='ALL'||(r.organization||'')===org)).sort((a,b)=>daysTo(a.next_date)-daysTo(b.next_date)); render(FILTERED);}
function editRow(id){const r=ROWS.find(x=>x.id===id); if(!r)return; q('recordId').value=r.id; setSelectedDevice(meta(r.device_id)); q('type').value=r.type||'Kiểm định'; q('inspectionDate').value=toDateTimeLocalValue(r.inspection_date||''); q('organization').value=r.organization||''; q('certificateNo').value=r.certificate_no||''; q('result').value=r.result||'Đạt'; q('nextDate').value=r.next_date||''; CURRENT_INSPECTION_FILE_PATH = attachedFilePath(r); q('fileNote').value=CURRENT_INSPECTION_FILE_PATH ? fileNameFromPath(r.file_note) : (r.file_note||''); q('note').value=r.note||''; q('formCard').scrollIntoView({behavior:'smooth'});}
async function delRow(id){ if(!confirm('Xóa hồ sơ này?'))return; await api(`/api/inspections/${id}`,{method:'DELETE'}); await load();}
async function load(){DEVICES=await api('/api/devices'); ROWS=await api('/api/inspections'); q('deviceFilter').innerHTML='<option value="ALL">Tất cả thiết bị</option>'+DEVICES.map(d=>`<option value="${d.id}">${d.device_code} - ${d.name}</option>`).join(''); if(q('inspectionDeviceOptions')) q('inspectionDeviceOptions').innerHTML=DEVICES.map(d=>`<option value="${deviceSearchLabel(d).replace(/"/g,'&quot;')}"></option>`).join(''); if(q('orgFilter')){const orgs=[...new Set(ROWS.map(r=>r.organization).filter(Boolean))].sort(); q('orgFilter').innerHTML='<option value="ALL">Tất cả đơn vị</option>'+orgs.map(v=>`<option value="${v}">${v}</option>`).join('');} fillInfo(); applyFilter();}
function exportExcel(){
  exportA4Report('inspections', { fromId: 'fromDate', toId: 'toDate' });
}
document.addEventListener('DOMContentLoaded',async()=>{setLayout('inspections','Kiểm định','Theo dõi ngày kiểm định, ngày hết hạn, kết quả và file chứng nhận'); setDefaultDateRange(); applyFieldLabels('form',{dept:'Khoa',location:'Vị trí',type:'Loại thực hiện',inspectionDate:'Thời gian',organization:'Đơn vị thực hiện',result:'Kết quả',nextDate:'Ngày hết hạn',fileNote:'File chứng nhận / ghi chú',fileUpload:'Tải file đính kèm',note:'Ghi chú'}); await load(); const editId = new URLSearchParams(window.location.search).get('edit_id'); if(editId) editRow(Number(editId)); q('filterBtn').onclick=applyFilter; q('searchInput').oninput=applyFilter; q('deviceFilter').onchange=applyFilter; q('typeFilter').onchange=applyFilter; if(q('orgFilter')) q('orgFilter').onchange=applyFilter; if(q('fromDate')) q('fromDate').onchange=applyFilter; if(q('toDate')) q('toDate').onchange=applyFilter; if(q('deviceSearch')){ q('deviceSearch').addEventListener('input',()=>{ const d=findDeviceBySearch(q('deviceSearch').value); q('deviceId').value=d?d.id:''; fillInfo(); }); q('deviceSearch').addEventListener('change',()=>setSelectedDevice(findDeviceBySearch(q('deviceSearch').value))); } q('resetBtn').onclick=resetForm; q('exportBtn').onclick=exportExcel; q('form').onsubmit=async e=>{
  e.preventDefault();
  let uploadedPath = "";
  const fileInput = q('fileUpload');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const fd = new FormData();
    fd.append('device_id', q('deviceId').value);
    fd.append('name', q('certificateNo').value || `Hồ sơ ${q('type').value}`);
    fd.append('type', q('type').value);
    fd.append('doc_date', q('inspectionDate').value);
    fd.append('updated_by', 'Quản trị viên');
    fd.append('note', q('note').value || '');
    fd.append('file', fileInput.files[0]);
    const res = await fetch('/api/documents', { method:'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const doc = await res.json();
    uploadedPath = doc.file_path || '';
  }
  if(!q('deviceId').value){ alert('Anh vui lòng chọn thiết bị từ danh sách gợi ý.'); return; }
  const p={device_id:Number(q('deviceId').value),inspection_date:fromDateTimeLocalValue(q('inspectionDate').value),type:q('type').value,organization:q('organization').value,certificate_no:q('certificateNo').value,result:q('result').value,next_date:q('nextDate').value,file_note: uploadedPath || CURRENT_INSPECTION_FILE_PATH || q('fileNote').value,note:q('note').value};
  const id=q('recordId').value;
  if(id) await api(`/api/inspections/${id}`,{method:'PUT',body:JSON.stringify(p)});
  else await api('/api/inspections',{method:'POST',body:JSON.stringify(p)});
  resetForm();
  if (fileInput) fileInput.value = '';
  await load();
};});

function reportFileStamp(){const d=new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;}

function openDeviceProfile(deviceId){ window.location.href = `/device-detail.html?id=${deviceId}`; }

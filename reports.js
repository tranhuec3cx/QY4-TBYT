let META = { departments: [], groups: [] };
let RAW = { devices: [], repairs: [], maintenances: [], inspections: [], incidents: [], spareParts: [] };
let CURRENT = [];
let CURRENT_COLUMNS = [];
let CURRENT_TITLE = "";

const REPORT_GROUPS = {
  tonghop: {
    label: "I. Tổng hợp thiết bị",
    reports: {
      assetOverview: "Tổng quan thiết bị",
      devicesByDept: "Thiết bị theo khoa/phòng",
      devicesByGroup: "Thiết bị theo nhóm",
      devicesByStatus: "Thiết bị theo tình trạng",
      devicesByFunding: "Thiết bị theo nguồn kinh phí",
      devicesByQuality: "Thiết bị theo phân cấp chất lượng",
      devicesByAge: "Thiết bị theo năm sử dụng",
      devicesMissingInfo: "Thiết bị thiếu thông tin"
    }
  },
  vanhanh: {
    label: "II. Vận hành kỹ thuật",
    reports: {
      incidents: "Sự cố thiết bị",
      repairs: "Sửa chữa thiết bị",
      openRepairs: "Phiếu sửa chữa đang mở",
      repeatRepairs: "Thiết bị sửa chữa nhiều lần",
      repairCostByDept: "Chi phí sửa chữa theo khoa",
      maintenances: "Bảo dưỡng thiết bị",
      maintenanceDue: "Sắp/quá hạn bảo dưỡng",
      inspections: "Kiểm định - hiệu chuẩn - ATBX",
      inspectionDue: "Sắp/quá hạn kiểm định"
    }
  },
  kho: {
    label: "III. Kho - Vật tư",
    reports: {
      inventorySummary: "Tổng hợp nhập - xuất - tồn",
      lowStock: "Vật tư tồn dưới mức tối thiểu",
      inventoryCheck: "Kiểm kê kho vật tư",
      materialsForRepair: "Vật tư sử dụng cho sửa chữa"
    }
  },
  kiemke: {
    label: "IV. Kiểm kê thiết bị",
    reports: {
      inventoryByDept: "Kiểm kê thiết bị theo khoa",
      inventoryQuality: "Tổng hợp phân cấp chất lượng",
      inventoryMissingLocation: "Thiết bị thiếu vị trí",
      inventoryWrongLocation: "Thiết bị sai vị trí",
      inventoryRecommendRepair: "Đề nghị sửa chữa",
      devicesNeedReplace: "Đề nghị điều chuyển/thanh lý"
    }
  },
  bieumau: {
    label: "V. Biểu mẫu quản lý",
    reports: {
      deviceListTemplate: "Danh sách trang thiết bị y tế",
      annualUsage: "Tình hình sử dụng trang bị quân y",
      cqySupplied: "Thiết bị Cục Quân y cấp hiện vật",
      procurement: "Đấu thầu/mua sắm thiết bị",
      cssscd: "Dự trữ CSSSCĐ, PCD",
      inventoryMinutes: "Biên bản kiểm kê"
    }
  }
};

const REPORT_HINTS = {
  assetOverview: "Tổng hợp nhanh số lượng và tình trạng trang thiết bị trong phạm vi lọc.",
  devicesByDept: "Tổng hợp số lượng thiết bị theo từng khoa/phòng sử dụng.",
  devicesByGroup: "Tổng hợp thiết bị theo nhóm/chủng loại.",
  devicesByStatus: "Phân bố thiết bị theo tình trạng sử dụng.",
  devicesByFunding: "Phân loại thiết bị theo nguồn kinh phí.",
  devicesByQuality: "Tổng hợp thiết bị theo phân cấp chất lượng.",
  devicesByAge: "Phân nhóm thiết bị theo thời gian sử dụng.",
  devicesMissingInfo: "Danh sách thiết bị còn thiếu Model, Serial Number, khoa hoặc vị trí.",
  incidents: "Danh sách sự cố phát sinh trong khoảng thời gian lọc.",
  repairs: "Danh sách phiếu sửa chữa và kết quả xử lý.",
  openRepairs: "Các phiếu sửa chữa chưa hoàn thành hoặc chưa đóng.",
  repeatRepairs: "Thiết bị có từ hai lần sửa chữa trở lên trong khoảng thời gian lọc.",
  repairCostByDept: "Tổng hợp số phiếu và chi phí sửa chữa theo khoa/phòng.",
  maintenances: "Danh sách bảo dưỡng và file biên bản kèm theo.",
  maintenanceDue: "Thiết bị sắp đến hạn hoặc đã quá hạn bảo dưỡng.",
  inspections: "Danh sách kiểm định, hiệu chuẩn và kiểm tra an toàn bức xạ.",
  inspectionDue: "Thiết bị sắp đến hạn hoặc đã quá hạn kiểm định.",
  inventorySummary: "Tổng hợp số lượng vật tư/linh kiện hiện có.",
  lowStock: "Vật tư có tồn kho bằng hoặc thấp hơn mức tối thiểu.",
  inventoryCheck: "Biên bản kiểm kê kho vật tư theo số liệu hiện có.",
  materialsForRepair: "Vật tư/linh kiện đã liên kết với hoạt động sửa chữa.",
  inventoryByDept: "Danh sách thiết bị phục vụ kiểm kê theo từng khoa/phòng.",
  inventoryQuality: "Tổng hợp thiết bị theo phân cấp chất lượng.",
  inventoryMissingLocation: "Danh sách thiết bị chưa có thông tin vị trí.",
  inventoryWrongLocation: "Danh sách thiết bị được ghi nhận sai vị trí trong đợt kiểm kê.",
  inventoryRecommendRepair: "Thiết bị cần đề nghị sửa chữa dựa trên tình trạng hiện tại.",
  devicesNeedReplace: "Thiết bị cần đánh giá điều chuyển hoặc thanh lý.",
  deviceListTemplate: "Danh sách thiết bị theo mẫu quản lý và xuất Excel A4.",
  annualUsage: "Mẫu tổng hợp tình hình sử dụng trang bị quân y theo khoa.",
  cqySupplied: "Thiết bị có nguồn cấp liên quan Cục Quân y/Quốc phòng.",
  procurement: "Danh mục thiết bị mua sắm, đưa vào sử dụng và nguồn kinh phí.",
  cssscd: "Mẫu theo dõi vật tư phục vụ sẵn sàng chiến đấu/phòng chống dịch.",
  inventoryMinutes: "Biên bản kiểm kê thiết bị tổng hợp theo khoa/phòng."
};

function esc(v){return String(v??"").replace(/[&<>\"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s]));}
function norm(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function num(v){return Number(v||0);}
function dateOnly(v){return String(v||"").slice(0,10);}
function daysUntil(v){ if(!v) return null; const a=new Date(dateOnly(v)+"T00:00:00"); const b=new Date(todayISO()+"T00:00:00"); return Math.round((a-b)/(24*3600*1000)); }
function dueLabel(date){ const d=daysUntil(date); if(d===null) return ""; if(d<0) return `Quá hạn ${Math.abs(d)} ngày`; if(d<=30) return `Còn ${d} ngày`; return `Còn ${d} ngày`; }
function dueClass(date){ const d=daysUntil(date); if(d===null) return ""; if(d<0) return "red"; if(d<=30) return "yellow"; return "green"; }
function getDeptName(code){ const d=(META.departments||[]).find(x=>x.code===code); return d ? d.name : code; }
function getGroupName(code){ const g=(META.groups||[]).find(x=>x.code===code); return g ? g.name : code; }
function deviceMap(){ return new Map(RAW.devices.map(d=>[Number(d.id),d])); }
function inRange(v){ return inDateRange(v, q("fromDate").value, q("toDate").value); }
function baseDeviceFilter(rows){
  const dept=q("deptFilter").value, group=q("groupFilter").value, text=norm(q("searchInput").value);
  return rows.filter(r=>(dept==="ALL"||r.department_code===dept)&&(group==="ALL"||r.group_code===group)&&(!text||norm([r.device_code,r.name,r.device_name,r.department_name,r.department_code,r.group_name,r.group_code,r.model,r.serial,r.status,r.funding].join(" ")).includes(text)));
}
function baseTextFilter(rows){ const text=norm(q("searchInput").value); return rows.filter(r=>!text||norm(Object.values(r).join(" ")).includes(text)); }
function summarize(rows, keyFn){ const m=new Map(); rows.forEach(r=>{const k=keyFn(r); if(!m.has(k)) m.set(k,{key:k,count:0,value:0}); const x=m.get(k); x.count++; x.value+=num(r.cost);}); return [...m.values()].sort((a,b)=>b.count-a.count||b.value-a.value); }
function latestByDevice(rows, deviceIdField, dateField){ const m=new Map(); rows.forEach(r=>{const id=Number(r[deviceIdField]); if(!m.has(id)||String(r[dateField]||"")>String(m.get(id)[dateField]||"")) m.set(id,r);}); return m; }

const cols = {
  device: ["STT","Mã TB","Tên thiết bị","Khoa","Nhóm","Model","Serial","Tình trạng","Nguồn vốn","Nguyên giá"],
  summary: ["STT","Mã","Tên/Nhóm","Số lượng","Giá trị","Ghi chú"],
  work: ["STT","Thời gian","Mã TB","Thiết bị","Khoa","Nội dung","Kết quả/Trạng thái","Người/Đơn vị","Chi phí/File"],
  due: ["STT","Mã TB","Thiết bị","Khoa","Ngày gần nhất","Hạn tiếp theo","Tình trạng hạn","Ghi chú"],
  usage: ["STT","Khoa","Hiện có","Đang sử dụng","Không sử dụng","Sửa chữa trong năm","Đã kiểm định","Chưa kiểm định","Ghi chú"],
  incident: ["STT","Thời gian","Mã TB","Tên thiết bị","Khoa","Nội dung sự cố","Người báo","Trạng thái","File/Ghi chú"],
  repair: ["STT","Tiếp nhận","Mã TB","Tên thiết bị","Khoa","Nguyên nhân hỏng","Nội dung sửa chữa","Người thực hiện","Trạng thái","Kinh phí","Kết quả"],
  maintenance: ["STT","Thời gian","Mã TB","Tên thiết bị","Khoa","Loại bảo dưỡng","Nội dung","Người thực hiện","Kết quả","Lần tiếp theo","File"],
  inspection: ["STT","Thời gian","Mã TB","Tên thiết bị","Khoa","Loại","Đơn vị thực hiện","Kết quả","Ngày hết hạn","File"]
};

function rowDevice(d,i,extra=""){
  return [i+1,d.device_code||"",d.name||d.device_name||"",d.department_code||d.department_name||"",d.group_code||d.group_name||"",d.model||"",d.serial||"",d.status||"",d.funding||"",num(d.cost),extra];
}
function reportData(type){
  const devices = baseDeviceFilter([...RAW.devices]);
  const repairs = RAW.repairs.filter(r=>inRange(r.received_at||r.repair_date));
  const maints = RAW.maintenances.filter(r=>inRange(r.maintenance_date));
  const insps = RAW.inspections.filter(r=>inRange(r.inspection_date));
  const incs = RAW.incidents.filter(r=>inRange(r.incident_datetime));
  const dm = deviceMap();
  const latestMaint = latestByDevice(RAW.maintenances,"device_id","next_date");
  const latestInsp = latestByDevice(RAW.inspections,"device_id","next_date");
  const repairCount = new Map(); repairs.forEach(r=>repairCount.set(Number(r.device_id),(repairCount.get(Number(r.device_id))||0)+1));

  if(type==="assetOverview") return {columns:cols.summary, rows:[
    [1,"TB","Tổng thiết bị",devices.length,devices.reduce((s,d)=>s+num(d.cost),0),"Tất cả thiết bị trong phạm vi lọc"],
    [2,"HD","Đang hoạt động",devices.filter(d=>/hoạt động/i.test(d.status||"")).length,0,""],
    [3,"SC","Chờ/đang sửa chữa",devices.filter(d=>/sửa|chờ/i.test(d.status||"")).length,0,""],
    [4,"KD","Có lịch kiểm định",devices.filter(d=>latestInsp.has(Number(d.id))).length,0,""],
    [5,"BD","Có lịch bảo dưỡng",devices.filter(d=>latestMaint.has(Number(d.id))).length,0,""]
  ]};
  if(type==="devicesByDept") return {columns:cols.summary, rows:summarize(devices,d=>d.department_code||"Chưa rõ").map((r,i)=>[i+1,r.key,getDeptName(r.key),r.count,r.value,""])};
  if(type==="devicesByGroup") return {columns:cols.summary, rows:summarize(devices,d=>d.group_code||"Chưa rõ").map((r,i)=>[i+1,r.key,getGroupName(r.key),r.count,r.value,""])};
  if(type==="devicesByStatus") return {columns:cols.summary, rows:summarize(devices,d=>d.status||"Chưa xác định").map((r,i)=>[i+1,"",r.key,r.count,r.value,""])};
  if(type==="devicesByQuality") return {columns:cols.summary, rows:summarize(devices,d=>d.quality_level||d.quality||"Chưa phân cấp").map((r,i)=>[i+1,"",r.key,r.count,r.value,""])};
  if(type==="devicesByFunding") return {columns:cols.summary, rows:summarize(devices,d=>d.funding||"Chưa rõ").map((r,i)=>[i+1,"",r.key,r.count,r.value,""])};
  if(type==="devicesByAge") {
    const y=new Date().getFullYear();
    return {columns:cols.summary, rows:summarize(devices,d=>{const age=y-num(d.year_in_use||d.year_manufactured||y); return age<5?"< 5 năm":age<=10?"5 - 10 năm":"> 10 năm";}).map((r,i)=>[i+1,"",r.key,r.count,r.value,""])};
  }
  if(type==="devicesMissingInfo") {
    const rows=devices.filter(d=>!d.model||!d.serial||!d.department_code||!d.location).map((d,i)=>[i+1,d.device_code||"",d.name||"",d.department_code||"",d.model||"",d.serial||"",d.location||"",[!d.model&&"Thiếu Model",!d.serial&&"Thiếu Serial",!d.department_code&&"Thiếu khoa",!d.location&&"Thiếu vị trí"].filter(Boolean).join(", ")]);
    return {columns:["STT","Mã TB","Tên thiết bị","Khoa","Model","Serial Number","Vị trí","Thông tin còn thiếu"],rows};
  }
  if(type==="devicesNeedReplace") {
    const rows=devices.filter(d=>/ngừng|hạn chế|sửa|chờ/i.test(d.status||"") || (repairCount.get(Number(d.id))||0)>=2).map((d,i)=>[...rowDevice(d,i),`Sửa ${repairCount.get(Number(d.id))||0} lần`]);
    return {columns:[...cols.device,"Gợi ý"], rows};
  }
  if(type==="incidents") return {columns:cols.incident, rows:baseTextFilter(incs.map((r,i)=>[i+1,formatDateTimeVN(r.incident_datetime),r.device_code||"",r.device_name||"",r.department_code||r.department_name||"",r.description||"",r.reporter||"",r.status||"",r.note||r.file_name||""]))};
  if(type==="repairs") return {columns:cols.repair, rows:baseTextFilter(repairs.map((r,i)=>[i+1,formatDateTimeVN(r.received_at||r.repair_date),r.device_code||"",r.device_name||"",r.department_code||r.department_name||"",r.issue||r.cause||"",r.work||r.repair_content||"",r.person||r.handler||"",r.processing_status||"",num(r.cost),r.result||""]))};
  if(type==="openRepairs") return {columns:cols.repair, rows:baseTextFilter(repairs.filter(r=>!/hoàn thành|không sửa được|đã hủy/i.test(r.processing_status||"")).map((r,i)=>[i+1,formatDateTimeVN(r.received_at||r.repair_date),r.device_code||"",r.device_name||"",r.department_code||r.department_name||"",r.issue||r.cause||"",r.work||r.repair_content||"",r.person||r.handler||"",r.processing_status||"",num(r.cost),r.result||""]))};
  if(type==="repeatRepairs") {
    const counts=new Map(); repairs.forEach(r=>{const id=Number(r.device_id); counts.set(id,(counts.get(id)||0)+1)});
    const rows=devices.filter(d=>(counts.get(Number(d.id))||0)>=2).map((d,i)=>[i+1,d.device_code||"",d.name||"",d.department_code||"",counts.get(Number(d.id))||0,d.status||"","Cần đánh giá nguyên nhân tái diễn"]);
    return {columns:["STT","Mã TB","Tên thiết bị","Khoa","Số lần sửa chữa","Tình trạng","Ghi chú"],rows};
  }
  if(type==="repairCostByDept") return {columns:cols.summary, rows:summarize(repairs,r=>r.department_code||"Chưa rõ").map((r,i)=>[i+1,r.key,getDeptName(r.key),r.count,r.value,"Phiếu sửa chữa"])};
  if(type==="maintenances") return {columns:cols.maintenance, rows:baseTextFilter(maints.map((r,i)=>[i+1,formatDateTimeVN(r.maintenance_date),r.device_code||"",r.device_name||"",r.department_code||r.department_name||"",r.type||"",r.content||"",r.performer||r.vendor||"",r.result||"",formatDateVN(r.next_date),r.original_name||r.stored_name||""]))};
  if(type==="maintenanceDue") {
    const rows=devices.map(d=>({d,m:latestMaint.get(Number(d.id))})).filter(x=>x.m&&daysUntil(x.m.next_date)<=60).sort((a,b)=>(daysUntil(a.m.next_date)||0)-(daysUntil(b.m.next_date)||0)).map((x,i)=>[i+1,x.d.device_code,x.d.name,x.d.department_code,formatDateVN(x.m.maintenance_date),formatDateVN(x.m.next_date),dueLabel(x.m.next_date),x.m.type||""]);
    return {columns:cols.due, rows};
  }
  if(type==="inspections") return {columns:cols.inspection, rows:baseTextFilter(insps.map((r,i)=>[i+1,formatDateVN(r.inspection_date),r.device_code||"",r.device_name||"",r.department_code||r.department_name||"",r.type||"",r.organization||"",r.result||"",formatDateVN(r.next_date),r.file_note||r.original_name||""]))};
  if(type==="inspectionDue") {
    const rows=devices.map(d=>({d,m:latestInsp.get(Number(d.id))})).filter(x=>x.m&&daysUntil(x.m.next_date)<=60).sort((a,b)=>(daysUntil(a.m.next_date)||0)-(daysUntil(b.m.next_date)||0)).map((x,i)=>[i+1,x.d.device_code,x.d.name,x.d.department_code,formatDateVN(x.m.inspection_date),formatDateVN(x.m.next_date),dueLabel(x.m.next_date),x.m.organization||""]);
    return {columns:cols.due, rows};
  }
  if(type==="inventorySummary") return {columns:["STT","Mã/Tên vật tư","Đơn vị","Tồn kho","Tồn tối thiểu","Ghi chú"], rows:(RAW.spareParts||[]).map((r,i)=>[i+1,r.code||r.name||"",r.unit||"",r.quantity||r.stock||0,r.min_quantity||0,r.note||""])};
  if(type==="lowStock") return {columns:["STT","Mã/Tên vật tư","Đơn vị","Tồn kho","Tồn tối thiểu","Ghi chú"], rows:(RAW.spareParts||[]).filter(r=>num(r.quantity||r.stock)<=num(r.min_quantity||0)).map((r,i)=>[i+1,r.code||r.name||"",r.unit||"",r.quantity||r.stock||0,r.min_quantity||0,"Cần bổ sung"])};
  if(type==="inventoryCheck") return {columns:["STT","Mã vật tư","Tên vật tư","ĐVT","Số lượng sổ sách","Số lượng thực tế","Chênh lệch","Ghi chú"], rows:(RAW.spareParts||[]).map((r,i)=>[i+1,r.code||"",r.name||"",r.unit||"",r.quantity||r.stock||0,"","",r.note||""])};
  if(type==="materialsForRepair") return {columns:["STT","Mã/Tên vật tư","ĐVT","Tồn kho","Thiết bị/Phiếu liên quan","Ghi chú"], rows:(RAW.spareParts||[]).filter(r=>r.device_id||r.repair_id||/sửa/i.test(r.note||"")).map((r,i)=>[i+1,r.code||r.name||"",r.unit||"",r.quantity||r.stock||0,r.device_code||r.repair_code||"",r.note||""])};
  if(type==="inventoryByDept") return {columns:["STT","Mã TB","Tên thiết bị","Khoa","Vị trí","Tình trạng","Phân cấp chất lượng","Ghi chú"], rows:devices.map((d,i)=>[i+1,d.device_code||"",d.name||"",d.department_code||"",d.location||"",d.status||"",d.quality_level||d.quality||"Chưa phân cấp",""])};
  if(type==="inventoryQuality") return {columns:cols.summary, rows:summarize(devices,d=>d.quality_level||d.quality||"Chưa phân cấp").map((r,i)=>[i+1,"",r.key,r.count,r.value,""])};
  if(type==="inventoryMissingLocation") return {columns:["STT","Mã TB","Tên thiết bị","Khoa","Vị trí","Tình trạng","Ghi chú"], rows:devices.filter(d=>!String(d.location||"").trim()).map((d,i)=>[i+1,d.device_code||"",d.name||"",d.department_code||"","",d.status||"","Chưa cập nhật vị trí"])};
  if(type==="inventoryWrongLocation") return {columns:["STT","Mã TB","Tên thiết bị","Khoa theo hồ sơ","Vị trí theo hồ sơ","Vị trí kiểm kê","Ghi chú"], rows:[]};
  if(type==="inventoryRecommendRepair") return {columns:["STT","Mã TB","Tên thiết bị","Khoa","Tình trạng","Số lần sửa chữa","Đề nghị"], rows:devices.filter(d=>/hỏng|sửa|chờ/i.test(d.status||"")).map((d,i)=>[i+1,d.device_code||"",d.name||"",d.department_code||"",d.status||"",repairCount.get(Number(d.id))||0,"Đề nghị kiểm tra/sửa chữa"])};
  if(type==="deviceListTemplate") return {columns:cols.device, rows:devices.map(rowDevice)};
  if(type==="inventoryMinutes") return {columns:["STT","Khoa","Số thiết bị","Đang sử dụng","Chờ sửa chữa","Ngừng sử dụng","Ghi chú"], rows:summarize(devices,d=>d.department_code||"Chưa rõ").map((r,i)=>{const ds=devices.filter(d=>(d.department_code||"Chưa rõ")===r.key);return [i+1,`${r.key} - ${getDeptName(r.key)}`,ds.length,ds.filter(d=>/hoạt động/i.test(d.status||"")).length,ds.filter(d=>/sửa|chờ/i.test(d.status||"")).length,ds.filter(d=>/ngừng/i.test(d.status||"")).length,""]})};
  if(type==="cqySupplied") return {columns:cols.device, rows:devices.filter(d=>/quân|cục|cqy|quốc phòng/i.test(d.funding||"")).map(rowDevice)};
  if(type==="procurement") return {columns:["STT","Tên tài sản","Tháng/Năm sử dụng","Khoa sử dụng","Số lượng","Đơn giá","Thành tiền","Nguồn vốn"], rows:devices.map((d,i)=>[i+1,d.name,d.year_in_use||"",d.department_code||d.department_name||"",1,num(d.cost),num(d.cost),d.funding||""])};
  if(type==="annualUsage") {
    const rows=summarize(devices,d=>d.department_code||"Chưa rõ").map((r,i)=>{const ds=devices.filter(d=>(d.department_code||"Chưa rõ")===r.key); return [i+1,`${r.key} - ${getDeptName(r.key)}`,ds.length,ds.filter(d=>/hoạt động/i.test(d.status||"")).length,ds.filter(d=>/ngừng/i.test(d.status||"")).length,repairs.filter(x=>x.department_code===r.key).length,ds.filter(d=>latestInsp.has(Number(d.id))).length,ds.filter(d=>!latestInsp.has(Number(d.id))).length,""];});
    return {columns:cols.usage, rows};
  }
  if(type==="cssscd") return {columns:["STT","Danh mục","ĐVT","Số lượng quy định","Hiện có","Thiếu","Ghi chú"], rows:(RAW.spareParts||[]).map((r,i)=>[i+1,r.name||r.code||"",r.unit||"",r.min_quantity||0,r.quantity||r.stock||0,Math.max(0,num(r.min_quantity)-num(r.quantity||r.stock)),r.note||""])};
  return {columns:[], rows:[]};
}
function renderCards(){
  const devices=RAW.devices.length, repairs=RAW.repairs.length, maintDue=reportData("maintenanceDue").rows.length, inspDue=reportData("inspectionDue").rows.length;
  const cards=[["Tổng thiết bị",devices,"Hồ sơ thiết bị đang quản lý"],["Phiếu sửa chữa",repairs,"Lịch sử xử lý kỹ thuật"],["Đến hạn bảo dưỡng",maintDue,"Trong 60 ngày hoặc quá hạn"],["Đến hạn kiểm định",inspDue,"Trong 60 ngày hoặc quá hạn"]];
  q("reportCards").innerHTML=cards.map(([t,v,d])=>`<div class="report-kpi-card"><span>${t}</span><strong>${v}</strong><small>${d}</small></div>`).join("");
}
function renderReport(){
  const type=q("reportType").value; const group=q("reportGroup").value; const data=reportData(type); CURRENT=data.rows; CURRENT_COLUMNS=data.columns; CURRENT_TITLE=REPORT_GROUPS[group].reports[type]||"Báo cáo";
  q("countLabel").textContent=`${CURRENT_TITLE}: ${CURRENT.length} dòng`;
  q("reportHint").textContent=REPORT_HINTS[type]||"";
  q("reportBadge").textContent=REPORT_GROUPS[group].label;
  q("thead").innerHTML=`<tr>${data.columns.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
  q("rows").innerHTML=CURRENT.length?CURRENT.map((r)=>`<tr>${r.map((v,idx)=>`<td class="${typeof v==='number'&&idx>2?'num-cell':''}">${idx===6&&/hạn/.test(String(data.columns[idx]||'').toLowerCase())?`<span class="tag ${/Quá hạn/.test(String(v))?'red':/Còn/.test(String(v))?'yellow':''}">${esc(v)}</span>`:esc(typeof v==='number'&&idx>2?formatCurrency(v):v)}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${data.columns.length||1}" class="center-empty">Chưa có dữ liệu phù hợp.</td></tr>`;
}
function fillReportTypes(){
  const group=q("reportGroup").value; const reports=REPORT_GROUPS[group].reports;
  q("reportType").innerHTML=Object.entries(reports).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("");
}
function clearFilters(){q("searchInput").value="";q("deptFilter").value="ALL";q("groupFilter").value="ALL";setDefaultDateRange();renderReport();}
function reportTypeForA4(type){
  const map={
    assetOverview:'devices', devicesByDept:'annualUsage', devicesByGroup:'devices', devicesByStatus:'devices', devicesByFunding:'devices', devicesByQuality:'devices', devicesByAge:'devices', devicesMissingInfo:'devices',
    incidents:'incidents', repairs:'repairs', openRepairs:'repairs', repeatRepairs:'repairs', repairCostByDept:'repairs', maintenances:'maintenances', maintenanceDue:'maintenances', inspections:'inspections', inspectionDue:'inspections',
    inventorySummary:'inventorySummary', lowStock:'inventorySummary', inventoryCheck:'inventoryCheck', materialsForRepair:'inventorySummary',
    inventoryByDept:'annualUsage', inventoryQuality:'annualUsage', inventoryMissingLocation:'devices', inventoryWrongLocation:'devices', inventoryRecommendRepair:'devices', devicesNeedReplace:'devices',
    deviceListTemplate:'devices', annualUsage:'annualUsage', cqySupplied:'devices', procurement:'devices', cssscd:'inventorySummary', inventoryMinutes:'annualUsage'
  };
  return map[type]||type||'incidents';
}
function exportExcel(){
  const type=reportTypeForA4(q('reportType').value);
  const params=new URLSearchParams({
    type,
    from:q('fromDate').value||firstDayOfYearISO(),
    to:q('toDate').value||todayISO(),
    dept:q('deptFilter').value||'ALL',
    group:q('groupFilter').value||'ALL'
  });
  window.location.href=`/api/reports/export-a4?${params.toString()}`;
}
function exportAll(){
  const wb=XLSX.utils.book_new();
  Object.values(REPORT_GROUPS).forEach(g=>Object.entries(g.reports).forEach(([k,name])=>{const d=reportData(k); const rows=d.rows.map(r=>Object.fromEntries(d.columns.map((c,i)=>[c,r[i]]))); const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{"Thông báo":"Chưa có dữ liệu"}]); XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));}));
  XLSX.writeFile(wb,`so_tong_hop_bao_cao_QY4_${new Date().toISOString().slice(0,10)}.xlsx`);
}
async function load(){
  META=await api('/api/meta');
  const safe=async (url)=>{try{return await api(url)}catch{return []}};
  const [devices,repairs,maintenances,inspections,incidents,spareParts]=await Promise.all([safe('/api/devices'),safe('/api/repairs'),safe('/api/maintenances'),safe('/api/inspections'),safe('/api/incidents'),safe('/api/spare-parts')]);
  RAW={devices,repairs,maintenances,inspections,incidents,spareParts};
  q('deptFilter').innerHTML='<option value="ALL">Tất cả khoa/phòng</option>'+(META.departments||[]).map(d=>`<option value="${d.code}">${d.code} - ${esc(d.name)}</option>`).join('');
  q('groupFilter').innerHTML='<option value="ALL">Tất cả nhóm</option>'+(META.groups||[]).map(g=>`<option value="${g.code}">${g.code} - ${esc(g.name)}</option>`).join('');
  renderCards(); renderReport();
}
document.addEventListener('DOMContentLoaded', async()=>{
  setLayout('reports','Báo cáo','Báo cáo thống kê trang thiết bị y tế');
  setDefaultDateRange();
  q('reportGroup').innerHTML=Object.entries(REPORT_GROUPS).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('');
  fillReportTypes();
  await load();
  q('reportGroup').addEventListener('change',()=>{fillReportTypes();renderReport();});
  ['reportType','deptFilter','groupFilter','fromDate','toDate','searchInput'].forEach(id=>{q(id).addEventListener('input',renderReport);q(id).addEventListener('change',renderReport);});
  q('filterBtn').onclick=renderReport; q('clearFilterBtn').onclick=clearFilters; if(q('exportBtn')) q('exportBtn').onclick=exportExcel; if(q('exportBottomBtn')) q('exportBottomBtn').onclick=exportExcel; if(q('exportAllBtn')) q('exportAllBtn').onclick=exportAll; if(q('refreshBtn')) q('refreshBtn').onclick=load; if(q('printBtn')) q('printBtn').onclick=()=>window.print();
});

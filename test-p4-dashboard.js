const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('public/dashboard.js', 'utf8');
new Function(source);

class El {
  constructor() { this.textContent=''; this.innerHTML=''; this.parentElement={ querySelector:()=>({textContent:''}) }; }
}

async function runDashboard(user) {
  const nodes = new Map();
  const q = id => { if(!nodes.has(id)) nodes.set(id,new El()); return nodes.get(id); };
  const calls=[];
  let handler=null;
  const api = async url => {
    calls.push(url);
    if(url === '/api/auth/me') return { user };
    if(url === '/api/devices') return [
      {id:1,status:'Đang hoạt động',department_code:user.department_code||'C2'},
      {id:2,status:'Chờ sửa chữa',department_code:user.department_code||'C2'},
      {id:3,status:'Ngừng hoạt động',department_code:user.department_code||'C2'}
    ];
    if(url === '/api/incidents') return [
      {id:1,status:'Mới báo'},
      {id:2,status:'Đã chuyển sửa chữa'}
    ];
    if(url === '/api/leadership-dashboard') return { total:3, active:1, openRepairs:1, repairCost:1000, openIncidents:1, dueMaint:0, overdueMaint:0, dueInspections:0, overdueInspections:0, alerts:[], byDept:[], byStatus:[] };
    if(url.startsWith('/api/checks?')) return [];
    if(url.startsWith('/api/maintenances?')) return [];
    if(url.startsWith('/api/inspections?')) return [];
    throw new Error('API không mong đợi: '+url);
  };
  const context=vm.createContext({
    console,
    document:{addEventListener:(name,fn)=>{ if(name==='DOMContentLoaded') handler=fn; }},
    window:{__QY4_CURRENT_USER:user},
    q,
    api,
    setLayout:()=>{},
    formatCurrency:v=>`${v} đ`,
    Date,
    String,
    Math,
    Map,
    Promise
  });
  vm.runInContext(source,context);
  assert.ok(handler,'Dashboard phải đăng ký DOMContentLoaded.');
  await handler();
  return {nodes,calls};
}

(async()=>{
  const dept=await runDashboard({role:'Người dùng khoa',department_code:'C2'});
  assert.deepStrictEqual(dept.calls,['/api/auth/me','/api/devices','/api/incidents'],'Tài khoản khoa chỉ được gọi API đọc đã được P2 cho phép.');
  assert.strictEqual(dept.nodes.get('dbTotal').textContent,3);
  assert.strictEqual(dept.nodes.get('dbActive').textContent,1);
  assert.strictEqual(dept.nodes.get('dbWaitingRepair').textContent,1);
  assert.strictEqual(dept.nodes.get('dbStopped').textContent,1);
  assert.strictEqual(dept.nodes.get('dbOpenIncidents').textContent,1);
  assert.strictEqual(dept.nodes.get('dbDueMaint').textContent,'—');
  assert.ok(dept.nodes.get('alertsList').innerHTML.includes('Khoa Trang bị'),'Dashboard khoa phải giải thích phần kỹ thuật bị giới hạn thay vì lỗi 403 trắng trang.');

  const tech=await runDashboard({role:'Kỹ sư Trang bị',department_code:'TB'});
  assert.ok(tech.calls.includes('/api/leadership-dashboard'),'Kỹ sư phải vẫn nhận dashboard toàn viện.');
  assert.ok(tech.calls.some(x=>x.startsWith('/api/checks?')),'Kỹ sư phải vẫn nhận dữ liệu kiểm tra QR.');
  assert.ok(tech.calls.some(x=>x.startsWith('/api/maintenances?')),'Kỹ sư phải vẫn nhận dữ liệu bảo dưỡng.');
  assert.ok(tech.calls.some(x=>x.startsWith('/api/inspections?')),'Kỹ sư phải vẫn nhận dữ liệu kiểm định.');

  console.log('[P4 DASHBOARD] PASS - dashboard tự chọn tập API đúng theo vai trò, không còn 403 hàng loạt với tài khoản khoa.');
})().catch(err=>{console.error(err);process.exit(1);});

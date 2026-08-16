const assert = require('assert');
const { attach } = require('./p2-scope-guard');

function makeDb() {
  return {
    pragma() {},
    prepare(sql) {
      return {
        get() {
          if (String(sql).includes('FROM devices')) return { department_code:'C2' };
          if (String(sql).includes('FROM incidents')) return { department_code:'C2' };
          return null;
        }
      };
    }
  };
}
function Database() { return makeDb(); }

let middleware = null;
const app = { use(prefix, fn) { assert.strictEqual(prefix, '/api'); middleware = fn; } };
const deptUser = { id:10, role:'Người dùng khoa', department_code:'C2' };
attach({ app, Database, dbPath:'ignored.sqlite', getUser:()=>deptUser, isTech:()=>false });
assert.ok(middleware, 'Phải đăng ký middleware scope.');

function run(path, payload) {
  let sent;
  let statusCode=200;
  const req = { method:'GET', path };
  const res = {
    status(code){ statusCode=code; return this; },
    json(data){ sent=data; return data; }
  };
  let nextCalled=false;
  middleware(req,res,()=>{ nextCalled=true; });
  if(nextCalled) res.json(payload);
  return {sent,statusCode,nextCalled};
}

const detailPayload = {
  id:1,
  department_code:'C2',
  name:'Máy C2',
  accessories:[{id:1,name:'Phụ kiện'}],
  incidents:[{id:1,description:'Lỗi'}],
  repairs:[{id:1,cost:1000000,work:'Thay bo'}],
  maintenances:[{id:2,content:'Bảo dưỡng'}],
  inspections:[{id:3,certificate_no:'KD-01'}],
  operation_logs:[{id:4,note:'Nội bộ'}],
  documents:[{id:5,file_path:'/uploads/documents/a.pdf'}]
};
const detail = run('/devices/1', detailPayload);
assert.strictEqual(detail.statusCode,200);
assert.strictEqual(detail.nextCalled,true);
assert.deepStrictEqual(detail.sent.repairs,[],'Tài khoản khoa không được đọc sửa chữa qua endpoint chi tiết thiết bị.');
assert.deepStrictEqual(detail.sent.maintenances,[],'Tài khoản khoa không được đọc bảo dưỡng qua endpoint chi tiết thiết bị.');
assert.deepStrictEqual(detail.sent.inspections,[],'Tài khoản khoa không được đọc kiểm định qua endpoint chi tiết thiết bị.');
assert.deepStrictEqual(detail.sent.operation_logs,[],'Tài khoản khoa không được đọc nhật ký vận hành kỹ thuật qua endpoint chi tiết thiết bị.');
assert.deepStrictEqual(detail.sent.documents,[],'Tài khoản khoa không được đọc tài liệu kỹ thuật qua endpoint chi tiết thiết bị.');
assert.strictEqual(detail.sent.accessories.length,1,'Thông tin phụ kiện thuộc hồ sơ thiết bị vẫn được xem read-only.');
assert.strictEqual(detail.sent.incidents.length,1,'Sự cố của thiết bị thuộc khoa vẫn được xem.');

const list = run('/devices', [
  {id:1,department_code:'C2'},
  {id:2,department_code:'A10'}
]);
assert.deepStrictEqual(list.sent.map(x=>x.id),[1],'Danh sách thiết bị vẫn phải lọc theo khoa.');

// Nếu scope khác khoa, middleware phải chặn trước route.
function DatabaseOther() {
  return { pragma(){}, prepare(){ return { get(){ return { department_code:'A10' }; } }; } };
}
let denyMw=null;
attach({ app:{use(_p,fn){denyMw=fn;}}, Database:DatabaseOther, dbPath:'x', getUser:()=>deptUser, isTech:()=>false });
let denied;
const denyRes={ status(code){ this.code=code; return this; }, json(data){ denied={code:this.code,data}; return data; } };
denyMw({method:'GET',path:'/devices/2'},denyRes,()=>{throw new Error('Không được next khi khác khoa');});
assert.strictEqual(denied.code,403,'Thiết bị khoa khác phải bị chặn 403.');

console.log('[P4 SCOPE] PASS - endpoint chi tiết thiết bị không còn làm đường vòng đọc hồ sơ kỹ thuật của tài khoản khoa.');

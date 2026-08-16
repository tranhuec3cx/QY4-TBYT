const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('public/p2-auth-client.js', 'utf8');
new Function(source);

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.style = {};
    this.attrs = {};
    this.innerHTML = '';
    this.textContent = '';
    this.children = [];
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  appendChild(el) { this.children.push(el); }
  remove() { this.removed = true; }
  cloneNode() { const x = new FakeElement(this.id); x.dataset = {}; return x; }
  replaceWith() {}
}

async function runRoleUi(pathname) {
  const ids = new Map();
  const get = id => {
    if (!ids.has(id)) { const el = new FakeElement(id); el.dataset = {}; ids.set(id, el); }
    return ids.get(id);
  };
  const topAdd = new FakeElement('topAdd');
  const editDevice = new FakeElement('editDevice');
  const deleteDevice = new FakeElement('deleteDevice');
  const transfer = new FakeElement('transfer');
  const openRepair = new FakeElement('openRepair');
  const detailEdit = new FakeElement('detailEdit');
  const detailDelete = new FakeElement('detailDelete');
  const inspectionLink = new FakeElement('inspectionLink');
  const userBox = new FakeElement('userBox');
  const footer = new FakeElement('footer');
  const topbar = new FakeElement('topbar');

  const doc = {
    readyState: 'complete',
    documentElement: { dataset: {} },
    body: new FakeElement('body'),
    addEventListener() {},
    getElementById(id) {
      if (id === 'p2LogoutBtn') return null;
      return get(id);
    },
    querySelector(selector) {
      if (selector === '.sidebar-footer') return footer;
      if (selector === '.topbar .page-actions' || selector === '.topbar') return topbar;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.user-box') return [userBox];
      if (selector === '.menu a') return [];
      if (selector.includes('formCard') || selector.includes('editDevice') || selector.includes('deleteDevice')) return [topAdd, editDevice, deleteDevice];
      if (selector.includes('transferToRepair') || selector.includes('openLinkedRepair') || selector.includes('exportIncidentExcelBtn')) return [transfer, openRepair, get('exportIncidentExcelBtn')];
      if (selector.includes('#accessoryRows') || selector.includes('#maintRows') || selector.includes('#inspectionRows') || selector.includes('#opRows') || selector.includes('#docRows') || selector.includes('a.btn[href="/inspections.html"]')) return [detailEdit, detailDelete, inspectionLink];
      return [];
    }
  };

  const context = vm.createContext({
    console,
    document: doc,
    window: null,
    URL,
    FormData,
    queueMicrotask,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    MutationObserver: class MutationObserver { constructor(cb) { this.cb = cb; } observe() {} },
    alert() {},
    setTimeout,
    clearTimeout
  });
  context.window = {
    fetch: async url => {
      if (String(url).includes('/api/auth/me')) {
        return { ok:true, status:200, json:async()=>({ user:{ id:7, full_name:'Điều dưỡng C2', username:'c2', role:'Người dùng khoa', department_code:'C2', must_change_password:0 } }) };
      }
      return { ok:true, status:200, json:async()=>({}) };
    },
    location: { pathname, search:'', origin:'http://localhost:5000', href:'' },
    dispatchEvent() {},
    __QY4_CURRENT_USER: null
  };

  vm.runInContext(source, context);
  await new Promise(resolve => setTimeout(resolve, 10));
  return { context, get, topAdd, editDevice, deleteDevice, transfer, openRepair, detailEdit, detailDelete, inspectionLink };
}

(async () => {
  const index = await runRoleUi('/index.html');
  assert.strictEqual(index.context.window.__QY4_CAN_WRITE, false, 'Tài khoản khoa phải được đánh dấu read-only ngoài nghiệp vụ sự cố.');
  assert.strictEqual(index.get('formCard').hidden, true, 'Form thêm/cập nhật thiết bị phải ẩn với tài khoản khoa.');
  assert.strictEqual(index.get('exportExcelBtn').hidden, true, 'Xuất báo cáo thiết bị không được hiển thị nếu API không cho tài khoản khoa.');
  assert.ok(index.editDevice.hidden && index.deleteDevice.hidden, 'Nút cập nhật/xóa thiết bị phải ẩn với tài khoản khoa.');

  const tickets = await runRoleUi('/tickets.html');
  assert.ok(tickets.transfer.hidden && tickets.openRepair.hidden, 'Tài khoản khoa không được thấy thao tác chuyển/mở phiếu sửa chữa.');
  assert.strictEqual(tickets.get('exportIncidentExcelBtn').hidden, true, 'Xuất báo cáo sự cố phải ẩn nếu API không cho tài khoản khoa.');
  assert.strictEqual(tickets.get('newIncidentBtn').hidden, false, 'Tài khoản khoa vẫn phải được báo sự cố.');

  const detail = await runRoleUi('/device-detail.html');
  ['editGeneralBtn','toggleAccessoryBtn','toggleRepairBtn','toggleMaintBtn','toggleOpBtn','toggleDocBtn'].forEach(id => {
    assert.strictEqual(detail.get(id).hidden, true, `${id} phải ẩn trên hồ sơ read-only của tài khoản khoa.`);
  });
  assert.ok(detail.detailEdit.hidden && detail.detailDelete.hidden && detail.inspectionLink.hidden, 'Các thao tác ghi động trong hồ sơ máy phải ẩn với tài khoản khoa.');

  console.log('[P4 ROLE] PASS - tài khoản khoa chỉ xem thiết bị/hồ sơ và báo sự cố; UI không mời gọi các thao tác backend sẽ từ chối.');
})().catch(err => { console.error(err); process.exit(1); });

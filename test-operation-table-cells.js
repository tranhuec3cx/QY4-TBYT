const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('public/operation-table-cells.js','utf8');
const styles = fs.readFileSync('public/styles.css','utf8');
const pages = ['tickets.html','maintenance.html','inspection.html','inspections.html'];

const ctx = vm.createContext({ window:{} });
vm.runInContext(source, ctx);
const cells = ctx.window.QY4OperationCells;
assert.ok(cells, 'Phải có renderer bảng nghiệp vụ dùng chung.');

const time = cells.time('2026-09-18 10:20:00');
assert.ok(time.includes('18/09/2026') && time.includes('10:20'), 'Thời gian phải tách ngày và giờ thành hai dòng.');

const device = cells.device(
  { device_name:'<img src=x>', device_code:'C1.ĐT.0001' },
  { model:'ECG-2350', manufacturer:'Nihon Kohden' }
);
assert.ok(device.includes('&lt;img'), 'Tên thiết bị phải được escape.');
assert.ok(device.includes('Model:') && device.includes('Hãng:') && device.includes('Mã TB:'), 'Ô Thiết bị phải có Tên, Model, Hãng, Mã TB.');

const dept = cells.departmentLocation({ department_code:'C1', location:'Phòng khám tim mạch' });
assert.ok(dept.includes('C1') && dept.includes('Phòng khám tim mạch'), 'Ô Khoa/Vị trí phải có mã khoa và vị trí.');

pages.forEach(name => {
  const html = fs.readFileSync('public/' + name,'utf8');
  assert.ok(html.includes('/operation-table-cells.js'), name + ' phải nạp renderer chung.');
  assert.ok(html.includes('operation-table'), name + ' phải dùng style bảng nghiệp vụ chung.');
  assert.ok(!html.includes('</script>\\n'), name + ' không được chứa ký tự \\n dạng text giữa các script.');
});

const ticketsHtml = fs.readFileSync('public/tickets.html','utf8');
assert.ok(ticketsHtml.includes('class="col-op-device">Thiết bị</th>'), 'Sự cố phải gộp Mã/Tên thiết bị thành cột Thiết bị.');
assert.ok(ticketsHtml.includes('class="col-op-dept">Khoa / Vị trí</th>'), 'Sự cố phải dùng cột Khoa / Vị trí.');
assert.ok(!ticketsHtml.includes('<th>Mã thiết bị</th><th>Tên thiết bị</th><th>Vị trí</th>'), 'Sự cố không được quay lại header tách 3 cột cũ.');
['tickets.js','maintenance.js','inspection.js','inspections.js'].forEach(name => {
  const js = fs.readFileSync('public/' + name,'utf8');
  new Function(js);
  assert.ok(js.includes('QY4OperationCells.time'), name + ' phải dùng ô Thời gian chung.');
  assert.ok(js.includes('QY4OperationCells.device'), name + ' phải dùng ô Thiết bị chung.');
  assert.ok(js.includes('QY4OperationCells.departmentLocation'), name + ' phải dùng ô Khoa/Vị trí chung.');
});
assert.ok(styles.includes('.op-time-cell') && styles.includes('.op-device-cell') && styles.includes('.op-dept-cell'), 'CSS phải có đủ 3 nhóm ô chuẩn.');

console.log('[OPERATION TABLE CELLS] PASS - 4 tab dùng chung Thời gian, Thiết bị, Khoa/Vị trí.');


const incidentCss = fs.readFileSync('public/styles.css','utf8');
assert.ok(incidentCss.includes('.incident-table-v2 .col-op-dept') && incidentCss.includes('width:135px!important'), 'Sự cố phải thu hẹp cột Khoa/Vị trí.');
assert.ok(incidentCss.includes('.incident-table-v2 th:nth-child(5)') && incidentCss.includes('min-width:320px'), 'Sự cố phải ưu tiên chiều rộng cho Mô tả sự cố.');

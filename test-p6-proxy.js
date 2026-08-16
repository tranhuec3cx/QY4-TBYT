const assert = require('assert');
const express = require('express');
const { trustProxySetting } = require('./proxy-config');

assert.strictEqual(trustProxySetting(undefined), false);
assert.strictEqual(trustProxySetting(''), false);
assert.strictEqual(trustProxySetting('false'), false);
assert.strictEqual(trustProxySetting('0'), false);
assert.strictEqual(trustProxySetting('true'), true);
assert.strictEqual(trustProxySetting('1'), 1);
assert.strictEqual(trustProxySetting('2'), 2);
assert.strictEqual(trustProxySetting('loopback'), 'loopback');

async function requestIp(setting, forwardedFor) {
  const app = express();
  app.set('trust proxy', setting);
  app.get('/ip', (req, res) => res.json({ ip:req.ip, ips:req.ips }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/ip`, { headers:{ 'X-Forwarded-For':forwardedFor } });
    return await res.json();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

(async () => {
  const spoof = '203.0.113.99';
  const safe = await requestIp(trustProxySetting(undefined), spoof);
  assert.notStrictEqual(safe.ip, spoof, 'Mặc định phải bỏ qua X-Forwarded-For do client tự gửi.');
  assert.deepStrictEqual(safe.ips, [], 'Mặc định không được coi X-Forwarded-For là chuỗi proxy tin cậy.');

  const explicit = await requestIp(trustProxySetting('true'), spoof);
  assert.strictEqual(explicit.ip, spoof, 'Chỉ khi quản trị cấu hình TRUST_PROXY thì Express mới được tin X-Forwarded-For.');

  const startSource = require('fs').readFileSync('p3-start.js','utf8');
  assert.ok(startSource.includes('require("./proxy-config").trustProxySetting(process.env.TRUST_PROXY)'), 'Runtime phải thay trust proxy=true cũ bằng cấu hình P6.');

  console.log('[P6 PROXY] PASS - mặc định không tin X-Forwarded-For; proxy chỉ bật khi cấu hình rõ ràng.');
})().catch(err => { console.error(err); process.exit(1); });

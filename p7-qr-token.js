const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = 'qy4-qr-v1';

function normalizeKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (value === 'id' || value === 'code') return value;
  throw new Error('Loại khóa QR không hợp lệ.');
}

function normalizeKey(kind, key) {
  const k = normalizeKind(kind);
  const value = String(key ?? '').trim();
  if (!value) throw new Error('Thiếu khóa thiết bị QR.');
  if (value.length > 160) throw new Error('Khóa thiết bị QR quá dài.');
  if (k === 'id' && !/^\d+$/.test(value)) throw new Error('ID thiết bị QR không hợp lệ.');
  return value;
}

function secretFilePath(dbPath) {
  return path.join(path.dirname(dbPath), 'qr-signing-secret');
}

function validateSecret(secret, sourceLabel) {
  const value = String(secret || '').trim();
  if (value.length < 32) {
    throw new Error(`${sourceLabel} phải có ít nhất 32 ký tự để ký QR an toàn.`);
  }
  return value;
}

function getOrCreateSecret(dbPath) {
  const configured = String(process.env.QR_SIGNING_SECRET || '').trim();
  if (configured) return validateSecret(configured, 'QR_SIGNING_SECRET');

  const filePath = secretFilePath(dbPath);
  if (fs.existsSync(filePath)) {
    return validateSecret(fs.readFileSync(filePath, 'utf8'), 'Khóa QR cục bộ');
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const generated = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(filePath, `${generated}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try { fs.chmodSync(filePath, 0o600); } catch {}
  console.log('[P7 QR] Đã tạo khóa ký QR cục bộ tại db/qr-signing-secret. Hãy sao lưu cùng dữ liệu DB; mất khóa sẽ phải in lại QR.');
  return generated;
}

function canonical(kind, key) {
  const k = normalizeKind(kind);
  const value = normalizeKey(k, key);
  return `${VERSION}:${k}:${value}`;
}

function signQrKey(dbPath, kind, key) {
  const message = canonical(kind, key);
  const secret = getOrCreateSecret(dbPath);
  return crypto.createHmac('sha256', secret).update(message).digest('base64url');
}

function verifyQrKey(dbPath, kind, key, token) {
  try {
    const supplied = String(token || '').trim();
    if (!supplied || supplied.length > 128) return false;
    const expected = signQrKey(dbPath, kind, key);
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  VERSION,
  normalizeKind,
  normalizeKey,
  getOrCreateSecret,
  signQrKey,
  verifyQrKey
};

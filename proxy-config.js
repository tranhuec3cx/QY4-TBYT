function trustProxySetting(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /^(false|0|off|no)$/i.test(value)) return false;
  if (/^(true|on|yes)$/i.test(value)) return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

module.exports = { trustProxySetting };

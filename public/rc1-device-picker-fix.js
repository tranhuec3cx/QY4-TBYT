(function () {
  "use strict";

  function normalize(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function devicesList() {
    try {
      if (typeof DEVICES !== "undefined" && Array.isArray(DEVICES)) return DEVICES;
    } catch (_) {}
    return [];
  }

  function labelFor(device) {
    if (!device) return "";
    try {
      if (typeof deviceSearchLabel === "function") return deviceSearchLabel(device);
    } catch (_) {}
    const extra = [device.model, device.serial].filter(Boolean).join(" • ");
    return `${device.device_code || device.serial || "TB-" + device.id} - ${device.name || ""}${extra ? " (" + extra + ")" : ""}`;
  }

  function findExactDevice(value) {
    const wanted = normalize(value);
    if (!wanted) return null;
    return devicesList().find(device => normalize(labelFor(device)) === wanted) || null;
  }

  function fillRelatedFields() {
    try {
      if (typeof fillMaintDeviceInfo === "function") { fillMaintDeviceInfo(); return; }
    } catch (_) {}
    try {
      if (typeof fillInfo === "function") fillInfo();
    } catch (_) {}
  }

  function syncSelection(rewriteLabel) {
    const input = document.getElementById("deviceSearch");
    const hidden = document.getElementById("deviceId");
    if (!input || !hidden) return null;

    const found = findExactDevice(input.value);
    hidden.value = found ? found.id : "";
    if (found && rewriteLabel) input.value = labelFor(found);
    fillRelatedFields();
    input.classList.toggle("device-picker-invalid", Boolean(input.value.trim()) && !found);
    return found;
  }

  function commitDeviceSelection() {
    return syncSelection(true);
  }

  function attach() {
    const input = document.getElementById("deviceSearch");
    if (!input || input.dataset.rc1PickerFix === "1") return;
    input.dataset.rc1PickerFix = "1";

    // Khi đang gõ chỉ xóa lựa chọn cũ; không tự lấy kết quả đầu tiên và đóng datalist.
    input.addEventListener("input", () => syncSelection(false));
    input.addEventListener("change", commitDeviceSelection);
    input.addEventListener("blur", () => setTimeout(commitDeviceSelection, 80));
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") setTimeout(commitDeviceSelection, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
  else attach();
})();

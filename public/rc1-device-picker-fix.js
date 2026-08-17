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

  function genericFind(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const nv = normalize(raw);
    const list = devicesList();
    return list.find(d => normalize(labelFor(d)) === nv)
      || list.find(d => normalize([d.device_code, d.name, d.model, d.serial, d.insurance_code, d.department_code, d.department_name].filter(Boolean).join(" ")).includes(nv));
  }

  function fillRelatedFields() {
    try {
      if (typeof fillMaintDeviceInfo === "function") { fillMaintDeviceInfo(); return; }
    } catch (_) {}
    try {
      if (typeof fillInfo === "function") fillInfo();
    } catch (_) {}
  }

  function commitDeviceSelection() {
    const input = document.getElementById("deviceSearch");
    const hidden = document.getElementById("deviceId");
    if (!input || !hidden) return null;

    let found = null;
    try {
      if (typeof findDeviceBySearch === "function") found = findDeviceBySearch(input.value);
    } catch (_) {}
    if (!found) {
      try {
        if (typeof resolveMaintDevice === "function") found = resolveMaintDevice();
      } catch (_) {}
    }
    if (!found) found = genericFind(input.value);

    if (found) {
      hidden.value = found.id;
      input.value = labelFor(found);
      fillRelatedFields();
      input.classList.remove("device-picker-invalid");
      return found;
    }

    if (!String(input.value || "").trim()) {
      hidden.value = "";
      fillRelatedFields();
      input.classList.remove("device-picker-invalid");
    }
    return null;
  }

  function attach() {
    const input = document.getElementById("deviceSearch");
    if (!input || input.dataset.rc1PickerFix === "1") return;
    input.dataset.rc1PickerFix = "1";

    input.addEventListener("input", () => setTimeout(commitDeviceSelection, 0));
    input.addEventListener("change", commitDeviceSelection);
    input.addEventListener("blur", () => setTimeout(commitDeviceSelection, 80));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") setTimeout(commitDeviceSelection, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
  else attach();
})();

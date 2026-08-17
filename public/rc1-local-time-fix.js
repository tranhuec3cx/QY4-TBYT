(function () {
  "use strict";

  function localNowDateTimeInputValue() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function setRepairActionTimeToLocalNow() {
    const el = document.getElementById("actionTime");
    if (el) el.value = localNowDateTimeInputValue();
  }

  const originalResetRepairForm = window.resetRepairForm;
  if (typeof originalResetRepairForm === "function") {
    window.resetRepairForm = function (...args) {
      const result = originalResetRepairForm.apply(this, args);
      setRepairActionTimeToLocalNow();
      return result;
    };
  }

  const originalEditRepair = window.editRepair;
  if (typeof originalEditRepair === "function") {
    window.editRepair = function (...args) {
      const result = originalEditRepair.apply(this, args);
      setRepairActionTimeToLocalNow();
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", setRepairActionTimeToLocalNow);
})();

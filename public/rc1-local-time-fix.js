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

  function normalizeTerminalStatus(value) {
    const raw = String(value || "").trim();
    if (["Đã sửa xong", "Bàn giao sử dụng", "Hoàn thành"].includes(raw)) return "Đã hoàn thành";
    if (["Hủy", "Huỷ", "Đã huỷ"].includes(raw)) return "Đã hủy";
    return raw;
  }

  function isTerminalStatus(value) {
    return ["Đã hoàn thành", "Không sửa được", "Đã hủy"].includes(normalizeTerminalStatus(value));
  }

  function removeTerminalCancelButtons() {
    document.querySelectorAll('#rows tr').forEach(row => {
      const statusText = Array.from(row.querySelectorAll('.tag')).map(x => String(x.textContent || '').trim()).find(x => isTerminalStatus(x));
      if (!statusText) return;
      row.querySelectorAll('button').forEach(btn => {
        if (/hủy phiếu/i.test(String(btn.textContent || ''))) btn.remove();
      });
    });
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

  const originalDeleteRepair = window.deleteRepair;
  if (typeof originalDeleteRepair === "function") {
    window.deleteRepair = async function (id) {
      try {
        const row = typeof REPAIR_ROWS !== "undefined" && Array.isArray(REPAIR_ROWS)
          ? REPAIR_ROWS.find(x => Number(x.id) === Number(id))
          : null;
        if (row && isTerminalStatus(row.processing_status)) {
          alert("Phiếu đã kết thúc nên không thể hủy trực tiếp. Nếu cần điều chỉnh, hãy bổ sung/cập nhật hồ sơ để bảo toàn lịch sử thiết bị.");
          return;
        }
      } catch (_) {}
      return originalDeleteRepair.apply(this, arguments);
    };
  }

  function attachTerminalObserver() {
    const rows = document.getElementById("rows");
    if (!rows || rows.dataset.rc1TerminalGuard === "1") return;
    rows.dataset.rc1TerminalGuard = "1";
    const observer = new MutationObserver(removeTerminalCancelButtons);
    observer.observe(rows, { childList: true, subtree: true });
    removeTerminalCancelButtons();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setRepairActionTimeToLocalNow();
    attachTerminalObserver();
  });
})();

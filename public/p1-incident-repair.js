(() => {
  function currentPage() {
    const parts = String(window.location.pathname || "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "index.html";
  }

  function addOptionIfMissing(select, value, label = value) {
    if (!select) return;
    const exists = Array.from(select.options || []).some(o => o.value === value || o.textContent === label);
    if (!exists) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = currentPage();

    if (page === "tickets.html") {
      // P1-1: Frontend dùng đúng 3 trạng thái nghiệp vụ của sự cố.
      if (typeof normalizeIncidentStatus === "function") {
        normalizeIncidentStatus = function(status, linkedRepairId) {
          const raw = String(status || "").trim();
          if (linkedRepairId || ["Đã chuyển sửa chữa", "Chuyển sửa chữa", "Chờ linh kiện", "Đang sửa chữa", "Đang kiểm tra", "Đã sửa xong", "Bàn giao sử dụng", "Đã hoàn thành"].includes(raw)) {
            return "Đã chuyển sửa chữa";
          }
          if (["Đã xử lý tại chỗ", "Đã xử lý", "Đóng", "Không cần sửa chữa"].includes(raw)) {
            return "Đã xử lý tại chỗ";
          }
          return "Mới báo";
        };
      }

      if (typeof statusClass === "function") {
        statusClass = function(value) {
          if (value === "Đã chuyển sửa chữa") return "green";
          if (value === "Đã xử lý tại chỗ") return "blue";
          if (value === "Mới báo" || value === "Mới ghi nhận") return "yellow";
          return "gray";
        };
      }

      // P1-2: Sự cố mới có 2 hướng xử lý rõ ràng: chuyển sửa chữa hoặc xử lý tại chỗ.
      if (typeof incidentActions === "function") {
        incidentActions = function(r) {
          const id = Number(r.id);
          const deviceId = Number(r.device_id);
          const actions = [`<button class="btn btn-secondary" onclick="openDeviceProfile(${deviceId})">Xem HS</button>`];
          if (r.status === "Mới báo" || r.status === "Mới ghi nhận") {
            actions.push(`<button class="btn btn-primary" onclick="transferToRepair(${id})">Chuyển SC</button>`);
            actions.push(`<button class="btn" onclick="markOnsite(${id})">Xử lý tại chỗ</button>`);
          } else if (r.status === "Đã chuyển sửa chữa") {
            actions.push(`<button class="btn btn-primary" onclick="openLinkedRepair(${id})">Mở phiếu SC</button>`);
          }
          return actions.join("");
        };
      }

      if (typeof renderIncidentStats === "function") {
        renderIncidentStats = function(rows) {
          const stat = st => rows.filter(r => r.status === st).length;
          if (q("stTotalIncidents")) q("stTotalIncidents").textContent = rows.length;
          if (q("stNewIncidents")) q("stNewIncidents").textContent = stat("Mới báo") + stat("Mới ghi nhận");
          if (q("stTransferIncidents")) q("stTransferIncidents").textContent = stat("Đã chuyển sửa chữa");
          if (q("stOnsiteIncidents")) q("stOnsiteIncidents").textContent = stat("Đã xử lý tại chỗ");
        };
      }

      const stats = document.getElementById("incidentStats");
      if (stats && !document.getElementById("stOnsiteIncidents")) {
        stats.insertAdjacentHTML("beforeend", '<div class="card stat-card simple-card"><h3>Đã xử lý tại chỗ</h3><div id="stOnsiteIncidents" class="value">0</div></div>');
      }
      addOptionIfMissing(document.getElementById("statusFilter"), "Đã xử lý tại chỗ");
    }

    if (page === "maintenance.html") {
      const unlockRepairDevice = () => {
        const search = document.getElementById("repairDeviceSearch");
        if (!search) return;
        search.readOnly = false;
        search.removeAttribute("aria-readonly");
        search.title = "Tìm theo mã thiết bị, tên thiết bị, model hoặc serial";
      };

      const lockRepairDevice = () => {
        const search = document.getElementById("repairDeviceSearch");
        if (!search) return;
        search.readOnly = true;
        search.setAttribute("aria-readonly", "true");
        search.title = "Thiết bị được khóa sau khi tạo phiếu để bảo toàn liên kết lịch sử.";
      };

      // P1-3: Phiếu đã tạo không được đổi sang thiết bị khác.
      if (typeof resetRepairForm === "function") {
        const originalResetRepairForm = resetRepairForm;
        resetRepairForm = function(...args) {
          const result = originalResetRepairForm.apply(this, args);
          unlockRepairDevice();
          return result;
        };
      }

      if (typeof editRepair === "function") {
        const originalEditRepair = editRepair;
        editRepair = function(id) {
          const result = originalEditRepair(id);
          lockRepairDevice();
          return result;
        };
      }

      // P1-4: Loại luồng localStorage cũ. Luồng chuẩn hiện nay tạo phiếu trên server ngay khi Chuyển SC.
      if (typeof applyIncidentPrefill === "function") {
        applyIncidentPrefill = function() {
          try { localStorage.removeItem("repair_prefill_from_incident"); } catch (e) {}
        };
      }
    }
  });
})();

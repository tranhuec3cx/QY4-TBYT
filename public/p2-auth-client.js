(() => {
  const nativeFetch = window.fetch.bind(window);

  function scopeIncidentMultipartUrl(input, options) {
    if (typeof input !== "string" || !(options?.body instanceof FormData)) return input;
    const u = new URL(input, window.location.origin);
    if (!/^\/api\/incidents(?:\/\d+)?$/.test(u.pathname)) return input;
    const deviceId = String(options.body.get("device_id") || "").trim();
    if (!deviceId) return input;
    u.searchParams.set("device_id", deviceId);
    return u.pathname + u.search + u.hash;
  }

  function normalizeDocumentActor(input, options) {
    if (typeof input !== "string" || !(options?.body instanceof FormData)) return;
    const u = new URL(input, window.location.origin);
    if (u.pathname !== "/api/documents") return;
    const user = window.__QY4_CURRENT_USER || {};
    const actor = String(user.full_name || user.username || "").trim();
    if (actor) options.body.set("updated_by", actor);
  }

  window.fetch = async (...args) => {
    let [input, options] = args;
    input = scopeIncidentMultipartUrl(input, options);
    normalizeDocumentActor(input, options);
    args[0] = input;
    const res = await nativeFetch(...args);
    if (res.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login.html?next=${next}`;
    } else if (res.status === 428) {
      window.location.href = "/change-password.html";
    }
    return res;
  };

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
  }

  function isAdmin(user) { return /quản trị/i.test(String(user?.role || "")); }
  function isTech(user) { return isAdmin(user) || /kỹ|ky|trang bị|ttbyt/i.test(String(user?.role || "")); }

  function hideElement(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }

  function enforceDepartmentReadOnlyUi() {
    if (window.__QY4_CAN_WRITE !== false) return;
    const path = window.location.pathname === "/" ? "/index.html" : window.location.pathname;

    if (path === "/index.html") {
      hideElement(document.getElementById("formCard"));
      hideElement(document.getElementById("exportExcelBtn"));
      document.querySelectorAll('.topbar .page-actions button[onclick*="formCard"], #deviceRows button[onclick^="editDevice"], #deviceRows button[onclick^="deleteDevice"]').forEach(hideElement);
    }

    if (path === "/device-detail.html") {
      [
        "editGeneralBtn","saveGeneralBtn","cancelGeneralBtn",
        "toggleAccessoryBtn","toggleRepairBtn","toggleMaintBtn","toggleOpBtn","toggleDocBtn",
        "accessoryFormWrap","repairFormWrap","maintFormWrap","opFormWrap","docFormWrap"
      ].forEach(id => hideElement(document.getElementById(id)));
      document.querySelectorAll(
        '#accessoryRows button[onclick^="edit"], #accessoryRows button[onclick^="delete"], ' +
        '#maintRows button[onclick^="edit"], #maintRows button[onclick^="delete"], ' +
        '#inspectionRows button[onclick^="edit"], #inspectionRows button[onclick^="delete"], ' +
        '#opRows button[onclick^="edit"], #opRows button[onclick^="delete"], ' +
        '#docRows button[onclick^="edit"], #docRows button[onclick^="delete"], ' +
        'a.btn[href="/inspections.html"]'
      ).forEach(hideElement);
    }

    if (path === "/tickets.html") {
      // Tài khoản khoa được báo/cập nhật sự cố của khoa mình nhưng không được chuyển sửa chữa.
      document.querySelectorAll('#rows button[onclick^="transferToRepair"], #rows button[onclick^="openLinkedRepair"], #exportIncidentExcelBtn').forEach(hideElement);
    }
  }

  function installDepartmentReadOnlyObserver() {
    if (window.__QY4_CAN_WRITE !== false || window.__QY4_ROLE_OBSERVER) return;
    const path = window.location.pathname === "/" ? "/index.html" : window.location.pathname;
    if (!["/index.html","/device-detail.html","/tickets.html"].includes(path)) return;
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        enforceDepartmentReadOnlyUi();
      });
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.__QY4_ROLE_OBSERVER = observer;
  }

  function applyUserUi(user) {
    window.__QY4_CURRENT_USER = user;
    window.__QY4_CAN_WRITE = isTech(user);
    document.documentElement.dataset.qy4Role = isTech(user) ? "tech" : "department-user";
    document.querySelectorAll(".user-box").forEach(box => {
      box.innerHTML = `<b>${esc(user.full_name || user.username)}</b><span style="margin-left:6px">· ${esc(user.role || "")}</span>`;
    });

    const footer = document.querySelector(".sidebar-footer");
    if (footer) {
      const initials = String(user.full_name || user.username || "ND").split(/\s+/).filter(Boolean).slice(-2).map(x => x[0]).join("").toUpperCase();
      footer.innerHTML = `<div class="avatar">${esc(initials || "ND")}</div><div><b>${esc(user.full_name || user.username)}</b><span>${esc(user.role || "")}${user.department_code ? " · " + esc(user.department_code) : ""}</span></div>`;
    }

    if (!isTech(user)) {
      const allowed = new Set(["/index.html", "/tickets.html", "/dashboard.html"]);
      document.querySelectorAll(".menu a").forEach(a => {
        const p = new URL(a.href, window.location.origin).pathname;
        if (!allowed.has(p)) a.remove();
      });
      enforceDepartmentReadOnlyUi();
      installDepartmentReadOnlyObserver();
    }

    window.dispatchEvent(new CustomEvent("qy4:user-ready", { detail: { user, canWrite: isTech(user) } }));

    if (!document.getElementById("p2LogoutBtn")) {
      const top = document.querySelector(".topbar .page-actions") || document.querySelector(".topbar");
      if (top) {
        const btn = document.createElement("button");
        btn.id = "p2LogoutBtn";
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = "Đăng xuất";
        btn.onclick = async () => {
          try { await nativeFetch("/api/auth/logout", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }); } catch {}
          window.location.href = "/login.html";
        };
        top.appendChild(btn);
      }
    }
  }

  function disableLegacyInsuranceSerialAutofill() {
    if (window.location.pathname !== "/index.html" && window.location.pathname !== "/") return;
    const old = document.getElementById("insuranceInput");
    if (old && old.dataset.p2Clean !== "1") {
      const clone = old.cloneNode(true);
      clone.dataset.p2Clean = "1";
      old.replaceWith(clone);
    }
    try { window.extractSerialFromHisCode = () => ""; } catch {}
    const serial = document.getElementById("serialInput");
    if (serial) serial.placeholder = serial.placeholder || "Nhập Serial Number của hãng";
  }

  function installInspectionPreSubmitGuard() {
    if (window.location.pathname !== "/inspections.html") return;
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || form.id !== "form") return;
      const deviceId = String(document.getElementById("deviceId")?.value || "").trim();
      if (deviceId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Vui lòng chọn thiết bị trước khi tải file hoặc lưu hồ sơ kiểm định.");
    }, true);
  }

  async function init() {
    try {
      const res = await nativeFetch("/api/auth/me", { headers:{"Accept":"application/json"} });
      if (!res.ok) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login.html?next=${next}`;
        return;
      }
      const data = await res.json();
      const user = data.user || {};
      if (Number(user.must_change_password || 0)) {
        window.location.href = "/change-password.html";
        return;
      }
      applyUserUi(user);
      disableLegacyInsuranceSerialAutofill();
    } catch (e) {
      console.warn("P2/P3/P4 auth client:", e);
    }
  }

  installInspectionPreSubmitGuard();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

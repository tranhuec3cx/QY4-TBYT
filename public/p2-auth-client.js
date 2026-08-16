(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
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

  function applyUserUi(user) {
    window.__QY4_CURRENT_USER = user;
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
    }

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
    if (!old || old.dataset.p2Clean === "1") return;
    const clone = old.cloneNode(true);
    clone.dataset.p2Clean = "1";
    old.replaceWith(clone);
    const serial = document.getElementById("serialInput");
    if (serial) serial.placeholder = serial.placeholder || "Nhập Serial Number của hãng";
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
      console.warn("P2 auth client:", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

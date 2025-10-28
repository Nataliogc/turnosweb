// mobile.patch.js — APP móvil (robusto a tiempos): filtros + fechas + render

(function () {
  const $ = (s) => document.querySelector(s);

  // ---------- utilidades ----------
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  // Espera a que FULL_DATA y el DOM estén listos
  function waitForDataAndDom(maxMs = 5000) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      (function tick() {
        const okDom =
          $("#hotelSelect") &&
          $("#employeeFilter") &&
          $("#dateFrom") &&
          $("#dateTo");
        const d = window.FULL_DATA;
        const okData = d && Array.isArray(d.schedule) && d.schedule.length > 0;

        if (okDom && okData) return resolve(true);
        if (performance.now() - t0 > maxMs)
          return reject(new Error("timeout: FULL_DATA o DOM no disponibles"));
        setTimeout(tick, 80);
      })();
    });
  }

  const DAY = 864e5;
  function unique(arr) {
    return [...new Set(arr.filter(Boolean))];
  }

  function getHotelsFromData() {
    const d = window.FULL_DATA || {};
    if (Array.isArray(d.hotels) && d.hotels.length) return unique(d.hotels);
    const sc = d.schedule || d.data || [];
    const names = sc.map(
      (x) => x.hotel || x.Hotel || x.establecimiento || x?.meta?.hotel
    );
    const inferred = unique(names);
    return inferred.length ? inferred : ["Sercotel Guadiana", "Cumbria Spa&Hotel"];
  }

  function getEmployeesByHotel(hotelSel) {
    const d = window.FULL_DATA || {};
    const sc = d.schedule || d.data || [];
    const names = sc
      .filter(
        (x) =>
          !hotelSel ||
          (x.hotel || x.Hotel || x?.meta?.hotel || "") === hotelSel
      )
      .map((x) => x.empleado || x.employee || x.name || x.nombre);
    return unique(names).sort((a, b) => (a || "").localeCompare(b || "", "es"));
  }

  function setSelectOptions($sel, placeholder, values) {
    if (!$sel) return;
    $sel.innerHTML = "";
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = placeholder;
    $sel.appendChild(o0);
    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      $sel.appendChild(o);
    });
  }

  // ---------- inicialización principal ----------
  ready(async () => {
    try {
      await waitForDataAndDom();
      console.log("[APP] Datos y DOM listos; schedule =", window.FULL_DATA.schedule?.length);

      const $hotel = $("#hotelSelect");
      const $emp = $("#employeeFilter");

      // Poblar hoteles y empleados
      const hotels = getHotelsFromData();
      setSelectOptions($hotel, "— Hotel —", hotels);

      function refreshEmployees() {
        setSelectOptions($emp, "— Empleado —", getEmployeesByHotel($hotel.value));
      }
      $hotel.addEventListener("change", refreshEmployees, { passive: true });
      refreshEmployees();

      // Flatpickr ES
      try {
        if (window.flatpickr?.l10ns?.es) flatpickr.localize(flatpickr.l10ns.es);
      } catch {}
      const fpFrom = flatpickr("#dateFrom", {
        dateFormat: "d/M/Y",
        weekNumbers: true,
        defaultDate: $("#dateFrom")?.value || undefined,
      });
      const fpTo = flatpickr("#dateTo", {
        dateFormat: "d/M/Y",
        weekNumbers: true,
        defaultDate: $("#dateTo")?.value || undefined,
      });

      // Drawer de filtros
      const drawer = $("#filtersDrawer");
      const btnOpen = $("#btnFilters");
      const btnClose = $("#btnCloseFilters");
      const backdrop = drawer?.querySelector(".backdrop");

      function openDrawer() {
        drawer?.classList.remove("hidden");
        drawer?.setAttribute("aria-hidden", "false");
        document.documentElement.style.overflow = "hidden";
      }
      function closeDrawer() {
        drawer?.classList.add("hidden");
        drawer?.setAttribute("aria-hidden", "true");
        document.documentElement.style.overflow = "";
      }
      btnOpen?.addEventListener("click", openDrawer);
      btnClose?.addEventListener("click", closeDrawer);
      backdrop?.addEventListener("click", closeDrawer);
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
      });

      // Render con filtros
      function applyFilters() {
        let from = fpFrom.selectedDates?.[0] || null;
        let to = fpTo.selectedDates?.[0] || null;
        if (from && !to) to = new Date(from.getTime() + 31 * DAY);
        if (!from && to) from = new Date(to.getTime() - 31 * DAY);

        if (from) $("#dateFrom").value = fpFrom.formatDate(from, "d/M/Y");
        if (to) $("#dateTo").value = fpTo.formatDate(to, "d/M/Y");

        const payload = {
          dateFrom: from,
          dateTo: to,
          hotel: $hotel?.value || "",
          employee: $emp?.value || "",
        };
        console.log("[APP] renderContent(payload) →", payload);

        if (typeof window.renderContent === "function") {
          window.renderContent(payload);
        } else {
          console.warn("[APP] renderContent no existe aún");
        }
      }

      // Botones de acción
      $("#btnApply")?.addEventListener("click", () => {
        applyFilters();
        closeDrawer();
      });

      $("#btnPrevW")?.addEventListener("click", () => {
        const f = fpFrom.selectedDates?.[0] || new Date();
        const t = fpTo.selectedDates?.[0] || new Date(f.getTime() + 30 * DAY);
        fpFrom.setDate(new Date(f.getTime() - 7 * DAY), true);
        fpTo.setDate(new Date(t.getTime() - 7 * DAY), true);
      });

      $("#btnTodayW")?.addEventListener("click", () => {
        const now = new Date();
        fpFrom.setDate(now, true);
        fpTo.setDate(new Date(now.getTime() + 30 * DAY), true);
      });

      $("#btnNextW")?.addEventListener("click", () => {
        const f = fpFrom.selectedDates?.[0] || new Date();
        const t = fpTo.selectedDates?.[0] || new Date(f.getTime() + 30 * DAY);
        fpFrom.setDate(new Date(f.getTime() + 7 * DAY), true);
        fpTo.setDate(new Date(t.getTime() + 7 * DAY), true);
      });

      // Primer render
      applyFilters();
    } catch (e) {
      console.error("[APP] No se pudo iniciar la vista móvil:", e);
    }
  });
})();

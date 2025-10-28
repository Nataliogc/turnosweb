/* ===========================================================================
 *  APP MÓVIL · Turnos Recepción
 *  - Semana por bloques (lunes→domingo), una debajo de otra
 *  - Fechas con día + mes abreviado (lun 27/oct)
 *  - Orden de hoteles/empleados estable y filtrable
 *  - Limpieza de valores (evita [object Object], normaliza vacaciones)
 *  - Arranque por defecto: semana actual + 3
 * ==========================================================================*/
(function () {
  "use strict";

  // -------------------- Utilidades básicas --------------------
  const MS = 864e5;
  const WEEKS_DEFAULT = 4;

  const $   = (s) => document.querySelector(s);
  const $id = (s) => document.getElementById(s);

  const monday = (d) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 0 => lunes
    x.setHours(0, 0, 0, 0);
    return new Date(x.getTime() - day * MS);
  };
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * MS);
  const uniq = (a) => [...new Set(a.filter(Boolean))];

  // -------------------- Normalización de datos --------------------
  function normalize(D) {
    // Acepta FULL_DATA.schedule (preferente) o FULL_DATA.data
    const S = Array.isArray(D?.schedule) ? D.schedule : [];
    if (!S.length) return Array.isArray(D?.data) ? D.data : [];

    // Si schedule viene en formato {hotel, turnos:[{empleado, fecha, turno}]}
    if (S[0] && Array.isArray(S[0].turnos)) {
      const out = [];
      for (const w of S) {
        const hotel =
          w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        for (const t of w.turnos || []) {
          out.push({
            hotel,
            empleado: t.empleado || t.employee || t.nombre || t.name || t.persona || "",
            fecha: t.fecha || t.date || t.dia || t.day || t?.meta?.fecha || "",
            turno: t.turno || t.shift || t.tramo || t?.meta?.turno || "",
          });
        }
      }
      return out;
    }
    // Si ya viene “aplanado”
    return S;
  }

  // Helpers para campos variables
  const hotelOf = (r) =>
    r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "";
  const nameOf = (r) =>
    r.empleado || r.employee || r.nombre || r.name || r.persona || "";

  // -------------------- Estado --------------------
  const STATE = {
    rows: [],
    from: monday(new Date()),
    to: addDays(monday(new Date()), 7 * WEEKS_DEFAULT - 1),
    hotel: "",
    empleado: "",
  };

  // -------------------- Render --------------------
  function render() {
    const app = $id("app");
    if (!app) return;

    const inRange = (r) => {
      const ds =
        r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || "";
      const d = ds ? new Date(ds) : null;
      return (!d || (d >= STATE.from && d <= STATE.to)) &&
        (!STATE.hotel || hotelOf(r) === STATE.hotel) &&
        (!STATE.empleado || nameOf(r) === STATE.empleado);
    };

    const rows = STATE.rows.filter(inRange);

    // --- Agrupar por hotel y semana (claves: "Hotel__YYYY-MM-DD(lunes)") ---
    const byHotelWeek = {};
    for (const r of rows) {
      const hotel = hotelOf(r) || "—";
      const d = new Date(r.fecha || r.date || r.dia || r.day);
      if (isNaN(d)) continue;
      const mon = monday(d);
      const weekKey = `${hotel}__${mon.toISOString().slice(0, 10)}`;
      (byHotelWeek[weekKey] ??= []).push(r);
    }

    // Orden por fecha de semana
    const weekKeys = Object.keys(byHotelWeek).sort((a, b) => {
      const da = new Date(a.split("__")[1]);
      const db = new Date(b.split("__")[1]);
      return da - db;
    });

    // Pintado de “píldoras”
    const pill = (s) => {
      if (s == null) return "—";
      // Evitar objetos serializados
      if (typeof s === "object") return "—";
      s = String(s);
      if (s.includes("[")) return "—"; // p.e. "[object object]"
      const low = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      if (low.includes("manana") || low.includes("mañana"))
        return `<span class="pill pill-m">Mañana</span>`;
      if (low.includes("tarde")) return `<span class="pill pill-t">Tarde</span>`;
      if (low.includes("noche")) return `<span class="pill pill-n">Noche 🌙</span>`;
      if (low.includes("descanso")) return `<span class="pill pill-x">Descanso</span>`;
      if (low.includes("vacacion")) return `<span class="pill pill-m">Vacaciones 🎉</span>`;
      return s || "—";
    };

    // Día con mes abreviado
    const dayLbl = (d) => {
      try {
        const date = new Date(d);
        const opts = { weekday: "short", day: "2-digit", month: "short" };
        return date.toLocaleDateString("es-ES", opts).replace(/\./g, "");
      } catch {
        return d || "";
      }
    };

    // Semana (número)
    const weekNumber = (d) => {
      // ISO week number
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = (tmp.getUTCDay() + 6) % 7;
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
      const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
      const diff = (tmp - firstThursday) / 86400000;
      return 1 + Math.floor(diff / 7);
    };

    let html = "";

    for (const wk of weekKeys) {
      const [hotel, weekStartStr] = wk.split("__");
      const weekStart = new Date(weekStartStr);

      // Fechas lunes→domingo
      const fechas = Array.from({ length: 7 }, (_, i) =>
        new Date(weekStart.getTime() + i * MS)
      );
      const fechasStr = fechas.map((f) => f.toISOString().slice(0, 10));

      // Empleados ordenados alfabéticamente (o por el orden natural que venga si quieres cambiar aquí)
      const empRows = byHotelWeek[wk];
      const emps = uniq(empRows.map(nameOf)).sort((a, b) =>
        String(a).localeCompare(String(b), "es")
      );

      // Mapa empleado → {fecha: turno}
      const empMap = {};
      for (const r of empRows) {
        const n = nameOf(r);
        const d = (r.fecha || r.date || r.dia || r.day || "").slice(0, 10);
        const t = r.turno || r.shift || r.tramo || r?.meta?.turno || "";
        (empMap[n] ??= {})[d] = t;
      }

      const sem = weekNumber(weekStart);
      const title =
        `${hotel} – Semana ${String(sem).padStart(2, "0")}` +
        `/${weekStart.getMonth() + 1}/${weekStart.getFullYear()}`;

      const logo =
        hotel.toLowerCase().includes("guadiana")
          ? "img/guadiana.jpg"
          : "img/cumbria.jpg";

      html += `
        <div class="row-card">
          <table class="grid-week">
            <thead>
              <tr>
                <th colspan="8" style="text-align:left;font-size:14px;background:#fafafa">
                  <img src="${logo}" alt="${hotel}" style="height:24px;vertical-align:middle;margin-right:6px;border-radius:4px">
                  ${title}
                </th>
              </tr>
              <tr>
                <th style="min-width:160px">Empleado</th>
                ${fechas.map((f) => `<th>${dayLbl(f)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${emps
                .map(
                  (n) => `
                <tr>
                  <td style="text-align:left"><strong>${n}</strong></td>
                  ${fechasStr
                    .map((f) => `<td>${pill(empMap[n]?.[f])}</td>`)
                    .join("")}
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    app.innerHTML =
      html ||
      `<p class="meta">No hay datos para mostrar con los filtros seleccionados.</p>`;
  }

  // -------------------- Filtros (panel) --------------------
  function populateFilters() {
    const hotelSel = $id("hotelSelect");
    const empSel = $id("employeeFilter");
    if (!hotelSel || !empSel) return;

    const hotels = uniq(STATE.rows.map(hotelOf)).sort((a, b) =>
      String(a).localeCompare(String(b), "es")
    );
    hotelSel.innerHTML =
      '<option value="">— Hotel —</option>' +
      hotels.map((h) => `<option>${h}</option>`).join("");

    const refreshEmp = () => {
      const list = uniq(
        STATE.rows
          .filter((r) => !hotelSel.value || hotelOf(r) === hotelSel.value)
          .map(nameOf)
      ).sort((a, b) => String(a).localeCompare(String(b), "es"));
      empSel.innerHTML =
        '<option value="">— Empleado —</option>' +
        list.map((n) => `<option>${n}</option>`).join("");
    };
    refreshEmp();
    hotelSel.onchange = refreshEmp;

    // Fechas iniciales en el panel
    const toISO = (d) => new Date(d).toISOString().slice(0, 10);
    $id("dateFrom").value = toISO(STATE.from);
    $id("dateTo").value = toISO(STATE.to);
  }

  function attachUI() {
    // Botones superiores
    $id("btnPrev")?.addEventListener("click", () => {
      STATE.from = addDays(STATE.from, -7);
      STATE.to = addDays(STATE.to, -7);
      render();
    });
    $id("btnNext")?.addEventListener("click", () => {
      STATE.from = addDays(STATE.from, 7);
      STATE.to = addDays(STATE.to, 7);
      render();
    });
    $id("btnToday")?.addEventListener("click", () => {
      STATE.from = monday(new Date());
      STATE.to = addDays(STATE.from, 7 * WEEKS_DEFAULT - 1);
      render();
    });

    // Filtros / dialog
    const dlg = $id("dlg");
    $id("btnFilters")?.addEventListener("click", () => {
      dlg?.showModal();
    });
    $id("btnApply")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      STATE.hotel = $id("hotelSelect")?.value || "";
      STATE.empleado = $id("employeeFilter")?.value || "";
      const df = $id("dateFrom")?.value;
      const dt = $id("dateTo")?.value;
      STATE.from = df ? monday(new Date(df)) : STATE.from;
      STATE.to = dt ? addDays(monday(new Date(dt)), 6) : STATE.to;
      dlg?.close();
      render();
    });
  }

  // -------------------- Arranque --------------------
  window.addEventListener("DOMContentLoaded", () => {
    try {
      STATE.rows = normalize(window.FULL_DATA || {});
      // Default: semana actual + 3
      STATE.from = monday(new Date());
      STATE.to = addDays(STATE.from, 7 * WEEKS_DEFAULT - 1);

      populateFilters();
      attachUI();
      render();
    } catch (e) {
      const app = $id("app");
      if (app)
        app.innerHTML = `<p class="meta">No se pudo iniciar la APP: ${
          e?.message || e
        }</p>`;
      console.error("[APP] boot error", e);
    }
  });

  // Compatibilidad externa (si alguien invoca renderContent)
  window.renderContent = function () {
    render();
  };
})();

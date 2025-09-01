# -*- coding: utf-8 -*-
r"""
Genera un index.html con interfaz de filtros (hotel, empleado, rango de fechas),
buscador, leyenda y botón de exportar .ics, a partir de:

  C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx

Asume hojas:
  - "Cumbria Spa&Hotel"   (tabla tipo cuadrante por fechas)
  - "Sercotel Guadiana"   (tabla tipo cuadrante por fechas)
  - "Sustituciones"       (Hotel, Fecha, Empleado, Cambio de Turno, Sustituto, Tipo Ausencia)

Requisitos:  pip install pandas openpyxl python-dateutil

Puedes ajustar horas por defecto de los turnos más abajo (SHIFT_DEFAULTS).
"""

import json
from pathlib import Path
from datetime import datetime, timedelta, time, date
from typing import Optional, List, Dict

import pandas as pd
from dateutil import tz

# === Configuración ===
EXCEL_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
HOTEL_SHEETS = ["Cumbria Spa&Hotel", "Sercotel Guadiana"]
SUST_SHEET = "Sustituciones"
OUTPUT_HTML = "index.html"

def _open_excel_with_fallback(path: str):
    """
    Intenta abrir el Excel directamente. Si hay PermissionError (p.ej. bloqueado por OneDrive/Excel),
    copia a un archivo temporal y abre desde allí.
    Reintenta varias veces con pequeñas esperas.
    """
    last_err = None
    for attempt in range(5):
        try:
            return pd.ExcelFile(path, engine="openpyxl")
        except PermissionError as e:
            last_err = e
            # Intentar copiar a temp y abrir desde ahí
            try:
                tmpdir = tempfile.gettempdir()
                tmp_path = Path(tmpdir) / f"turnos_cache_{int(datetime.now().timestamp())}_{attempt}.xlsx"
                shutil.copy2(path, tmp_path)
                return pd.ExcelFile(str(tmp_path), engine="openpyxl")
            except Exception as _e:
                last_err = _e
                _time.sleep(0.6)  # pequeño backoff y reintenta
    # Si no fue posible
    raise last_err


# Horarios por defecto (puedes cambiarlos)
SHIFT_DEFAULTS = {
    "M": (time(7, 0),  time(15, 0)),   # Mañana
    "T": (time(15, 0), time(23, 0)),   # Tarde
    "N": (time(23, 0), time(7, 0)),    # Noche (termina día siguiente)
}

# Alias/códigos que mapean a tipo semántico
CODE_MAP = {
    "M": "Mañana",
    "MAÑANA": "Mañana",
    "T": "Tarde",
    "TARDE": "Tarde",
    "N": "Noches",
    "NOCHE": "Noches",
    "NCH": "Noches",
    "D": "Descanso",
    "DESC": "Descanso",
    "DESCANSO": "Descanso",
    "V": "Ausencia",
    "VAC": "Ausencia",
    "VACACIONES": "Ausencia",
    "B": "Ausencia",
    "BAJA": "Ausencia",
    "PERM": "Ausencia",
    "PERMISO": "Ausencia",
    "AUS": "Ausencia",
    "AUSENCIA": "Ausencia",
}

LOCAL_TZ = tz.tzlocal()


def is_date_like(v) -> bool:
    if pd.isna(v):
        return False
    if isinstance(v, (pd.Timestamp, datetime)):
        return True
    if isinstance(v, str):
        v = v.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
            try:
                datetime.strptime(v, fmt)
                return True
            except ValueError:
                pass
    return False


def parse_date(v) -> Optional[date]:
    if isinstance(v, pd.Timestamp):
        return v.date()
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        v = v.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                continue
    return None


def classify_code(raw: str) -> str:
    if not raw:
        return ""
    key = str(raw).strip().upper()
    return CODE_MAP.get(key, "Turno")  # Desconocido => "Turno" genérico


def detect_structure(df: pd.DataFrame):
    """
    Detecta la fila y columnas de cabecera con fechas y la columna de 'Empleado'.
    Devuelve: (row_start, col_emp, date_cols[list])
    """
    # Limpiamos columnas/filas completamente vacías
    df = df.copy()
    df = df.dropna(how="all").dropna(how="all", axis=1)

    # Buscamos primera fila que contenga al menos 3 fechas
    header_row_idx = None
    for i, row in df.iterrows():
        date_cols = [j for j, v in enumerate(row) if is_date_like(v)]
        if len(date_cols) >= 3:
            header_row_idx = i
            break

    if header_row_idx is None:
        # fallback: usar primera fila, considerar que a partir de 2ª col son fechas si parecen
        header_row_idx = df.index[0]
        row = df.loc[header_row_idx]
        date_cols = [j for j, v in enumerate(row) if is_date_like(v)]
    else:
        row = df.loc[header_row_idx]
        date_cols = [j for j, v in enumerate(row) if is_date_like(v)]

    # Columna de empleado: la primera no fecha a la izquierda de la primera fecha
    first_date_col = min(date_cols) if date_cols else 1
    cand_emp_cols = [j for j in range(0, first_date_col) if j in range(len(row))]
    col_emp = cand_emp_cols[-1] if cand_emp_cols else 0

    # Normalizamos: construimos lista de fechas (col_idx -> date)
    date_map = {}
    for j in date_cols:
        d = parse_date(row.iloc[j])
        if d:
            date_map[j] = d

    return df, header_row_idx, col_emp, date_map


def read_hotel_sheet(xls: pd.ExcelFile, sheet_name: str) -> List[Dict]:
    """
    Devuelve lista de eventos normalizados:
    {hotel, employee, date, code, type, title, start_iso, end_iso, is_absence, is_descanso}
    Respetando el orden del Excel (no alfabético).
    """
    df = pd.read_excel(xls, sheet_name=sheet_name, header=None, dtype=object, engine="openpyxl")
    df, header_row, col_emp, date_map = detect_structure(df)

    # Nombres de empleados están a partir de la fila siguiente a header_row
    events = []
    for i in df.index:
        if i <= header_row:
            continue
        row = df.loc[i]
        emp = row.iloc[col_emp]
        if pd.isna(emp) or str(emp).strip() == "":
            continue
        employee = str(emp).strip()

        # Recorremos columnas de fechas detectadas
        for j, d in date_map.items():
            if j >= len(row):
                continue
            val = row.iloc[j]
            code = "" if pd.isna(val) else str(val).strip()
            if code == "" or code == "-":
                continue

            typ = classify_code(code)

            # Montamos título y horario por defecto si aplica
            is_descanso = (typ == "Descanso")
            is_absence = (typ == "Ausencia")

            start_dt = None
            end_dt = None
            if not is_descanso:
                # buscar horario por código
                sdef = SHIFT_DEFAULTS.get(code.upper())
                if sdef:
                    s_time, e_time = sdef
                else:
                    # por tipo semántico
                    if typ == "Mañana":
                        s_time, e_time = SHIFT_DEFAULTS["M"]
                    elif typ == "Tarde":
                        s_time, e_time = SHIFT_DEFAULTS["T"]
                    elif typ == "Noches":
                        s_time, e_time = SHIFT_DEFAULTS["N"]
                    else:
                        # Turno genérico: 8 horas desde las 9:00
                        s_time, e_time = time(9,0), time(17,0)

                start_dt = datetime.combine(d, s_time)
                end_dt = datetime.combine(d, e_time)
                # Si la hora de fin es menor/igual que inicio, asumimos que pasa al día siguiente (noches)
                if end_dt <= start_dt:
                    end_dt += timedelta(days=1)

            title = f"{employee} · {code}"
            events.append({
                "hotel": sheet_name,
                "employee": employee,
                "date": d.strftime("%Y-%m-%d"),
                "code": code,
                "type": typ,
                "title": title,
                "start_iso": start_dt.astimezone(LOCAL_TZ).isoformat() if start_dt else None,
                "end_iso": end_dt.astimezone(LOCAL_TZ).isoformat() if end_dt else None,
                "is_absence": bool(is_absence),
                "is_descanso": bool(is_descanso),
            })

    return events


def read_sustituciones(xls: pd.ExcelFile) -> List[Dict]:
    df = pd.read_excel(xls, sheet_name=SUST_SHEET, header=0, dtype=object, engine="openpyxl")
    df = df.dropna(how="all")
    expected = ["Hotel", "Fecha", "Empleado", "Cambio de Turno", "Sustituto", "Tipo Ausencia"]
    if not set(expected).issubset(df.columns):
        df = df.iloc[:, :6]
        df.columns = expected
    # Fecha normalizada
    fechas = pd.to_datetime(df["Fecha"], errors="coerce")
    df["Fecha"] = fechas.dt.strftime("%Y-%m-%d").fillna(df["Fecha"].astype(str))
    df = df.fillna("")
    return df[expected].to_dict(orient="records")


def integrate_sustituciones(events: List[Dict], susts: List[Dict]) -> List[Dict]:
    """
    Integra la info de sustituciones marcando los eventos como ausencia y anotando sustituto/causa cuando coincide
    hotel + empleado + fecha.
    """
    index = {}
    for ev in events:
        key = (ev["hotel"], ev["employee"].strip().upper(), ev["date"])
        index.setdefault(key, []).append(ev)

    for r in susts:
        key = (r["Hotel"], str(r["Empleado"]).strip().upper(), r["Fecha"])
        if key in index:
            for ev in index[key]:
                ev["is_absence"] = True
                if r.get("Tipo Ausencia"):
                    ev["type"] = "Ausencia"
                    ev["code"] = r.get("Tipo Ausencia")
                    ev["title"] = f"{ev['employee']} · {ev['code']} (sustituye {r.get('Sustituto','')})"
                ev["sustituto"] = r.get("Sustituto","")
                ev["cambio_turno"] = r.get("Cambio de Turno","")
        else:
            # Si no existe evento previo, creamos uno "virtual" sólo para reflejar ausencia
            events.append({
                "hotel": r["Hotel"],
                "employee": r["Empleado"],
                "date": r["Fecha"],
                "code": r.get("Tipo Ausencia","AUS"),
                "type": "Ausencia",
                "title": f"{r['Empleado']} · {r.get('Tipo Ausencia','Ausencia')}",
                "start_iso": None,
                "end_iso": None,
                "is_absence": True,
                "is_descanso": False,
                "sustituto": r.get("Sustituto",""),
                "cambio_turno": r.get("Cambio de Turno",""),
            })
    return events


def build_dataset():
    xls = _open_excel_with_fallback(EXCEL_PATH)
    all_events = []
    for sheet in HOTEL_SHEETS:
        all_events.extend(read_hotel_sheet(xls, sheet))
    susts = read_sustituciones(xls)
    all_events = integrate_sustituciones(all_events, susts)

    # Orden estable (hotel -> tal cual aparece por fechas -> orden de hoja conservado por iteración)
    all_events.sort(key=lambda e: (e["hotel"], e["date"], e["employee"]))
    return {
        "source": EXCEL_PATH,
        "generated_at": datetime.now(tz=LOCAL_TZ).isoformat(),
        "hotels": HOTEL_SHEETS,
        "employees": sorted(set(e["employee"] for e in all_events)),
        "events": all_events,
    }



def render_html(data: dict) -> str:
    from datetime import datetime
    from dateutil import tz
    LOCAL_TZ = tz.tzlocal()
    now_str = datetime.now(LOCAL_TZ).strftime("%d/%m/%Y, %H:%M:%S")
    json_blob = json.dumps(data, ensure_ascii=False)

    head = """<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cuadrantes de turnos</title>
  <style>
    :root {
      --accent:#0b5fa5;
      --soft:#eef5fb;
      --danger:#f9d4d4;
      --muted:#6b7280;
      --pill:#e8edf6;
      --radius:14px;
    }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 20px; background:#f6f7fb; }
    .card { background:white; border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,.06); padding: 16px 18px; }
    .header { background: var(--accent); color: white; padding: 16px 22px; border-radius: var(--radius); display:flex; justify-content:space-between; align-items:center; }
    .header h1 { margin:0; font-size: 1.25rem; }
    .header .right { font-size:.9rem; opacity:.95 }
    .link { color:white; text-decoration: underline; cursor:pointer; margin-left:8px; }
    .alert { background: var(--danger); color:#6a1b1b; padding:12px 14px; border-radius: 10px; margin: 14px 0; }
    .controls { display:grid; grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 1fr auto; gap: 12px; align-items:end; }
    label { font-size:.85rem; color:#374151; display:block; margin:0 0 6px; }
    input[type="search"], input[type="date"], select { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #d1d5db; background:#fff; }
    .btn { padding:10px 12px; border-radius:10px; border:1px solid #cbd5e1; background:#f1f5f9; cursor:pointer; }
    .btn.primary { background:#0ea5e9; color:white; border-color:#0284c7; }
    .muted { color: var(--muted); font-size:.9rem; }
    .legend { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
    .pill { background:#eef2ff; border:1px solid #d9e1ff; padding:4px 10px; border-radius:999px; font-size:.85rem; }
    .list { margin-top:12px; }
    .row { background:white; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; display:grid; grid-template-columns: 1fr auto; align-items:center; margin-top:8px; }
    .row .title { font-weight:600; }
    .row .meta { font-size:.9rem; color:#4b5563; }
    .empty { background:#f1f5f9; border:1px dashed #cbd5e1; color:#475569; border-radius:12px; padding:14px; text-align:center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cuadrantes de turnos</h1>
    <div class="right">Actualizado: <strong>__NOW__</strong> <span class="link" id="refresh">Refrescar</span></div>
  </div>

  <div id="alert" class="alert" style="display:none;">No hay datos para mostrar. Compruebe las fechas en el Excel.</div>

  <div class="card">
    <div class="controls">
      <div>
        <label>Buscar</label>
        <input type="search" id="q" placeholder="Empleado u hotel" />
      </div>
      <div>
        <label>Hotel</label>
        <select id="hotel">
          <option value="">— Todos —</option>
        </select>
      </div>
      <div>
        <label>Desde</label>
        <input type="date" id="from" />
      </div>
      <div>
        <label>Hasta</label>
        <input type="date" id="to" />
      </div>
      <div>
        <label>Empleado</label>
        <select id="emp"><option value="">— Selecciona —</option></select>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn" id="clear">Limpiar</button>
        <button class="btn primary" id="export">Descargar .ics</button>
      </div>
    </div>
  </div>

  <div class="card empty" id="nores" style="display:none;">No hay resultados con los filtros aplicados.</div>

  <div class="legend">
    <span class="pill">Mañana</span>
    <span class="pill">Tarde</span>
    <span class="pill">Noches</span>
    <span class="pill" style="background:#ffe8e8; border-color:#ffd1d1;">Descanso</span>
    <span class="pill" style="background:#fff4db; border-color:#ffe6ac;">Ausencias (Vacaciones/Baja/...)</span>
  </div>

  <div class="list" id="list"></div>

  <script id="DATA" type="application/json">__JSON__</script>
  <script>
    const DATA = JSON.parse(document.getElementById('DATA').textContent);
    const hotels = DATA.hotels || [];
    const events = DATA.events || [];

    const $ = (id) => document.getElementById(id);
    const q = $('q'), hotel = $('hotel'), from = $('from'), to = $('to'), emp = $('emp');
    const list = $('list'), nores = $('nores'), alertBox = $('alert'), refresh = $('refresh');

    function fmtDate(d){ const t = new Date(d); return t.toLocaleDateString(); }
    function isoDateStr(dt){ return (new Date(dt)).toISOString().slice(0,10); }

    // Init options
    hotels.forEach(h => { const o=document.createElement('option'); o.value=h; o.textContent=h; hotel.appendChild(o); });
    const empSet = Array.from(new Set(events.map(e => e.employee))).sort();
    empSet.forEach(n => { const o=document.createElement('option'); o.value=n; o.textContent=n; emp.appendChild(o); });

    // Default range: hoy a +30 días
    const today = new Date();
    const plus30 = new Date(); plus30.setDate(today.getDate()+30);
    from.value = today.toISOString().slice(0,10);
    to.value = plus30.toISOString().slice(0,10);

    function matches(e){
      const txt = (q.value||'').toLowerCase();
      if (txt){
        const blob = (e.employee + ' ' + e.hotel + ' ' + (e.code||'') + ' ' + (e.type||'')).toLowerCase();
        if (!blob.includes(txt)) return false;
      }
      if (hotel.value && e.hotel !== hotel.value) return false;
      if (emp.value && e.employee !== emp.value) return false;

      // date range
      const d = e.date;
      const start = from.value || '0000-01-01';
      const end = to.value || '9999-12-31';
      return (d >= start && d <= end);
    }

    function pillFor(e){
      if (e.is_descanso) return 'Descanso';
      if (e.is_absence) return 'Ausencia';
      return e.type || e.code || 'Turno';
    }

    function render(){
      const ok = Array.isArray(events) && events.length > 0;
      alertBox.style.display = ok ? 'none' : 'block';

      const rows = events.filter(matches);
      list.innerHTML = '';

      if (rows.length === 0){
        nores.style.display = 'block';
        return;
      } else {
        nores.style.display = 'none';
      }

      rows.forEach(e => {
        const div = document.createElement('div');
        div.className = 'row';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `${e.employee} — ${e.hotel}`;
        const meta = document.createElement('div');
        meta.className = 'meta';
        const pill = pillFor(e);
        const dateTxt = fmtDate(e.date);
        const span = document.createElement('span');
        span.className = 'pill';
        span.textContent = pill;
        meta.append(
          document.createTextNode(`${dateTxt} · ${e.code || e.type || 'Turno'} `),
          span
        );
        left.append(title, meta);

        const right = document.createElement('div');
        right.className = 'muted';
        if (e.start_iso && e.end_iso){
          const a = new Date(e.start_iso), b = new Date(e.end_iso);
          right.textContent = a.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'}) + '–' + b.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'});
        } else {
          right.textContent = '—';
        }

        div.append(left, right);
        list.appendChild(div);
      });
    }

    function clearAll(){
      q.value = '';
      hotel.value = '';
      from.value = today.toISOString().slice(0,10);
      to.value = plus30.toISOString().slice(0,10);
      emp.value = '';
      render();
    }

    refresh.addEventListener('click', () => location.reload());
    q.addEventListener('input', render);
    hotel.addEventListener('change', render);
    from.addEventListener('change', render);
    to.addEventListener('change', render);
    emp.addEventListener('change', render);
    document.getElementById('clear').addEventListener('click', clearAll);

    function buildICS(rows){
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Turnos//Cuadrantes//ES'
      ];
      rows.forEach(e => {
        if (!e.start_iso || !e.end_iso) return; // saltamos descansos/ausencias sin horario
        const dtStart = new Date(e.start_iso);
        const dtEnd = new Date(e.end_iso);
        const fmt = (d) => d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
        const uid = btoa(`${e.hotel}|${e.employee}|${e.date}|${e.code}`).replace(/=+/g,'');

        const summary = `${e.employee} · ${e.code || e.type || 'Turno'} · ${e.hotel}`;
        const desc = e.is_absence ? 'Ausencia/Sustitución' : 'Turno';
        lines.push(
          'BEGIN:VEVENT',
          `UID:${uid}@turnos`,
          `DTSTAMP:${fmt(new Date())}`,
          `DTSTART:${fmt(dtStart)}`, `DTEND:${fmt(dtEnd)}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${desc}`,
          'END:VEVENT'
        );
      });
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }

    document.getElementById('export').addEventListener('click', () => {
      const rows = events.filter(matches).filter(e => !e.is_descanso); // no exportar descansos
      if (rows.length === 0) { alert('No hay eventos para exportar.'); return; }
      const ics = buildICS(rows);
      const blob = new Blob([ics], {type: 'text/calendar'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fromS = from.value || rows[0].date;
      const toS = to.value || rows[rows.length-1].date;
      a.href = url;
      a.download = `turnos_${fromS}_a_${toS}.ics`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    });

    render();
  </script>
</body>
</html>"""

    html = head.replace("__NOW__", now_str).replace("__JSON__", json_blob)
    return html


def main():
    data = build_dataset()
    html = render_html(data)
    out = Path(OUTPUT_HTML)
    out.write_text(html, encoding="utf-8")
    print(f"OK -> {out.resolve()}")


if __name__ == "__main__":
    main()

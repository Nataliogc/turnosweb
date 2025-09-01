# -*- coding: utf-8 -*-
"""
Genera index.html a partir del Excel de cuadrantes usando tu plantilla.
Incluye:
- Parser de hojas semanales (Semana/Empleado/Lunes..Domingo) con turnos M/T/N/D.
- Fusión de hoja "Sustituciones" (ausencias + fila sintética para sustituto con turno original).
- Metadatos: meta.noches_por_mes (incluye sustitutos) y meta.orden_por_hotel.
- Campos extendidos que tu plantilla espera (Dia, Semana, Order*, etc.).
"""

import json, re, sys, tempfile, shutil, time as _time
from pathlib import Path
from datetime import datetime, timedelta, date
from dateutil import tz
import pandas as pd
import numpy as np

LOCAL_TZ = tz.tzlocal()

# === Rutas
EXCEL_PATHS = [
    Path(r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"),
    Path("Plantilla Cuadrante con Sustituciones v.6.0.xlsx"),
    Path("Plantilla Cuadrante.xlsx"),
]
INDEX_HTML = Path("index.html")
TEMPLATE_INDEX = Path(r"/mnt/data/7866a536-30b5-4e98-ba4f-d38c8eef6c6e.html")  # plantilla del usuario

CODE_MAP = {
    "MAÑANA": {"type": "Mañana", "code": "M", "start": "07:00", "end": "15:00"},
    "TARDE":  {"type": "Tarde",  "code": "T", "start": "15:00", "end": "23:00"},
    "NOCHE":  {"type": "Noche",  "code": "N", "start": "23:00", "end": "07:00"},
    "DESCANSO":{"type":"Descanso","code":"D","start": None,    "end": None},
    "VACACIONES":{"type":"Vacaciones","code":"VAC","start":None,"end":None},
    "BAJA":   {"type":"Baja",    "code":"BAJA","start":None,   "end":None},
    "PERMISO":{"type":"Permiso", "code":"PERM","start":None,   "end":None},
    "AUSENCIA":{"type":"Ausencia","code":"AUS","start":None,   "end":None},
}
DAY_NAMES = ["lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo"]

# === Utilidades
def _open_excel_with_fallback(path: Path) -> dict:
    """
    Devuelve dict sheet_name->DataFrame. Reintenta y, si el archivo está bloqueado,
    copia a %TEMP% y lee desde ahí.
    """
    last_exc = None
    for _ in range(3):
        try:
            return pd.read_excel(path, sheet_name=None, engine="openpyxl")
        except Exception as e:
            last_exc = e
            _time.sleep(0.6)  # backoff
    # Fallback con copia temporal
    try:
        tmpdir = Path(tempfile.gettempdir())
        tmp = tmpdir / f"_tw_copy_{path.name}"
        shutil.copy2(path, tmp)
        dfs = pd.read_excel(tmp, sheet_name=None, engine="openpyxl")
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass
        return dfs
    except Exception as e2:
        raise RuntimeError(f"No se pudo abrir el Excel: {path}\nPrimero: {last_exc}\nFallback: {e2}")

def _coerce_date(x):
    if x is None or (isinstance(x, float) and (np.isnan(x))):
        return None
    if isinstance(x, datetime): return x.date()
    if isinstance(x, date): return x
    s = str(x).strip()
    if not s: return None
    for fmt in ("%d-%b-%y","%d/%m/%Y","%Y-%m-%d","%d-%m-%Y","%d.%m.%Y"):
        try: return datetime.strptime(s, fmt).date()
        except Exception: pass
    d = pd.to_datetime(s, dayfirst=True, errors="coerce")
    if pd.isna(d): return None
    return d.date()

def _norm_str(x): return ("" if x is None else str(x)).strip()
def _upper(x): return _norm_str(x).upper()

def is_week_sheet(df: pd.DataFrame):
    cols = [str(c).strip().lower() for c in df.columns]
    return ("semana" in cols) and (("empleado" in cols) or ("empleada" in cols)) and (sum(1 for c in cols if c in DAY_NAMES) >= 5)

def parse_week_sheet(sheet_name: str, df: pd.DataFrame):
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    col_semana = next((c for c in df.columns if c.lower()=="semana"), None)
    col_emp = next((c for c in df.columns if c.lower() in ("empleado","empleada")), None)
    day_cols = [c for c in df.columns if c.lower() in DAY_NAMES]
    idx_map = {"lunes":0,"martes":1,"miércoles":2,"miercoles":2,"jueves":3,"viernes":4,"sábado":5,"sabado":5,"domingo":6}

    # orden base según aparecen
    current_order, seen = [], set()
    for _, r0 in df.iterrows():
        n = _norm_str(r0.get(col_emp))
        if n and (n.lower() not in {"empleado","empleada","total","totales"}) and n not in seen:
            seen.add(n); current_order.append(n)
    order_index = {name:i for i,name in enumerate(current_order)}

    events = []
    for _, row in df.iterrows():
        emp = _norm_str(row.get(col_emp))
        week = _coerce_date(row.get(col_semana))
        if not emp or not week: continue
        for day in day_cols:
            v = _upper(row.get(day))
            if not v: continue
            typ = CODE_MAP.get(v, None)
            if typ is None:
                base = v.replace("Á","A").replace("É","E").replace("Í","I").replace("Ó","O").replace("Ú","U")
                typ = CODE_MAP.get(base, {"type": _norm_str(row.get(day)), "code": base or "TXT", "start": None, "end": None})
            the_date = week + timedelta(days=idx_map[day.lower()])
            # tiempos (solo para .ics y recuentos)
            start_dt = end_dt = None
            if typ["start"] and typ["end"]:
                start_dt = datetime.combine(the_date, datetime.strptime(typ["start"], "%H:%M").time())
                end_dt = datetime.combine(the_date, datetime.strptime(typ["end"], "%H:%M").time())
                if end_dt <= start_dt: end_dt += timedelta(days=1)
            events.append({
                "Hotel": sheet_name,
                "Empleado": emp,
                "Dia": the_date.strftime("%A").capitalize(),
                "Fecha": the_date.isoformat(),
                "Turno": typ["code"],
                "TurnoLargo": typ["type"],
                "TextoDia": typ["type"],      # SOLO el nombre del turno, sin horas
                "NameColorC": "",
                "Icono": "",
                "Sustituto": "",
                "TipoEmpleado": "Normal",
                "SustitucionPor": "",
                "OrderBaseHotel": order_index.get(emp, 1_000_000),
                "EmpleadoOrdenSemanaBase": order_index.get(emp, 1_000_000),
                "OrderDia": order_index.get(emp, 1_000_000),
                "OrderSemana": order_index.get(emp, 1_000_000),
                "VacSemana": 0,
                "Semana": week.isoformat(),
                "StartISO": start_dt.isoformat() if start_dt else None,
                "EndISO": end_dt.isoformat() if end_dt else None,
                "OrdenIndex": order_index.get(emp, 1_000_000),
            })
    return events

def parse_sustituciones(df: pd.DataFrame):
    cols = {str(c).strip().lower(): c for c in df.columns}
    def pick(*xs):
        for k in xs:
            if k in cols: return cols[k]
        return None
    c_hotel = pick("hotel","centro","sede")
    c_fecha = pick("fecha","date","día","dia")
    c_emp   = pick("empleado","empleada","nombre","worker")
    c_sust  = pick("sustituto","sustituta","sub")
    c_cambio= pick("cambio de turno","cambioturno","cambio")
    c_tipo  = pick("tipoausencia","tipo_ausencia","tipo")
    out = []
    for _, r in df.iterrows():
        d = _coerce_date(r.get(c_fecha)) if c_fecha else None
        out.append({
            "Hotel": _norm_str(r.get(c_hotel)) if c_hotel else "",
            "Fecha": d.isoformat() if d else "",
            "Empleado": _norm_str(r.get(c_emp)),
            "Sustituto": _norm_str(r.get(c_sust)) if c_sust else "",
            "CambioTurno": _norm_str(r.get(c_cambio)) if c_cambio else "",
            "TipoAusencia": _norm_str(r.get(c_tipo)) if c_tipo else "",
        })
    return out

def build_dataset():
    # localizar Excel
    excel_path = None
    for p in EXCEL_PATHS:
        if p.exists():
            excel_path = p; break
    if not excel_path:
        raise FileNotFoundError(f"No se encontró el Excel en {EXCEL_PATHS}")
    dfs = _open_excel_with_fallback(excel_path)

    # recolectar filas del calendario y sustituciones
    calendar_rows = []
    sust_rows = []
    for name, df in dfs.items():
        lname = name.strip().lower()
        if lname in {"datos de validación","datos de validacion"}:
            continue
        if is_week_sheet(df):
            calendar_rows.extend(parse_week_sheet(name, df))
        elif "sustit" in lname:
            sust_rows.extend(parse_sustituciones(df))

    # indexar calendario
    idx = {(r["Hotel"].lower(), r["Empleado"].lower(), r["Fecha"]): i for i, r in enumerate(calendar_rows)}

    # aplicar sustituciones al titular y crear fila para sustituto con el turno original
    extra_rows = []
    for s in sust_rows:
        key = (s["Hotel"].lower(), s["Empleado"].lower(), s["Fecha"])
        if key not in idx:
            continue
        i = idx[key]
        base = calendar_rows[i]
        original_turno_largo = base.get("TurnoLargo") or base.get("Turno")
        base["Sustituto"] = s.get("Sustituto","")
        base["CambioTurno"] = s.get("CambioTurno","")
        tipo = s.get("TipoAusencia","")
        if tipo:
            base["Turno"] = CODE_MAP.get(tipo.upper(), {"code":"TXT"})["code"]
            base["TurnoLargo"] = tipo
            base["TextoDia"] = tipo
            base["StartISO"] = None; base["EndISO"] = None
        # fila sintética para el sustituto con turno original si era productivo
        sust_name = s.get("Sustituto","")
        if sust_name and original_turno_largo:
            alias = original_turno_largo.upper().replace("Á","A").replace("É","E").replace("Í","I").replace("Ó","O").replace("Ú","U")
            meta = CODE_MAP.get(alias, None)
            if meta and meta["type"] != "Descanso":
                the_date = _coerce_date(base["Fecha"])
                start_dt = end_dt = None
                if meta["start"] and meta["end"]:
                    start_dt = datetime.combine(the_date, datetime.strptime(meta["start"], "%H:%M").time())
                    end_dt = datetime.combine(the_date, datetime.strptime(meta["end"], "%H:%M").time())
                    if end_dt <= start_dt: end_dt += timedelta(days=1)
                extra_rows.append({
                    **{k: base[k] for k in ("Hotel","Dia","Fecha","Semana")},
                    "Empleado": sust_name,
                    "Turno": meta["code"],
                    "TurnoLargo": meta["type"],
                    "TextoDia": meta["type"],
                    "NameColorC": "",
                    "Icono": "",
                    "Sustituto": "",
                    "TipoEmpleado": "Normal",
                    "SustitucionPor": base["Empleado"],
                    "OrderBaseHotel": base.get("OrderBaseHotel", 1_000_000),
                    "EmpleadoOrdenSemanaBase": base.get("EmpleadoOrdenSemanaBase", 1_000_000),
                    "OrderDia": base.get("OrderDia", 1_000_000),
                    "OrderSemana": base.get("OrderSemana", 1_000_000),
                    "VacSemana": 0,
                    "StartISO": start_dt.isoformat() if start_dt else None,
                    "EndISO": end_dt.isoformat() if end_dt else None,
                    "OrdenIndex": base.get("OrdenIndex", 1_000_000),
                })
    combined = calendar_rows + extra_rows

    # meta: noches por mes + orden por hotel
    def compute_nights_summary(rows):
        out = {}
        for r in rows:
            if (r.get("Turno") == "N") or (str(r.get("TurnoLargo","")).strip().lower() == "noche"):
                hotel = r.get("Hotel",""); emp = r.get("Empleado","")
                yymm = (r.get("Fecha","") or "")[:7]
                out.setdefault(hotel, {}).setdefault(emp, {}).setdefault(yymm, 0)
                out[hotel][emp][yymm] += 1
        return out
    resumen = compute_nights_summary(combined)

    orden_por_hotel = {}
    for r in combined:
        h = r.get("Hotel",""); e = r.get("Empleado",""); oi = int(r.get("OrdenIndex", 1_000_000))
        orden_por_hotel.setdefault(h, {})
        orden_por_hotel[h][e] = min(oi, orden_por_hotel[h].get(e, oi))
    orden_por_hotel = {h: [x for x,_ in sorted(d.items(), key=lambda kv: kv[1])] for h,d in orden_por_hotel.items()}

    return {"rows": combined, "meta": {"noches_por_mes": resumen, "orden_por_hotel": orden_por_hotel}}

def replace_const_data(html_text: str, data_obj: dict) -> str:
    json_blob = json.dumps(data_obj, ensure_ascii=False)
    m = re.search(r"(const\s+DATA\s*=\s*)(.*?)(;)", html_text, flags=re.DOTALL)
    if not m: return None
    return html_text[:m.start(1)] + m.group(1) + json_blob + m.group(3) + html_text[m.end(3):]

def minimal_html(data_obj: dict, now_str: str) -> str:
    json_text = json.dumps(data_obj, ensure_ascii=False)
    return ("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Cuadrante</title>"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px}"
            "table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px} th{background:#f3f4f6}"
            "small{color:#666}</style></head><body>"
            "<h1>Cuadrante <small>Generado " + now_str + "</small></h1>"
            "<script>const DATA = " + json_text + ";</script><div id=\"app\"></div>"
            "<script>const rows=DATA.rows||[];const t=document.createElement('table');"
            "t.innerHTML=`<thead><tr><th>Hotel</th><th>Fecha</th><th>Empleado</th><th>Turno</th><th>Sustituto</th><th>Cambio</th></tr></thead><tbody></tbody>`;"
            "const tb=t.querySelector('tbody');rows.forEach(r=>{const tr=document.createElement('tr');"
            "tr.innerHTML=`<td>${r.Hotel||''}</td><td>${r.Fecha||''}</td><td>${r.Empleado||''}</td><td>${r.TurnoLargo||r.Turno||''}</td><td>${r.Sustituto||''}</td><td>${r.CambioTurno||''}</td>`;tb.appendChild(tr);});"
            "document.getElementById('app').appendChild(t);</script></body></html>")

def main():
    data = build_dataset()
    # elegir plantilla
    html = None
    if TEMPLATE_INDEX.exists():
        html = TEMPLATE_INDEX.read_text(encoding="utf-8", errors="ignore")
    elif INDEX_HTML.exists():
        html = INDEX_HTML.read_text(encoding="utf-8", errors="ignore")

    now_str = datetime.now(LOCAL_TZ).strftime("%d/%m/%Y, %H:%M:%S")

    if html:
        replaced = replace_const_data(html, data)
        if replaced is not None:
            INDEX_HTML.write_text(replaced, encoding="utf-8")
            print(f"OK -> index.html actualizado (DATA.rows={len(data.get('rows',[]))})")
            return

    # si no hay plantilla válida, genera mínimo
    INDEX_HTML.write_text(minimal_html(data, now_str), encoding="utf-8")
    print(f"OK -> index.html creado (mínimo) (DATA.rows={len(data.get('rows',[]))})")

if __name__ == "__main__":
    sys.exit(main())
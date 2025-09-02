# -*- coding: utf-8 -*-
"""
Genera index.html usando tu plantilla y, para Sustituciones, PRIORIZA el CSV
generado por 'generar_turnos.py' (sustituciones_diagnostico.csv).
"""
import json, re, sys, tempfile, shutil, time as _time, os
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
CSV_DIAG = Path("sustituciones_diagnostico.csv")  # salida de generar_turnos.py

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

def _open_excel_with_fallback(path: Path) -> dict:
    last_exc = None
    for _ in range(3):
        try:
            return pd.read_excel(path, sheet_name=None, engine="openpyxl")
        except Exception as e:
            last_exc = e; _time.sleep(0.5)
    try:
        with tempfile.NamedTemporaryFile(suffix=path.suffix, delete=False) as tmp:
            tmp_path = Path(tmp.name)
        shutil.copy2(path, tmp_path)
        dfs = pd.read_excel(tmp_path, sheet_name=None, engine="openpyxl")
        try: tmp_path.unlink(missing_ok=True)
        except Exception: pass
        return dfs
    except Exception as e2:
        raise RuntimeError(f"No se pudo abrir el Excel: {path}\nPrimero: {last_exc}\nFallback: {e2}")

def _coerce_date(x):
    if x is None or (isinstance(x, float) and np.isnan(x)): return None
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

def _norm(x): return ("" if x is None else str(x)).strip()
def _upper(x): return _norm(x).upper()

def is_week_sheet(df: pd.DataFrame):
    cols = [str(c).strip().lower() for c in df.columns]
    return ("semana" in cols) and (("empleado" in cols) or ("empleada" in cols)) and (sum(1 for c in cols if c in DAY_NAMES) >= 5)

def parse_week_sheet(sheet_name: str, df: pd.DataFrame):
    df = df.copy(); df.columns = [str(c).strip() for c in df.columns]
    col_semana = next((c for c in df.columns if c.lower()=="semana"), None)
    col_emp = next((c for c in df.columns if c.lower() in ("empleado","empleada")), None)
    day_cols = [c for c in df.columns if c.lower() in DAY_NAMES]
    idx_map = {"lunes":0,"martes":1,"miércoles":2,"miercoles":2,"jueves":3,"viernes":4,"sábado":5,"sabado":5,"domingo":6}

    # orden base
    seen, current_order = set(), []
    for _, r0 in df.iterrows():
        n = _norm(r0.get(col_emp))
        if n and (n.lower() not in {"empleado","empleada","total","totales"}) and n not in seen:
            seen.add(n); current_order.append(n)
    order_index = {name:i for i,name in enumerate(current_order)}

    events = []
    for _, row in df.iterrows():
        emp = _norm(row.get(col_emp))
        week = _coerce_date(row.get(col_semana))
        if not emp or not week: continue
        for day in day_cols:
            v = _upper(row.get(day))
            if not v: continue
            typ = CODE_MAP.get(v, None)
            if typ is None:
                base = v.replace("Á","A").replace("É","E").replace("Í","I").replace("Ó","O").replace("Ú","U")
                typ = CODE_MAP.get(base, {"type": _norm(row.get(day)), "code": base or "TXT", "start": None, "end": None})
            the_date = week + timedelta(days=idx_map[day.lower()])
            # tiempos
            start_dt = end_dt = None
            if typ["start"] and typ["end"]:
                start_dt = datetime.combine(the_date, datetime.strptime(typ["start"], "%H:%M").time())
                end_dt = datetime.combine(the_date, datetime.strptime(typ["end"], "%H:%M").time())
                if end_dt <= start_dt: end_dt += timedelta(days=1)
            events.append({
                "Hotel": sheet_name, "Empleado": emp,
                "Dia": the_date.strftime("%A").capitalize(),
                "Fecha": the_date.isoformat(),
                "Turno": typ["code"], "TurnoLargo": typ["type"],
                "TextoDia": typ["type"],
                "NameColorC": "", "Icono": "", "Sustituto": "",
                "TipoEmpleado": "Normal", "SustitucionPor": "",
                "OrderBaseHotel": order_index.get(emp, 1_000_000),
                "EmpleadoOrdenSemanaBase": order_index.get(emp, 1_000_000),
                "OrderDia": order_index.get(emp, 1_000_000),
                "OrderSemana": order_index.get(emp, 1_000_000),
                "VacSemana": 0, "Semana": week.isoformat(),
                "StartISO": start_dt.isoformat() if start_dt else None,
                "EndISO": end_dt.isoformat() if end_dt else None,
                "OrdenIndex": order_index.get(emp, 1_000_000),
            })
    return events

def load_sustituciones_csv():
    if not CSV_DIAG.exists():
        return []
    df = pd.read_csv(CSV_DIAG, dtype=str, encoding="utf-8-sig")
    cols = {c.lower(): c for c in df.columns}
    def pick(*names):
        for n in names:
            if n in cols: return cols[n]
        return None
    c_hotel = pick("hotel")
    c_fecha = pick("fechanorm","fecha","fecha norm","fecha_norm")
    c_emp   = pick("empleado")
    c_sus   = pick("sustituto")
    c_cmb   = pick("cambiode_turno","cambio de turno","cambioturno","cambio")
    c_tipo  = pick("tipointerpretado","tipoausencia","tipo")
    out = []
    for _, r in df.iterrows():
        out.append({
            "Hotel": _norm(r.get(c_hotel)),
            "Fecha": _norm(r.get(c_fecha)),
            "Empleado": _norm(r.get(c_emp)),
            "Sustituto": _norm(r.get(c_sus)),
            "CambioTurno": _norm(r.get(c_cmb)),
            "Tipo": _norm(r.get(c_tipo)),
        })
    return out

def build_dataset():
    # Excel (solo para cuadrante semanal)
    excel_path = None
    for p in EXCEL_PATHS:
        if p.exists(): excel_path = p; break
    dfs = {}
    if excel_path:
        dfs = _open_excel_with_fallback(excel_path)

    # 1) filas de cuadrante
    calendar_rows = []
    for name, df in dfs.items():
        lname = name.strip().lower()
        if lname in {"datos de validación","datos de validacion"}: continue
        if is_week_sheet(df):
            calendar_rows.extend(parse_week_sheet(name, df))

    # 2) Sustituciones desde CSV de generar_turnos.py (prioritario)
    sust = load_sustituciones_csv()

    # 3) fusionar sobre calendar_rows
    idx = {(r["Hotel"].lower(), r["Empleado"].lower(), r["Fecha"]): i for i, r in enumerate(calendar_rows)}
    extra_rows = []
    for s in sust:
        key = (s["Hotel"].lower(), s["Empleado"].lower(), s["Fecha"])
        if key not in idx:
            continue
        i = idx[key]
        base = calendar_rows[i]
        original_turno_largo = base.get("TurnoLargo") or base.get("Turno")
        base["Sustituto"] = s.get("Sustituto","")
        base["CambioTurno"] = s.get("CambioTurno","")
        tipo = s.get("Tipo","")
        if tipo:
            # aplicar ausencia al titular
            alias = tipo.upper().replace("Á","A").replace("É","E").replace("Í","I").replace("Ó","O").replace("Ú","U")
            meta = CODE_MAP.get(alias, {"code":"TXT","type":tipo,"start":None,"end":None})
            base["Turno"] = meta["code"]
            base["TurnoLargo"] = meta["type"]
            base["TextoDia"] = meta["type"]
            base["StartISO"] = None; base["EndISO"] = None
        # fila para sustituto heredando turno original si era productivo
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
                    "Turno": meta["code"], "TurnoLargo": meta["type"],
                    "TextoDia": meta["type"],
                    "NameColorC": "", "Icono": "",
                    "Sustituto": "", "TipoEmpleado": "Normal",
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

    # meta
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
            "<h1>Cuadrante</h1>"
            "<script>const DATA = " + json_text + ";</script><div id=\"app\"></div>"
            "<script>const rows=DATA.rows||[];const t=document.createElement('table');"
            "t.innerHTML=`<thead><tr><th>Hotel</th><th>Fecha</th><th>Empleado</th><th>Turno</th><th>Sustituto</th><th>Cambio</th></tr></thead><tbody></tbody>`;"
            "const tb=t.querySelector('tbody');rows.forEach(r=>{const tr=document.createElement('tr');"
            "tr.innerHTML=`<td>${r.Hotel||''}</td><td>${r.Fecha||''}</td><td>${r.Empleado||''}</td><td>${r.TurnoLargo||r.Turno||''}</td><td>${r.Sustituto||''}</td><td>${r.CambioTurno||''}</td>`;tb.appendChild(tr);});"
            "document.getElementById('app').appendChild(t);</script></body></html>")

def main():
    data = build_dataset()
    # plantilla
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

    INDEX_HTML.write_text(minimal_html(data, now_str), encoding="utf-8")
    print(f"OK -> index.html creado (mínimo) (DATA.rows={len(data.get('rows',[]))})")

if __name__ == "__main__":
    sys.exit(main())
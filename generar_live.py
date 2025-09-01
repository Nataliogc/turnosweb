# -*- coding: utf-8 -*-
import json, re, sys, time as _time, tempfile, shutil
from pathlib import Path
from datetime import datetime
from dateutil import tz
import pandas as pd

LOCAL_TZ = tz.tzlocal()

EXCEL_PATHS = [
    Path(r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"),
    Path("Plantilla Cuadrante con Sustituciones v.6.0.xlsx"),
    Path("Plantilla Cuadrante.xlsx"),
]

LIVE_HTML = Path("live.html")

CSV_CANDIDATES = [
    Path("sustituciones.csv"),
    Path("Sustituciones.csv"),
    # soporte comodín: *.csv con 'sustit' en el nombre, se resuelve en runtime
]

def _open_excel_with_fallback(path: Path) -> dict:
    last_exc = None
    for _ in range(3):
        try:
            return pd.read_excel(path, sheet_name=None, engine="openpyxl")
        except Exception as e:
            last_exc = e; _time.sleep(0.4)
    # copia temporal
    try:
        with tempfile.NamedTemporaryFile(suffix=path.suffix, delete=False) as tmp:
            tmp_path = Path(tmp.name)
        shutil.copy2(path, tmp_path)
        dfs = pd.read_excel(tmp_path, sheet_name=None, engine="openpyxl")
        try: tmp_path.unlink(missing_ok=True)
        except Exception: pass
        return dfs
    except Exception as e2:
        print(f"[AVISO] No se pudo abrir Excel directo: {last_exc}; fallback: {e2}")
        return {}

DAY_NAMES = {"lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo"}

def is_week_sheet(df: pd.DataFrame):
    cols = [str(c).strip().lower() for c in df.columns]
    has_semana = "semana" in cols
    has_emp = ("empleado" in cols) or ("empleada" in cols)
    has_days = any(c in DAY_NAMES for c in cols)
    return has_semana and has_emp and has_days

def extract_order_from_week_sheet(sheet_name: str, df: pd.DataFrame):
    col_emp = next((c for c in df.columns if str(c).strip().lower() in ("empleado","empleada")), None)
    seen, orden = set(), []
    if col_emp:
        for v in df[col_emp]:
            if pd.isna(v): continue
            name = str(v).strip()
            if not name: continue
            if name.lower() in {"empleado","empleada","total","totales"}: continue
            if name not in seen:
                seen.add(name); orden.append(name)
    return {"nombre": sheet_name, "orden": orden}

def extract_order_from_any_employee_col(sheet_name: str, df: pd.DataFrame):
    # si no tiene Semana pero sí una columna Empleado, úsala
    col_emp = next((c for c in df.columns if str(c).strip().lower() in ("empleado","empleada","nombre")), None)
    seen, orden = set(), []
    if col_emp:
        for v in df[col_emp]:
            if pd.isna(v): continue
            name = str(v).strip()
            if not name: continue
            if name.lower() in {"empleado","empleada","total","totales"}: continue
            if name not in seen:
                seen.add(name); orden.append(name)
    return {"nombre": sheet_name, "orden": orden}

def load_sustituciones_from_excel(dfs: dict):
    out = []
    for name, df in dfs.items():
        lname = name.strip().lower()
        if "sustit" in lname:
            cols = {str(c).strip().lower(): c for c in df.columns}
            def pick(*xs):
                for k in xs:
                    if k in cols: return cols[k]
                return None
            c_fecha = pick("fecha","date","día","dia")
            c_hot = pick("hotel","centro","sede")
            c_emp = pick("empleado","empleada","nombre","worker")
            c_sus = pick("sustituto","sustituta","sub")
            c_tipo= pick("tipoausencia","tipo_ausencia","tipo")
            c_cmb = pick("cambio de turno","cambioturno","cambio")
            for _, row in df.iterrows():
                d = pd.to_datetime(row.get(c_fecha, ""), dayfirst=True, errors="coerce") if c_fecha else None
                out.append({
                    "fecha": (d.date().isoformat() if d is not pd.NaT else "") if d is not None else "",
                    "hotel": str(row.get(c_hot, "")).strip() if c_hot else "",
                    "empleado": str(row.get(c_emp, "")).strip() if c_emp else "",
                    "sustituto": str(row.get(c_sus, "")).strip() if c_sus else "",
                    "tipo": str(row.get(c_tipo, "")).strip() if c_tipo else "",
                    "cambio": str(row.get(c_cmb, "")).strip() if c_cmb else "",
                })
    return out

def _discover_csv_candidates():
    cands = list(CSV_CANDIDATES)
    # añade *.csv con 'sustit' en nombre
    for p in Path(".").glob("*.csv"):
        if "sustit" in p.name.lower() and p not in cands:
            cands.append(p)
    return cands

def load_sustituciones_from_csv():
    out = []
    for p in _discover_csv_candidates():
        if not p.exists():
            continue
        try:
            df = pd.read_csv(p, dtype=str)
            cols = {c.lower(): c for c in df.columns}
            def pick(*names):
                for n in names:
                    if n in cols: return cols[n]
                return None
            c_fecha = pick("fecha","date","día","dia")
            c_hot = pick("hotel","centro","sede")
            c_emp = pick("empleado","worker","nombre")
            c_sus = pick("sustituto","sustituta","sub")
            c_tipo= pick("tipoausencia","tipo_ausencia","tipo")
            c_cmb = pick("cambio de turno","cambioturno","cambio")
            for _, row in df.iterrows():
                fecha = str(row.get(c_fecha, "")).strip() if c_fecha else ""
                try:
                    d = pd.to_datetime(fecha, dayfirst=True, errors="coerce")
                    fecha_iso = d.date().isoformat() if d is not pd.NaT else ""
                except Exception:
                    fecha_iso = ""
                out.append({
                    "fecha": fecha_iso,
                    "hotel": str(row.get(c_hot, "")).strip() if c_hot else "",
                    "empleado": str(row.get(c_emp, "")).strip() if c_emp else "",
                    "sustituto": str(row.get(c_sus, "")).strip() if c_sus else "",
                    "tipo": str(row.get(c_tipo, "")).strip() if c_tipo else "",
                    "cambio": str(row.get(c_cmb, "")).strip() if c_cmb else "",
                })
        except Exception as e:
            print(f"[AVISO] No se pudo leer {p}: {e}")
    return out

def build_hoteles(dfs: dict, sustituciones: list):
    hoteles = []
    # 1) Preferimos hojas semanales
    for name, df in dfs.items():
        if is_week_sheet(df):
            hoteles.append(extract_order_from_week_sheet(name, df))
    # 2) Si no hubo, usamos cualquier hoja con columna Empleado
    if not hoteles:
        for name, df in dfs.items():
            hoteles.append(extract_order_from_any_employee_col(name, df))
        hoteles = [h for h in hoteles if h["orden"]]
    # 3) Si sigue vacío, derivamos del CSV/tabla larga
    if not hoteles and sustituciones:
        by_hotel = {}
        for s in sustituciones:
            h = s.get("hotel","").strip(); e = s.get("empleado","").strip()
            if not h or not e: continue
            by_hotel.setdefault(h, [])
            if e not in by_hotel[h]: by_hotel[h].append(e)
        hoteles = [{"nombre": h, "orden": orden} for h, orden in by_hotel.items()]
    return hoteles

def replace_const_data(html_text: str, data_obj: dict) -> str:
    json_blob = json.dumps(data_obj, ensure_ascii=False)
    m = re.search(r"(const\s+DATA\s*=\s*)(.*?)(;)", html_text, flags=re.DOTALL)
    if not m: return None
    return html_text[:m.start(1)] + m.group(1) + json_blob + m.group(3) + html_text[m.end(3):]

def minimal_html(data_obj: dict, now_str: str, excel_path: Path) -> str:
    json_text = json.dumps(data_obj, ensure_ascii=False)
    src = str(excel_path)
    return ("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Live</title>"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px}"
            "h2{margin-top:24px}.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:8px 0}"
            "small{color:#666}</style></head><body>"
            f"<h1>Live <small>Fuente: {src} · Generado: {now_str}</small></h1>"
            "<script>const DATA = " + json_text + ";</script><div id=\"app\"></div>"
            "<script>const app=document.getElementById('app');"
            "(DATA.hoteles||[]).forEach(h=>{const d=document.createElement('div');d.className='card';"
            "d.innerHTML = `<h2>${h.nombre}</h2><ol>` + (h.orden||[]).map(x=>`<li>${x}</li>`).join('') + `</ol>`; app.appendChild(d);});"
            "if ((DATA.sustituciones||[]).length){const s=document.createElement('div');s.className='card';"
            "s.innerHTML = '<h2>Sustituciones</h2>' + (DATA.sustituciones||[]).map(x=>`${x.fecha||''} – ${x.hotel||''} – ${x.empleado||''} → ${x.sustituto||''}`).join('<br>');"
            "app.appendChild(s);}"
            "</script></body></html>")

def main():
    # localizar Excel
    excel_path = None
    for p in EXCEL_PATHS:
        if p.exists(): excel_path = p; break

    dfs = _open_excel_with_fallback(excel_path) if excel_path else {}

    sust_excel = load_sustituciones_from_excel(dfs) if dfs else []
    sust_csv = load_sustituciones_from_csv()
    sustituciones = sust_excel + sust_csv

    hoteles = build_hoteles(dfs, sustituciones)

    payload = {"hoteles": hoteles, "sustituciones": sustituciones}
    now_str = datetime.now(LOCAL_TZ).strftime("%d/%m/%Y, %H:%M:%S")

    if LIVE_HTML.exists():
        html = LIVE_HTML.read_text(encoding="utf-8", errors="ignore")
        replaced = replace_const_data(html, payload)
        if replaced is not None:
            LIVE_HTML.write_text(replaced, encoding="utf-8")
            print(f"OK -> live.html actualizado (hoteles={len(hoteles)}, sustituciones={len(sustituciones)})")
            return

    LIVE_HTML.write_text(minimal_html(payload, now_str, excel_path or Path('')), encoding="utf-8")
    print(f"OK -> live.html creado (mínimo) (hoteles={len(hoteles)}, sustituciones={len(sustituciones)})")

if __name__ == "__main__":
    sys.exit(main())
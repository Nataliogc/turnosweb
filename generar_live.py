# -*- coding: utf-8 -*-
"""
Genera live.html leyendo SIEMPRE las sustituciones desde 'sustituciones_diagnostico.csv'
(si existe) y, si no, cae al Excel/CSV genéricos.
"""
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
CSV_DIAG = Path("sustituciones_diagnostico.csv")

EMP_KEYS = {"empleado","empleada","nombre"}
DAY_NAMES = {"lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo"}

def _open_excel_with_fallback(path: Path) -> dict:
    last_exc = None
    for _ in range(3):
        try:
            return pd.read_excel(path, sheet_name=None, engine="openpyxl")
        except Exception as e:
            last_exc = e; _time.sleep(0.4)
    try:
        with tempfile.NamedTemporaryFile(suffix=path.suffix, delete=False) as tmp:
            tmp_path = Path(tmp.name)
        shutil.copy2(path, tmp_path)
        dfs = pd.read_excel(tmp_path, sheet_name=None, engine="openpyxl")
        try: tmp_path.unlink(missing_ok=True)
        except Exception: pass
        return dfs
    except Exception as e2:
        print(f"[AVISO] Excel inaccesible: {last_exc}; fallback: {e2}")
        return {}

def norm(s): return ("" if s is None else str(s)).strip()

def is_week_sheet(df: pd.DataFrame):
    cols = [str(c).strip().lower() for c in df.columns]
    has_semana = "semana" in cols
    has_emp = any(c in EMP_KEYS for c in cols)
    has_day = any(c in DAY_NAMES for c in cols)
    return has_semana and has_emp and has_day

def extract_order_from_week_sheet(sheet_name: str, df: pd.DataFrame):
    col_emp = next((c for c in df.columns if str(c).strip().lower() in EMP_KEYS), None)
    seen, orden = set(), []
    if col_emp:
        for v in df[col_emp]:
            name = norm(v)
            if not name: continue
            if name.lower() in {"empleado","empleada","total","totales"}: continue
            if name not in seen:
                seen.add(name); orden.append(name)
    return {"nombre": sheet_name, "orden": orden}

def build_hoteles(dfs: dict, sustituciones: list):
    hoteles = []
    for name, df in dfs.items():
        if is_week_sheet(df):
            hoteles.append(extract_order_from_week_sheet(name, df))
    if hoteles: return hoteles
    # derivar desde CSV de sustituciones si no hay hojas semanales
    by_hotel = {}
    for s in sustituciones:
        h = s.get("hotel",""); e = s.get("empleado","")
        if not h or not e: continue
        by_hotel.setdefault(h, [])
        if e not in by_hotel[h]: by_hotel[h].append(e)
    return [{"nombre": h, "orden": o} for h,o in by_hotel.items()]

def load_sustituciones_from_diag_csv():
    if not CSV_DIAG.exists():
        return []
    df = pd.read_csv(CSV_DIAG, dtype=str, encoding="utf-8-sig")
    cols = {c.lower(): c for c in df.columns}
    def pick(*names):
        for n in names:
            if n in cols: return cols[n]
        return None
    c_fecha = pick("fechanorm","fecha","fecha norm","fecha_norm")
    c_hot = pick("hotel")
    c_emp = pick("empleado")
    c_sus = pick("sustituto")
    c_tipo= pick("tipointerpretado","tipoausencia","tipo")
    c_cmb = pick("cambiode_turno","cambio de turno","cambioturno","cambio")
    out = []
    for _, row in df.iterrows():
        out.append({
            "fecha": norm(row.get(c_fecha)),
            "hotel": norm(row.get(c_hot)),
            "empleado": norm(row.get(c_emp)),
            "sustituto": norm(row.get(c_sus)),
            "tipo": norm(row.get(c_tipo)),
            "cambio": norm(row.get(c_cmb)),
        })
    return out

def replace_const_data(html_text: str, data_obj: dict) -> str:
    import json as _json, re
    json_blob = _json.dumps(data_obj, ensure_ascii=False)
    m = re.search(r"(const\s+DATA\s*=\s*)(.*?)(;)", html_text, flags=re.DOTALL)
    if not m: return None
    return html_text[:m.start(1)] + m.group(1) + json_blob + m.group(3) + html_text[m.end(3):]

def minimal_html(data_obj: dict, now_str: str) -> str:
    import json as _json
    json_text = _json.dumps(data_obj, ensure_ascii=False)
    return ("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Live</title>"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px}"
            "h2{margin-top:24px}.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:8px 0}"
            "small{color:#666}</style></head><body>"
            "<h1>Live</h1>"
            "<script>const DATA = " + json_text + ";</script><div id=\"app\"></div>"
            "<script>const app=document.getElementById('app');"
            "(DATA.hoteles||[]).forEach(h=>{const d=document.createElement('div');d.className='card';"
            "d.innerHTML = `<h2>${h.nombre}</h2><ol>` + (h.orden||[]).map(x=>`<li>${x}</li>`).join('') + `</ol>`; app.appendChild(d);});"
            "if ((DATA.sustituciones||[]).length){const s=document.createElement('div');s.className='card';"
            "s.innerHTML = '<h2>Sustituciones</h2>' + (DATA.sustituciones||[]).map(x=>`${x.fecha||''} - ${x.hotel||''} - ${x.empleado||''} -> ${x.sustituto||''} (${x.tipo||''} ${x.cambio||''})`).join('<br>');"
            "app.appendChild(s);}"
            "</script></body></html>")

def main():
    # Sustituciones: primero el CSV de generar_turnos.py
    sustituciones = load_sustituciones_from_diag_csv()

    # Excel opcional (para orden desde hojas semanales)
    excel_path = None
    for p in EXCEL_PATHS:
        if p.exists(): excel_path = p; break
    dfs = _open_excel_with_fallback(excel_path) if excel_path else {}

    hoteles = build_hoteles(dfs, sustituciones)

    payload = {"hoteles": hoteles, "sustituciones": sustituciones}
    now_str = datetime.now(LOCAL_TZ).strftime("%d/%m/%Y, %H:%M:%S")

    # Carga HTML actual y sustituye DATA
    if LIVE_HTML.exists():
        html = LIVE_HTML.read_text(encoding="utf-8", errors="ignore")
        replaced = replace_const_data(html, payload)
        if replaced is not None:
            LIVE_HTML.write_text(replaced, encoding="utf-8")
            print(f"OK -> live.html actualizado (hoteles={len(hoteles)}, sustituciones={len(sustituciones)})")
            return

    # Si no hay plantilla, genera mínimo
    LIVE_HTML.write_text(minimal_html(payload, now_str), encoding="utf-8")
    print(f"OK -> live.html creado (hoteles={len(hoteles)}, sustituciones={len(sustituciones)})")

if __name__ == "__main__":
    sys.exit(main())

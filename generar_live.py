
# -*- coding: utf-8 -*-
import json, re, sys, tempfile, shutil, time as _time
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
SUSTI_CANDIDATES = [Path("sustituciones.csv"), Path("sustituciones.tsv")]
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

def is_week_sheet(df: pd.DataFrame):
    cols = [str(c).strip().lower() for c in df.columns]
    return ("semana" in cols) and (("empleado" in cols) or ("empleada" in cols)) and (sum(1 for c in cols if c in DAY_NAMES) >= 5)

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

def load_sustituciones_from_excel(dfs: dict):
    out = []
    for name, df in dfs.items():
        if "sustit" in name.strip().lower():
            cols = {str(c).strip().lower(): c for c in df.columns}
            def pick(*xs):
                for k in xs:
                    if k in cols: return cols[k]
                return None
            c_fecha = pick("fecha","date","día","dia")
            c_hot = pick("hotel","centro","sede")
            c_emp = pick("empleado","empleada","nombre","worker")
            c_sus = pick("sustituto","sustituta","sub")
            for _, row in df.iterrows():
                d = pd.to_datetime(row.get(c_fecha, ""), dayfirst=True, errors="coerce") if c_fecha else None
                out.append({
                    "fecha": (d.date().isoformat() if d is not pd.NaT else "") if d is not None else "",
                    "hotel": str(row.get(c_hot, "")).strip() if c_hot else "",
                    "empleado": str(row.get(c_emp, "")).strip() if c_emp else "",
                    "sustituto": str(row.get(c_sus, "")).strip() if c_sus else "",
                })
    return out

def load_sustituciones_from_files():
    for p in SUSTI_CANDIDATES:
        if p.exists():
            try:
                if p.suffix.lower()==".csv":
                    df = pd.read_csv(p, dtype=str, sep=",")
                else:
                    df = pd.read_csv(p, dtype=str, sep="\t")
                cols = {c.lower(): c for c in df.columns}
                def pick(*names):
                    for n in names:
                        if n in cols: return cols[n]
                    return None
                c_fecha = pick("fecha","date","día","dia")
                c_hot = pick("hotel","centro","sede")
                c_emp = pick("empleado","worker","nombre")
                c_sus = pick("sustituto","sustituta","sub")
                out = []
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
                    })
                return out
            except Exception:
                pass
    return []

def replace_const_data(html_text: str, data_obj: dict) -> str:
    json_blob = json.dumps(data_obj, ensure_ascii=False)
    m = re.search(r"(const\s+DATA\s*=\s*)(.*?)(;)", html_text, flags=re.DOTALL)
    if not m: return None
    return html_text[:m.start(1)] + m.group(1) + json_blob + m.group(3) + html_text[m.end(3):]

def minimal_html(data_obj: dict, now_str: str) -> str:
    json_text = json.dumps(data_obj, ensure_ascii=False)
    return ("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Live</title>"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px}"
            "h2{margin-top:24px}.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:8px 0}"
            "small{color:#666}</style></head><body>"
            "<h1>Orden + Sustituciones <small>Generado " + now_str + "</small></h1>"
            "<script>const DATA = " + json_text + ";</script><div id=\"app\"></div>"
            "<script>const app=document.getElementById('app');"
            "(DATA.hoteles||[]).forEach(h=>{const d=document.createElement('div');d.className='card';"
            "d.innerHTML = `<h2>${h.nombre}</h2><ol>` + (h.orden||[]).map(x=>`<li>${x}</li>`).join('') + `</ol>`; app.appendChild(d);});"
            "if ((DATA.sustituciones||[]).length){const s=document.createElement('div');s.className='card';"
            "s.innerHTML = '<h2>Sustituciones</h2>' + (DATA.sustituciones||[]).map(x=>`${x.fecha||''} – ${x.hotel||''} – ${x.empleado||''} → ${x.sustituto||''}`).join('<br>');"
            "app.appendChild(s);}"
            "</script></body></html>")

def main():
    # Excel
    excel_path = None
    for p in EXCEL_PATHS:
        if p.exists(): excel_path = p; break
    if not excel_path: raise FileNotFoundError(f"No se encontró Excel en {EXCEL_PATHS}")
    dfs = _open_excel_with_fallback(excel_path)

    sust = load_sustituciones_from_excel(dfs) + load_sustituciones_from_files()
    hoteles = [extract_order_from_week_sheet(name, df) for name, df in dfs.items() if is_week_sheet(df)]

    payload = {"hoteles": hoteles, "sustituciones": sust}
    now_str = datetime.now(LOCAL_TZ).strftime("%d/%m/%Y, %H:%M:%S")

    if LIVE_HTML.exists():
        html = LIVE_HTML.read_text(encoding="utf-8", errors="ignore")
        replaced = replace_const_data(html, payload)
        if replaced is not None:
            LIVE_HTML.write_text(replaced, encoding="utf-8")
            print(f"OK -> live.html actualizado (hoteles={len(hoteles)}, sustituciones={len(sust)})")
            return

    LIVE_HTML.write_text(minimal_html(payload, now_str), encoding="utf-8")
    print(f"OK -> live.html creado (mínimo) (hoteles={len(hoteles)}, sustituciones={len(sust)})")

if __name__ == "__main__":
    sys.exit(main())

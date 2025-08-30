# -*- coding: utf-8 -*-
"""
Genera JSON embebido en index.html a partir del Excel de Sustituciones,
utilizando la plantilla visual con __DATA_JSON__.
"""

import os, json, traceback, sys, time
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import tempfile, shutil

# =====================
# CONFIGURACIÓN
# =====================
EXCEL_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
SHEET_NAME = "Sustituciones"
OUT_HTML   = Path(__file__).resolve().parent / "index.html"
PAUSE_ON_EXIT = True

# =====================
# FUNCIONES AUXILIARES
# =====================

def _canon(s):
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    return str(s).strip()

def _parse_fecha(v):
    if v is None: return ""
    try:
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
    except Exception:
        dt = pd.NaT
    return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")

# Escritura atómica para HTML

def ensure_parent(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)

def write_atomic(target_path: Path, data: str, encoding: str = "utf-8"):
    ensure_parent(target_path)
    with tempfile.NamedTemporaryFile("w", delete=False, encoding=encoding, newline="\n") as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    shutil.move(str(tmp_path), str(target_path))

def write_html_safely(html_text: str, out_path: Path) -> Path:
    stamp = f"<!-- build: {datetime.now().isoformat(timespec='seconds')} -->\n"
    payload = stamp + html_text
    write_atomic(out_path, payload)
    print(f"✅ HTML escrito: {out_path}")
    return out_path

# =====================
# PROCESO PRINCIPAL
# =====================

def main():
    if not os.path.exists(EXCEL_PATH):
        print("❌ No se encuentra el Excel:", EXCEL_PATH)
        return
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    except Exception as e:
        print("❌ No se pudo abrir el Excel:", e)
        return

    rows = []
    for _, r in df.iterrows():
        hotel = _canon(r.get("Hotel"))
        fecha = _parse_fecha(r.get("Fecha"))
        emp   = _canon(r.get("Empleado"))
        turno = _canon(r.get("Turno"))
        turnoL= _canon(r.get("TurnoLargo")) or turno
        texto = _canon(r.get("Cambio de Turno")) or turnoL
        if not (hotel and fecha and emp):
            continue
        rows.append({
            "Hotel": hotel,
            "Empleado": emp,
            "Fecha": fecha,
            "Turno": turno,
            "TurnoLargo": turnoL,
            "TextoDia": texto,
        })

    data_json = json.dumps({"rows": rows}, ensure_ascii=False)

    # Leer plantilla index.html actual (con __DATA_JSON__)
    try:
        tpl = Path(__file__).resolve().parent.joinpath("index_template.html").read_text(encoding="utf-8")
    except FileNotFoundError:
        print("❌ Falta index_template.html con marcador __DATA_JSON__")
        return

    html = tpl.replace("__DATA_JSON__", data_json)
    write_html_safely(html, OUT_HTML)

if __name__ == "__main__":
    start = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        print("⏱ Inicio:", start)
        main()
        print("✔️ Fin correcto")
    except Exception:
        tb = traceback.format_exc()
        print("❌ Error:\n", tb)
    finally:
        sys.stdout.flush(); sys.stderr.flush()
        time.sleep(0.3)
        if PAUSE_ON_EXIT:
            try: input("Pulsa ENTER para cerrar…")
            except: pass

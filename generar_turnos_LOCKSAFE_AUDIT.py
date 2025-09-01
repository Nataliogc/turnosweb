# -*- coding: utf-8 -*-
"""
Genera/reescribe 'sustituciones_diagnostico.csv' a partir de la hoja 'Sustituciones'
del Excel en OneDrive.

- Sin carpetas extra ni HTML.
- Parseo de fecha robusto (lu 09/jun 25, etc.).
- Manejo de bloqueo OneDrive/Excel (copia temporal si está en uso).
- **Auditoría por consola**: totales por hotel, por mes y por hotel×mes,
  además de rango de fechas por hotel y número de filas sin fecha.
"""

import os, re, unicodedata, shutil, time, tempfile
import pandas as pd
import numpy as np
from datetime import datetime

# =====================
# CONFIGURACIÓN
# =====================
EXCEL_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
SHEET_NAME = "Sustituciones"
OUT_CSV    = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\sustituciones_diagnostico.csv"
PAUSE_ON_EXIT = True

# =====================
# UTILIDADES
# =====================
def _canon(s):
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    return str(s).strip()

_MESES = {"ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06","jul":"07","ago":"08","sep":"09","set":"09","oct":"10","nov":"11","dic":"12"}
_DOW_RE = re.compile(r'^(lu|lun|ma|mar|mi|mie|mié|ju|jue|vi|vie|sa|sab|sáb|do|dom)[\.\s]+', re.IGNORECASE)

def _strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def _parse_fecha(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "", ""
    orig = str(v)
    if isinstance(v, (datetime, pd.Timestamp)) and not pd.isna(v):
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
        return orig, ("" if pd.isna(dt) else dt.strftime("%Y-%m-%d"))
    s = _strip_accents(orig).lower().strip()
    s = _DOW_RE.sub("", s)
    s = s.replace(" de ", " ").replace(" del ", " ").replace("-", "/").replace(".", "/")
    s = re.sub(r"\s+", " ", s)
    m = re.search(r'(\d{1,2})[\/\s]([a-z]{3,4})[\/\s](\d{2,4})', s)
    if m:
        dd = int(m.group(1)); mon_txt = m.group(2)[:3]; yy = int(m.group(3))
        if yy < 100: yy += 2000
        mon = _MESES.get(mon_txt, None)
        if mon: return orig, f"{yy:04d}-{mon}-{dd:02d}"
    m2 = re.search(r'(\d{1,2})\/(\d{1,2})\/(\d{2,4})', s)
    if m2:
        dd = int(m2.group(1)); mm = int(m2.group(2)); yy = int(m2.group(3))
        if yy < 100: yy += 2000
        return orig, f"{yy:04d}-{mm:02d}-{dd:02d}"
    dt = pd.to_datetime(orig, dayfirst=True, errors="coerce")
    return orig, ("" if pd.isna(dt) else dt.strftime("%Y-%m-%d"))

def _tipo_interpretado(txt):
    t = _canon(txt).lower()
    if "vaca" in t: return "Vacaciones"
    if "baja" in t or " it" in t or t == "it": return "Baja"
    if "perm" in t: return "Permiso"
    if "form" in t or "curso" in t: return "Formación"
    if "fest" in t: return "Festivo"
    if "lib" in t: return "Libranza"
    if "desc" in t: return "Descanso"
    return ""

def _open_excel_with_retry(path, max_tries=5, wait=0.6):
    last_err = None
    for _ in range(max_tries):
        try:
            xls = pd.ExcelFile(path)
            return xls, None
        except (PermissionError, OSError) as e:
            last_err = e
            time.sleep(wait)
    # Copia temporal si sigue bloqueado
    tmp_path = os.path.join(tempfile.gettempdir(), f"_tmp_excel_{int(time.time()*1000)}.xlsx")
    for _ in range(max_tries):
        try:
            shutil.copy2(path, tmp_path)
            xls = pd.ExcelFile(tmp_path)
            return xls, tmp_path
        except Exception as e:
            last_err = e
            time.sleep(wait)
    raise last_err if last_err else RuntimeError("No se pudo abrir ni copiar el Excel.")

# =====================
# PROCESO PRINCIPAL
# =====================
def main():
    excel_path = EXCEL_PATH
    out_csv    = OUT_CSV

    if not os.path.exists(excel_path):
        print("❌ No se encuentra el Excel:", excel_path)
        return

    tmp_copy = None
    try:
        xls, tmp_copy = _open_excel_with_retry(excel_path)
    except Exception as e:
        print("❌ No se pudo abrir el Excel:", e)
        return

    try:
        if SHEET_NAME not in xls.sheet_names:
            print("❌ La hoja '{}' no existe en el Excel.".format(SHEET_NAME)); return

        df = pd.read_excel(xls, sheet_name=SHEET_NAME)
        total_leidas = len(df)

        # Columnas mínimas esperadas
        for col in ["Hotel","Fecha","Empleado","Cambio de Turno","Sustituto","TipoAusencia"]:
            if col not in df.columns:
                df[col] = ""

        # Inventario de empleados en hojas de hotel
        empleados_hoteles = set()
        for sh in xls.sheet_names:
            if sh in (SHEET_NAME, "Datos de Validación"):
                continue
            try:
                dfh = pd.read_excel(xls, sheet_name=sh)
                if "Empleado" in dfh.columns:
                    empleados_hoteles.update(dfh["Empleado"].dropna().astype(str).str.strip().tolist())
            except Exception:
                pass

        rows = []
        vacios_fecha = 0
        for _, r in df.iterrows():
            hotel      = _canon(r.get("Hotel",""))
            f_orig, f_norm = _parse_fecha(r.get("Fecha",""))
            if not f_norm: vacios_fecha += 1
            empleado   = _canon(r.get("Empleado",""))
            cambio     = _canon(r.get("Cambio de Turno",""))
            sustituto  = _canon(r.get("Sustituto",""))
            tipo       = _canon(r.get("TipoAusencia",""))

            tipo_i = _tipo_interpretado(tipo) or ("Cambio de turno" if cambio else "")
            existe_fecha   = True if f_norm else False
            existe_titular = (empleado in empleados_hoteles) if empleado else False
            existe_otro    = (sustituto in empleados_hoteles) if sustituto else False

            rows.append({
                "Hotel": hotel,
                "FechaOriginal": f_orig,
                "FechaNorm": f_norm,
                "Empleado": empleado,
                "CambioDeTurno": cambio,
                "Sustituto": sustituto,
                "TipoAusencia": tipo,
                "TipoInterpretado": tipo_i,
                "ExisteFechaEnHotel": existe_fecha,
                "ExisteTitular": existe_titular,
                "ExisteOtro": existe_otro,
                "OtroTexto": "",
                "Motivo": tipo_i,
            })

        out = pd.DataFrame(rows, columns=[
            "Hotel","FechaOriginal","FechaNorm","Empleado","CambioDeTurno","Sustituto",
            "TipoAusencia","TipoInterpretado","ExisteFechaEnHotel","ExisteTitular",
            "ExisteOtro","OtroTexto","Motivo"
        ])
        out.to_csv(out_csv, index=False, encoding="utf-8-sig")

        # ===== AUDITORÍA EN CONSOLA =====
        out["_Mes"] = out["FechaNorm"].fillna("").str.slice(0,7)
        print("\n--- Totales ---")
        print("Filas leídas hoja Sustituciones:", total_leidas)
        print("Filas exportadas CSV:", len(out))
        print("Filas con FechaNorm vacía:", (out["FechaNorm"]=="").sum())

        print("\n--- Por Hotel ---")
        try:
            print(out["Hotel"].value_counts(dropna=False).to_string())
        except Exception:
            pass

        print("\n--- Por Mes (YYYY-MM) ---")
        try:
            vc = out["_Mes"].value_counts()
            print(vc.to_string())
        except Exception:
            pass

        print("\n--- Hotel × Mes ---")
        try:
            g = out.groupby(["Hotel","_Mes"]).size().reset_index(name="filas")
            # Orden natural por hotel y mes
            g = g.sort_values(["Hotel","_Mes"])
            print(g.to_string(index=False))
        except Exception:
            pass

        print("\n--- Rango de fechas por Hotel ---")
        try:
            rng = (out[out["FechaNorm"]!=""]
                   .groupby("Hotel")["FechaNorm"]
                   .agg(primera="min", ultima="max")
                   .reset_index())
            print(rng.to_string(index=False))
        except Exception:
            pass

        print("\n✅ Reescrito:", out_csv)
    finally:
        try:
            xls.close()
        except Exception:
            pass
        if tmp_copy and os.path.exists(tmp_copy):
            try: os.remove(tmp_copy)
            except Exception: pass

if __name__ == "__main__":
    import sys, traceback, time
    try:
        LOG_PATH = os.path.join(os.path.dirname(OUT_CSV), "sustituciones_diagnostico_log.txt")
    except Exception:
        LOG_PATH = os.path.join(os.getcwd(), "sustituciones_diagnostico_log.txt")

    start_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        print("⏱ Inicio:", start_ts)
        main()
        print("✔️ Fin correcto")
        with open(LOG_PATH, "a", encoding="utf-8") as lf:
            lf.write("[{}] OK - Ejecutado sin errores.\n".format(start_ts))
    except Exception:
        err_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        tb = traceback.format_exc()
        print("❌ Error durante la ejecución:\n" + tb)
        try:
            with open(LOG_PATH, "a", encoding="utf-8") as lf:
                lf.write("[{}] ERROR - {}\n".format(err_ts, tb))
            print("📝 Detalle del error guardado en:", LOG_PATH)
        except Exception:
            pass
    finally:
        sys.stdout.flush(); sys.stderr.flush()
        time.sleep(0.3)
        if PAUSE_ON_EXIT:
            try:
                input("\nPulsa ENTER para cerrar…")
            except Exception:
                pass

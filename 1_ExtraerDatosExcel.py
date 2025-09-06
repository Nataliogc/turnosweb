# 1_ExtraerDatosExcel.py
# Exporta hojas del Excel maestro a CSV con autodetección de ruta y trazas claras.

import pandas as pd
from pathlib import Path
from datetime import datetime

# ========= CONFIG =========
# Candidatos donde puede estar el Excel maestro (el primero que exista y sea más reciente se usa).
CANDIDATE_PATHS = [
    r"C:\Users\comun\Documents\Turnos web\Plantilla Cuadrante con Sustituciones v.6.0.xlsx",
    r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx",
]

# Hojas a exportar -> nombre de CSV de salida (en la carpeta del script)
SHEETS_TO_EXPORT = {
    "Sustituciones": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sustituciones.csv",
    "Cumbria Spa&Hotel": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Cumbria Spa&Hotel.csv",
    "Sercotel Guadiana": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sercotel Guadiana.csv",
}
# =========================

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE  # CSVs se generan junto al script

def pick_excel_path() -> Path | None:
    """Devuelve la ruta del Excel a usar:
    - elige entre CANDIDATE_PATHS los que existan
    - si hay varios, usa el de última modificación más reciente
    """
    existing = []
    for raw in CANDIDATE_PATHS:
        p = Path(raw)
        if p.exists():
            try:
                ts = p.stat().st_mtime
            except Exception:
                ts = 0
            existing.append((ts, p))
    if not existing:
        return None
    # más reciente primero
    existing.sort(key=lambda x: x[0], reverse=True)
    return existing[0][1]

def fmt_ts(path: Path) -> str:
    try:
        dt = datetime.fromtimestamp(path.stat().st_mtime)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "N/A"

def main():
    print("Iniciando la exportación de Excel a CSV...")

    excel_path = pick_excel_path()
    if not excel_path:
        print("[ERROR] No se encontró el Excel maestro en ninguna de estas rutas:")
        for c in CANDIDATE_PATHS:
            print(f"  - {c}")
        print("      → Coloca el archivo en 'Documents\\Turnos web' o actualiza CANDIDATE_PATHS.")
        return

    print(f"[INFO] Usando Excel: {excel_path}")
    print(f"[INFO] Última modificación del Excel: {fmt_ts(excel_path)}")

    try:
        # Lee de una vez todas las hojas requeridas
        excel_data = pd.read_excel(
            excel_path,
            sheet_name=list(SHEETS_TO_EXPORT.keys()),
            engine="openpyxl"
        )

        for sheet_name, output_filename in SHEETS_TO_EXPORT.items():
            if sheet_name not in excel_data:
                print(f"[WARN] La hoja '{sheet_name}' no existe en el Excel. Se omite.")
                continue

            df = excel_data[sheet_name].copy()

            # Si hay columna 'Semana', dejamos formato dd/mm/aaaa
            if "Semana" in df.columns:
                try:
                    df["Semana"] = pd.to_datetime(df["Semana"]).dt.strftime("%d/%m/%Y")
                except Exception:
                    # Si ya es texto con formato, seguimos
                    pass

            out_path = OUTPUT_DIR / output_filename
            # Guardar como UTF-8 (sin BOM), sobrescribe
            df.to_csv(out_path, index=False, encoding="utf-8", lineterminator="\n")
            print(f"  - Hoja '{sheet_name}' exportada → '{out_path.name}' (modificado: {fmt_ts(out_path)})")

        print("[OK] Todas las hojas han sido exportadas a CSV con éxito.")

    except Exception as e:
        print(f"[ERROR] Ha ocurrido un error al procesar el archivo Excel: {e}")
        print("        Comprueba nombres de hojas y que el archivo no esté protegido o abierto.")

if __name__ == "__main__":
    main()

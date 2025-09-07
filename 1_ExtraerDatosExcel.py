# 0_exportar_excel_a_csv.py
# Este script lee el archivo Excel maestro y exporta las hojas necesarias a CSV.

import pandas as pd
from pathlib import Path

# --- CONFIGURACIÓN ---
# ¡IMPORTANTE! Esta es la ruta completa a tu archivo Excel maestro.
# Si lo mueves de sitio, solo tendrás que cambiar esta línea.
EXCEL_FILE_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"

# Define las hojas que queremos exportar y cómo se llamarán los archivos CSV de salida.
SHEETS_TO_EXPORT = {
    "Sustituciones": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sustituciones.csv",
    "Cumbria Spa&Hotel": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Cumbria Spa&Hotel.csv",
    "Sercotel Guadiana": "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sercotel Guadiana.csv"
}

# La carpeta donde se guardarán los CSV (la misma carpeta donde está este script).
OUTPUT_DIR = Path(__file__).resolve().parent

def main():
    """Función principal para exportar las hojas del Excel a CSV."""
    print("Iniciando la exportación de Excel a CSV...")

    excel_path = Path(EXCEL_FILE_PATH)
    if not excel_path.exists():
        print(f"[ERROR] No se encuentra el archivo Excel en la ruta especificada:")
        print(f"  > {EXCEL_FILE_PATH}")
        print("  > Por favor, revisa la variable EXCEL_FILE_PATH en el script.")
        return

    try:
        # Leemos todas las hojas necesarias del archivo Excel de una sola vez
        excel_data = pd.read_excel(excel_path, sheet_name=list(SHEETS_TO_EXPORT.keys()), engine='openpyxl')

        # Exportamos cada hoja a su correspondiente archivo CSV
        for sheet_name, output_filename in SHEETS_TO_EXPORT.items():
            df = excel_data[sheet_name]
            output_path = OUTPUT_DIR / output_filename
            
            # Formateamos la columna 'Semana' para que mantenga el formato de fecha corta
            if 'Semana' in df.columns:
                df['Semana'] = pd.to_datetime(df['Semana']).dt.strftime('%d/%m/%Y')

            df.to_csv(output_path, index=False, encoding='utf-8')
            print(f"  - Hoja '{sheet_name}' exportada correctamente a '{output_filename}'")

        print("[OK] Todas las hojas han sido exportadas a CSV con éxito.")

    except Exception as e:
        print(f"[ERROR] Ha ocurrido un error al procesar el archivo Excel: {e}")
        print("        Asegúrate de que las librerías están instaladas (pip install pandas openpyxl)")
        print("        y de que los nombres de las hojas en el Excel coinciden con los del script.")

if __name__ == "__main__":
    main()
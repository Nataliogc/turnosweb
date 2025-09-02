# coding: utf-8
"""
generar_index_NEW.py
--------------------
Genera 'index.html' a partir de:
 - plantilla: 'turnos_final.html' (debe contener __DATA_PLACEHOLDER__)
 - datos:     'sustituciones_diagnostico.csv'

Es robusto con los encabezados y admite CSV con columnas en español.
"""
import os, sys, csv, json
from datetime import datetime

AQUI = os.path.dirname(__file__)
CSV_PATH = os.path.join(AQUI, "sustituciones_diagnostico.csv")
TPL_PATH = os.path.join(AQUI, "turnos_final.html")
OUT_PATH = os.path.join(AQUI, "index.html")

NEEDED = ["Hotel","Fecha","Empleado","TurnoLargo","Turno","Icono","Sustituto","SustitucionPor"]

def _parse_date(s):
    s = (s or "").strip()
    if not s:
        return ""
    # intenta formatos comunes
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except Exception:
            pass
    # puede venir como 'yyyy-mm-dd hh:mm:ss'
    try:
        return datetime.fromisoformat(s.strip()[:19]).strftime("%Y-%m-%d")
    except Exception:
        return ""

def read_csv_rows(path):
    if not os.path.exists(path):
        raise SystemExit(f"ERROR: No existe el CSV: {path}")
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        sniffer = csv.Sniffer()
        sample = f.read(2048)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample) if sample else csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        headers = [h.strip() for h in reader.fieldnames or []]
        lower = [h.lower() for h in headers]

        # mapeo flexible
        def find(*names, idx=None):
            # busca por nombre; si no, usa posición (A=0,B=1...)
            for n in names:
                if n.lower() in lower:
                    return headers[lower.index(n.lower())]
            if idx is not None and idx < len(headers):
                return headers[idx]
            return None

        col_hotel = find("Hotel","Hoteles","A", idx=0)
        col_fecha = find("Fecha","Dia","Date","B", idx=1)
        # intentos razonables para empleado/turno
        col_emp   = find("Empleado","Trabajador","Nombre","C", idx=2)
        col_turno = find("TurnoLargo","Turno","Horario","D", idx=3)
        col_cambio= find("Cambio","Cambios","CambioTurno","E", idx=4)
        col_sust  = find("Sustituto","Sustituye","Sustitucion","F", idx=5)

        for i,row in enumerate(reader, start=2):
            hotel = (row.get(col_hotel,"") or "").strip()
            fecha = _parse_date(row.get(col_fecha,"") or "")
            emp   = (row.get(col_emp,"") or "").strip()
            turno = (row.get(col_turno,"") or "").strip()
            cambio= (row.get(col_cambio,"") or "").strip()
            sust  = (row.get(col_sust,"") or "").strip()

            if not (hotel and fecha and emp):
                continue

            icono = "🔄" if ("↔" in cambio or "🔄" in cambio or "cambio" in cambio.lower()) else ""
            rows.append({
                "Hotel": hotel,
                "Fecha": fecha,
                "Empleado": emp,
                "TurnoLargo": turno or row.get("Turno","") or "",
                "Icono": icono,
                "Sustituto": sust,
                "SustitucionPor": ""  # si tu CSV trae esta columna, el mapeo flexible de arriba la detectará al llamarla "SustitucionPor"
            })
    return rows

def main():
    # 1) Leer datos
    rows = read_csv_rows(CSV_PATH)
    if not rows:
        print("ADVERTENCIA: CSV leído pero sin filas válidas (revisa columnas).")

    # 2) Cargar plantilla
    if not os.path.exists(TPL_PATH):
        raise SystemExit(f"ERROR: No se encontró la plantilla: {TPL_PATH}")
    tpl = open(TPL_PATH, "r", encoding="utf-8").read()
    if "__DATA_PLACEHOLDER__" not in tpl:
        raise SystemExit("ERROR: la plantilla 'turnos_final.html' no contiene el marcador __DATA_PLACEHOLDER__")

    # 3) Inyectar JSON
    data = {"rows": rows}
    html = tpl.replace("__DATA_PLACEHOLDER__", json.dumps(data, ensure_ascii=False))

    # 4) Escribir salida
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ Generado index.html ({len(rows)} registros)")

if __name__ == "__main__":
    main()

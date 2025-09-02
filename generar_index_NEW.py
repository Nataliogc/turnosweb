# coding: utf-8
"""
generar_index_NEW.py (compacting JSON + robust checks)
- Lee 'sustituciones_diagnostico.csv'
- Inyecta en 'turnos_final.html' usando __DATA_PLACEHOLDER__
- Compacta JSON con separators=(",", ":") para evitar espacios
- Verifica con regex que existen fechas embebidas
- Deja volcado de datos en data_dump.json si algo falla
"""
import os, csv, json, re
from datetime import datetime, timedelta

AQUI = os.path.dirname(__file__)
CSV_PATH = os.path.join(AQUI, "sustituciones_diagnostico.csv")
TPL_PATH = os.path.join(AQUI, "turnos_final.html")
OUT_PATH = os.path.join(AQUI, "index.html")
DUMP_JSON = os.path.join(AQUI, "data_dump.json")

def _parse_date(s):
    s = (str(s) or "").strip()
    if not s:
        return ""
    # 1) Cortar hora si viene "YYYY-MM-DD HH:MM:SS"
    if " " in s and len(s) >= 10 and s[4] == "-" and s[7] == "-":
        s = s[:10]
    # 2) Formatos comunes (ES primero)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except Exception:
            pass
    # 3) ISO flexible
    try:
        return datetime.fromisoformat(s.replace("Z","").strip()).strftime("%Y-%m-%d")
    except Exception:
        pass
    # 4) Serial Excel
    try:
        base = datetime(1899, 12, 30)
        days = float(s.replace(",", "."))
        dt = base + timedelta(days=days)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return ""

def read_csv_rows(path):
    if not os.path.exists(path):
        raise SystemExit(f"ERROR: No existe el CSV: {path}")
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096); f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample) if sample else csv.excel
        except Exception:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        headers = [h.strip() for h in (reader.fieldnames or [])]
        lower = [h.lower() for h in headers]

        def find(*names, idx=None):
            for n in names:
                nl = n.lower()
                if nl in lower:
                    return headers[lower.index(nl)]
            if idx is not None and 0 <= idx < len(headers):
                return headers[idx]
            return None

        col_hotel  = find("Hotel","Hoteles","A", idx=0)
        col_fecha  = find("Fecha","Dia","Date","B", idx=1)
        col_emp    = find("Empleado","Trabajador","Nombre","C", idx=2)
        col_turnoL = find("TurnoLargo","Turno","Horario","D", idx=3)
        col_cambio = find("Cambio","Cambios","CambioTurno","E", idx=4)
        col_sust   = find("Sustituto","Sustituye","Sustitucion","F", idx=5)
        col_sustpor= find("SustitucionPor","Sustituido","Titular","G", idx=6)
        col_icono  = find("Icono","Icon","Swap","H", idx=7)

        for i,row in enumerate(reader, start=2):
            hotel = (row.get(col_hotel,"") or "").strip()
            fecha = _parse_date(row.get(col_fecha,"") or "")
            emp   = (row.get(col_emp,"") or "").strip()
            turno = (row.get(col_turnoL,"") or "").strip()
            cambio= (row.get(col_cambio,"") or "").strip()
            sust  = (row.get(col_sust,"") or "").strip()
            sustp = (row.get(col_sustpor,"") or "").strip()
            icon  = (row.get(col_icono,"") or "").strip()
            if not (hotel and fecha and emp):
                continue
            icono = "🔄" if ("↔" in cambio or "🔄" in cambio or "cambio" in cambio.lower() or icon in ("↔","🔄")) else ""
            rows.append({
                "Hotel": hotel,
                "Fecha": fecha,
                "Empleado": emp,
                "TurnoLargo": turno or (row.get("Turno","") or ""),
                "Icono": icono,
                "Sustituto": sust,
                "SustitucionPor": sustp
            })
    return rows

def main():
    rows = read_csv_rows(CSV_PATH)
    if not rows:
        raise SystemExit("ERROR: CSV leído pero sin filas válidas tras normalizar columnas/fechas.")

    if not os.path.exists(TPL_PATH):
        raise SystemExit(f"ERROR: No se encontró la plantilla: {TPL_PATH}")
    tpl = open(TPL_PATH, "r", encoding="utf-8").read()
    if "__DATA_PLACEHOLDER__" not in tpl:
        raise SystemExit("ERROR: la plantilla 'turnos_final.html' no contiene el marcador __DATA_PLACEHOLDER__")

    data = {"rows": rows}
    # JSON compacto: sin espacios después de coma o dos puntos
    json_compacto = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    html = tpl.replace("__DATA_PLACEHOLDER__", json_compacto)

    # Verificación post-inyección (regex tolerante)
    if "const DATA =" not in html:
        raise SystemExit("ERROR: tras inyectar no aparece 'const DATA ='. Revisa la plantilla.")
    if not re.search(r'"Fecha"\s*:\s*"\d{4}-\d{2}-\d{2}"', html):
        # Depuración: dump de datos reales
        open(DUMP_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2))
        raise SystemExit(f"ERROR: tras inyectar no se detectaron fechas en index.html.\nDump: {DUMP_JSON}")

    open(OUT_PATH, "w", encoding="utf-8").write(html)
    print(f"✅ Generado index.html ({len(rows)} registros)")

if __name__ == "__main__":
    main()

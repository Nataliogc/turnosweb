# 2_GenerarCuadranteHTML.py
# Genera index.html embebiendo datos desde CSV (hojas semanales + sustituciones y cambios de turno)
# y añade metadatos para el front.
import csv, json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

HERE = Path(__file__).resolve().parent

HOTEL_CSV_FILES = [
    "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Cumbria Spa&Hotel.csv",
    "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sercotel Guadiana.csv",
]
EMPLEADOS_CSV = HERE / "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Empleados.csv"  # opcional
SUSTITUCIONES_RAW_CSV = HERE / "Plantilla Cuadrante con Sustituciones v.6.0.xlsx - Sustituciones.csv"

TEMPLATE_PATH = HERE / "turnos_final.html"
OUTPUT_PATH   = HERE / "index.html"
PLACEHOLDER   = "__DATA_PLACEHOLDER__"

DIAS_SEMANA = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

def parse_date(s: str) -> str:
    if not s: return ""
    s = str(s).strip()
    if s.endswith(".0"): s = s[:-2]
    for fmt in ("%Y-%m-%d","%d/%m/%Y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: pass
    return s

def leer_empleados_a_excluir() -> set:
    excl = set()
    if not SUSTITUCIONES_RAW_CSV.exists(): return excl
    with open(SUSTITUCIONES_RAW_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if "baja definitiva" in (r.get("Tipo Ausencia","") or r.get("TipoAusencia","") or "").lower():
                emp = (r.get("Empleado") or "").strip()
                if emp: excl.add(emp)
    return excl

def leer_empleados(excluir: set) -> dict:
    if not EMPLEADOS_CSV.exists(): return {}
    data = {}
    with open(EMPLEADOS_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            emp = (r.get("Empleado") or "").strip()
            if emp and emp not in excluir:
                data[emp] = {k:(v or "").strip() for k,v in r.items()}
    return data

def leer_hojas_semanales() -> dict:
    datos = defaultdict(lambda: defaultdict(lambda: {"orden_empleados": [], "turnos": {}}))
    for filename in HOTEL_CSV_FILES:
        path = HERE / filename
        if not path.exists(): continue
        hotel = filename.split(" - ")[1].replace(".csv","").replace("&amp;","&")
        with open(path, encoding="utf-8") as f:
            semana_actual, orden_tmp = None, []
            for row in csv.DictReader(f):
                semana = row.get("Semana")
                emp = (row.get("Empleado") or "").strip()
                if not semana or not emp: continue
                if semana != semana_actual:
                    semana_actual, orden_tmp = semana, []
                if emp not in orden_tmp:
                    orden_tmp.append(emp)
                try:
                    lunes = datetime.strptime(semana, "%d/%m/%Y").strftime("%Y-%m-%d")
                except:
                    continue
                datos[hotel][lunes]["orden_empleados"] = list(orden_tmp)
                base = datetime.strptime(lunes, "%Y-%m-%d")
                for i, dia in enumerate(DIAS_SEMANA):
                    fecha = (base + timedelta(days=i)).strftime("%Y-%m-%d")
                    turno = (row.get(dia) or "").strip()
                    if turno:
                        datos[hotel][lunes]["turnos"][(emp, fecha)] = turno
    return datos

def leer_y_procesar_sustituciones():
    """
    Lee el CSV de 'Sustituciones' y devuelve:
      - subs[(hotel, fecha, empleado)] = {Sustituto, TipoAusencia}
      - swaps[(hotel, fecha)] = set( (empA, empB) )
    """
    if not SUSTITUCIONES_RAW_CSV.exists():
        return {}, defaultdict(set)

    def _get(row, *keys):
        for k in keys:
            if k in row and row[k] is not None:
                return str(row[k]).strip()
        return ""

    subs = {}
    swaps = defaultdict(set)

    with open(SUSTITUCIONES_RAW_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            fecha = parse_date(_get(r, "Fecha"))
            hotel = _get(r, "Hotel")
            emp   = _get(r, "Empleado")
            if not (fecha and hotel and emp): 
                continue

            cambio = _get(r, "Cambio de Turno", "Cambio de turno", "CambioTurno")
            sustit = _get(r, "Sustituto")
            tipo   = _get(r, "Tipo Ausencia", "TipoAusencia")

            if cambio:
                pair = tuple(sorted([emp, cambio]))
                swaps[(hotel, fecha)].add(pair)
            elif sustit or tipo:
                subs[(hotel, fecha, emp)] = {
                    "Sustituto": sustit,
                    "TipoAusencia": tipo  # ⟵ nombre exacto que espera el front
                }

    return subs, swaps

def calcular_noches_mensuales(schedule_rows):
    total = defaultdict(lambda: defaultdict(int))
    by_emp = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for group in schedule_rows:
        hotel = group["hotel"]
        for t in group["turnos"]:
            fecha = t["fecha"]
            month = fecha[:7]
            v = t["turno"]
            if isinstance(v, dict):
                orig = v.get("TurnoOriginal") or ""
                sust = (v.get("Sustituto") or "").strip()
                if isinstance(orig, str) and orig.lower().startswith("n") and sust:
                    total[month][hotel] += 1
                    by_emp[month][hotel][sust] += 1
            else:
                if isinstance(v, str) and v.lower().startswith("n"):
                    total[month][hotel] += 1
                    by_emp[month][hotel][t["empleado"]] += 1
    return total, by_emp

def _mark_swap(label: str) -> str:
    if not label: return label
    return label if "🔄" in label else f"{label} 🔄"

def main():
    excluir = leer_empleados_a_excluir()
    empleados_master = leer_empleados(excluir)
    datos = leer_hojas_semanales()
    sustituciones, cambios_turno = leer_y_procesar_sustituciones()

    schedule_rows = []
    for hotel, semanas in datos.items():
        for lunes, data in semanas.items():
            turnos = data["turnos"]

            # =======================
            # 1) AUSENCIAS + SUSTITUTO (PRIMERO)
            # =======================
            sustitutos_de_la_semana = set()
            # Snapshot para iterar con seguridad mientras modificamos turnos
            for (emp, fecha), valor in list(turnos.items()):
                if emp in excluir:
                    del turnos[(emp, fecha)]
                    continue

                key_s = (hotel, fecha, emp)
                if key_s in sustituciones:
                    s = sustituciones[key_s]
                    # Ausencia al titular
                    turnos[(emp, fecha)] = {
                        "TurnoOriginal": valor,                     # turno que tenía el titular
                        "Sustituto": s.get("Sustituto",""),
                        "TipoAusencia": s.get("TipoAusencia",""),  # ⟵ nombre exacto
                    }
                    # Dar turno efectivo al sustituto si aún no lo tenía
                    sust = s.get("Sustituto","")
                    if sust:
                        sustitutos_de_la_semana.add(sust)
                        if (sust, fecha) not in turnos or not isinstance(turnos[(sust, fecha)], str) or not turnos[(sust, fecha)]:
                            turnos[(sust, fecha)] = valor  # el sustituto trabaja el TurnoOriginal del titular

            # =======================
            # 2) SWAPS (cambios de turno) — ya con sustitutos activos
            # =======================
            base = datetime.strptime(lunes, "%Y-%m-%d")
            fechas_semana = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
            for fecha in fechas_semana:
                pairs = cambios_turno.get((hotel, fecha), set())
                for (a, b) in pairs:
                    key_a = (a, fecha)
                    key_b = (b, fecha)
                    if key_a in turnos and key_b in turnos:
                        turno_a = turnos[key_a]
                        turno_b = turnos[key_b]
                        # Solo intercambiamos strings (si hay dicts de ausencia, el sustituto ya tiene string arriba)
                        if isinstance(turno_a, str) and isinstance(turno_b, str):
                            turnos[key_a] = _mark_swap(turno_b)
                            turnos[key_b] = _mark_swap(turno_a)

            # 3) orden final
            orden = [e for e in data["orden_empleados"] if e not in excluir]
            for s in sorted(sustitutos_de_la_semana):
                if s and s not in orden:
                    orden.append(s)

            schedule_rows.append({
                "hotel": hotel,
                "semana_lunes": lunes,
                "orden_empleados": orden,
                "turnos": [{"empleado": k[0], "fecha": k[1], "turno": v} for k,v in turnos.items()],
            })

    monthly_total, monthly_by_emp = calcular_noches_mensuales(schedule_rows)

    payload = {
        "schedule": schedule_rows,
        "employees": empleados_master,
        "monthly_nights": monthly_total,
        "monthly_nights_by_employee": monthly_by_emp,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }

    js = "window.FULL_DATA = " + json.dumps(payload, ensure_ascii=False) + ";"
    html = TEMPLATE_PATH.read_text(encoding="utf-8")
    if PLACEHOLDER not in html:
        raise SystemExit("No se encontró __DATA_PLACEHOLDER__ en turnos_final.html")
    OUTPUT_PATH.write_text(html.replace(PLACEHOLDER, js), encoding="utf-8")
    print(f"[OK] {OUTPUT_PATH.name} generado con éxito.")

if __name__ == "__main__":
    main()

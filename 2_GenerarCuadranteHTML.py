# -*- coding: utf-8 -*-
"""
2_GenerarCuadranteHTML.py — v8.0 (no intrusivo)
- Lee TODOS los .csv de la carpeta; SOLO el que TERMINA en 'Sustituciones.csv' se usa como tal.
- El resto se consideran CSV de hotel (independiente del nombre).
- Aplica Sustituciones (↔) primero, luego Cambios de turno (🔄), también si uno actúa como sustituto.
- NO modifica ningún HTML. Genera un 'data.js' con window.FULL_DATA = {...};
  para que lo carguen index.html y live.mobile.html sin perder tus controles/estilos.
"""

import csv, json, os, re, sys
from datetime import datetime, timedelta
from collections import defaultdict, OrderedDict

DEBUG = False
def log(*a):
    if DEBUG:
        try: print(*a)
        except Exception: print(" ".join(str(x) for x in a))

DIAS_SEMANA = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

# ------------------ helpers de fecha ------------------
def to_iso(s):
    if not s: return None
    s = str(s).strip()
    if s.endswith(".0"): s = s[:-2]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s): return s
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m:
        d,mn,y = m.groups(); y=int(y); y += 2000 if y<100 else 0
        return f"{y:04d}-{int(mn):02d}-{int(d):02d}"
    m = re.search(r"(\d{1,2})/([A-Za-zñÑáéíóúÁÉÍÓÚ]{3})/(\d{2,4})", s)
    if m:
        d,mon,y = m.groups(); y=int(y); y += 2000 if y<100 else 0
        mon_map = {'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,'jul':7,'ago':8,'sep':9,'oct':10,'nov':11,'dic':12}
        mon = mon.lower()[:3]
        if mon in mon_map: return f"{y:04d}-{mon_map[mon]:02d}-{int(d):02d}"
    for fmt in ("%d-%m-%Y",):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except Exception: pass
    try:
        return datetime.fromisoformat(s).strftime("%Y-%m-%d")
    except Exception:
        return None

def monday_of(iso_date):
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    return (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")

# ------------------ lectura CSV ------------------
def read_csv_rows(path):
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            row = {}
            for k, v in r.items():
                kk = (k or "").strip()
                row[kk] = (v.strip() if isinstance(v, str) else v)
            rows.append(row)
    return rows

def guess(row, options):
    if not row: return None
    keys = {k.lower(): k for k in row.keys() if k}
    for opt in options:
        if isinstance(opt,(list,tuple)):
            for o in opt:
                if str(o).lower() in keys: return keys[str(o).lower()]
        else:
            if str(opt).lower() in keys: return keys[str(opt).lower()]
    return None

def load_hotel_csv(path, default_hotel=None):
    """Lee un CSV 'base hotel' (con columnas Semana, Empleado y Lunes..Domingo)."""
    out = []
    rows = read_csv_rows(path)
    if not rows: return out
    sample = rows[0]
    c_hotel = guess(sample, ["Hotel"])
    c_sem   = guess(sample, ["Semana"])
    c_emp   = guess(sample, ["Empleado","Persona","Nombre"])

    if default_hotel is None:
        default_hotel = os.path.basename(path).replace(".csv","").replace("&amp;","&")
        if "guadiana" in default_hotel.lower(): default_hotel = "Sercotel Guadiana"
        if "cumbria"  in default_hotel.lower(): default_hotel = "Cumbria Spa&Hotel"

    for r in rows:
        emp = (r.get(c_emp) or "").strip()
        sem = r.get(c_sem)
        if not (sem and emp): continue
        lunes = None
        try:
            lunes = datetime.strptime(sem, "%d/%m/%Y").strftime("%Y-%m-%d")
        except Exception:
            lunes = to_iso(sem)
        if not lunes: continue
        base = datetime.strptime(lunes, "%Y-%m-%d")
        hotel = (r.get(c_hotel) or default_hotel or "").replace("&amp;","&").strip()
        for i, dia in enumerate(DIAS_SEMANA):
            f = (base + timedelta(days=i)).strftime("%Y-%m-%d")
            turno = (r.get(dia) or "").strip()
            if turno != "":
                out.append((hotel, f, emp, turno, lunes))
    log("BASE:", os.path.basename(path), "filas:", len(out))
    return out

def load_sustituciones_csv(path):
    out = []
    rows = read_csv_rows(path)
    if not rows: return out
    for r in rows:
        hotel = (r.get(guess(r,["Hotel"])) or "").strip()
        fecha = to_iso(r.get(guess(r,["Fecha"])))
        emp   = (r.get(guess(r,["Empleado"])) or "").strip()
        tipo  = (r.get(guess(r,["TipoAusencia","Tipo Ausencia","Ausencia","Tipo"])) or "").strip()
        sust  = (r.get(guess(r,["Sustituto"])) or "").strip()
        torig = (r.get(guess(r,["TurnoOriginal","Turno Original"])) or "").strip()
        cambio= (r.get(guess(r,["Cambio de Turno","CambioTurno"])) or "").strip()
        if not (hotel and fecha and emp): continue
        out.append({
            "hotel": hotel, "fecha": fecha, "empleado": emp,
            "tipo_ausencia": tipo, "sustituto": sust,
            "turno_original": torig, "cambio_con": cambio
        })
    log("SUSTITUCIONES filas:", len(out))
    return out

# ------------------ core ------------------
def build_schedule(base_rows, sust_rows):
    weeks = defaultdict(lambda: {"orden": OrderedDict(), "turnos": {}})
    swaps_by_date = defaultdict(set)  # (hotel, fecha) -> {(a,b)}

    # 1) base
    for hotel, fecha, emp, turno, lunes in base_rows:
        g = weeks[(hotel, lunes)]
        if emp not in g["orden"]: g["orden"][emp] = True
        g["turnos"][(emp, fecha)] = (turno or "").strip()

    # 2) registrar sustituciones y swaps
    for r in sust_rows:
        hotel = r["hotel"]; fecha = r["fecha"]; emp = r["empleado"]
        lunes = monday_of(fecha)
        g = weeks[(hotel, lunes)]
        if emp and emp not in g["orden"]: g["orden"][emp] = True

        # Sustitución / ausencia
        if r["tipo_ausencia"] or r["sustituto"] or r["turno_original"]:
            current = g["turnos"].get((emp, fecha), "")
            turno_orig = r["turno_original"] or (current if isinstance(current, str) else "")
            g["turnos"][(emp, fecha)] = {
                "TipoAusencia": r["tipo_ausencia"] or "Ausencia",
                "Sustituto": r["sustituto"] or "",
                "TurnoOriginal": turno_orig
            }
            sust = (r["sustituto"] or "").strip()
            if sust:
                if sust not in g["orden"]: g["orden"][sust] = True
                if (sust, fecha) not in g["turnos"] or not isinstance(g["turnos"][(sust, fecha)], str):
                    g["turnos"][(sust, fecha)] = turno_orig
                log("SUST->", fecha, hotel, "Titular:", emp, "Sust:", sust, "TurnoOriginal:", turno_orig)

        # Cambio de turno
        if r["cambio_con"]:
            a, b = emp, r["cambio_con"]
            pair = tuple(sorted([a, b]))
            swaps_by_date[(hotel, fecha)].add(pair)
            for n in (a, b):
                if n and n not in g["orden"]: g["orden"][n] = True
            log("SWAP REQ->", fecha, hotel, a, "<>", b)

    def mark_swap(val):
        if not val: return val
        s = str(val)
        return s if "🔄" in s else f"{s} 🔄"

    # 3) aplicar swaps
    for (hotel, lunes), data in weeks.items():
        base = datetime.strptime(lunes, "%Y-%m-%d")
        fechas = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        T = data["turnos"]
        for fecha in fechas:
            pairs = swaps_by_date.get((hotel, fecha), set())
            if not pairs: continue
            for (a, b) in pairs:
                kA, kB = (a, fecha), (b, fecha)
                if (kA in T and kB in T and isinstance(T[kA], str) and isinstance(T[kB], str)):
                    tA, tB = T[kA], T[kB]
                    T[kA] = mark_swap(tB)
                    T[kB] = mark_swap(tA)
                    log("SWAP->", fecha, hotel, a, "<>", b, "=>", kA, "<->", kB)
                else:
                    log("SWAP SKIP->", fecha, hotel, a, b, "(faltan turnos string)")

    # 4) construir estructura final
    schedule = []
    for (hotel, lunes), data in sorted(weeks.items(), key=lambda x: (x[0][0], x[0][1])):
        orden = list(data["orden"].keys())
        base = datetime.strptime(lunes, "%Y-%m-%d")
        fechas = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        turnos_list = []
        for emp in orden:
            for f in fechas:
                v = data["turnos"].get((emp, f), "")
                turnos_list.append({"empleado": emp, "fecha": f, "turno": v})
        schedule.append({
            "semana_lunes": lunes,
            "hotel": hotel,
            "orden_empleados": orden,
            "turnos": turnos_list
        })
    return {
        "schedule": schedule,
        "generated_at": datetime.now().isoformat(timespec="seconds")
    }

# ------------------ salida data.js ------------------
def write_data_js(data_obj, path="data.js"):
    payload = "window.FULL_DATA = " + json.dumps(data_obj, ensure_ascii=False) + ";"
    with open(path, "w", encoding="utf-8") as f:
        f.write(payload)
    print("[OK] Generado:", path)
    return path

# ------------------ main ------------------
def main():
    cwd = os.getcwd()
    all_csvs = [os.path.join(cwd, n) for n in os.listdir(cwd) if n.lower().endswith(".csv")]

    # SOLO consideramos Sustituciones si el nombre TERMINA en 'sustituciones.csv'
    csv_sust = None
    hotel_csvs = []
    for p in all_csvs:
        low = os.path.basename(p).lower()
        if re.search(r"\s*sustituciones\.csv$", low):
            csv_sust = p
        else:
            hotel_csvs.append(p)

    print("[INFO] CSV SUST:", csv_sust or "no encontrado")
    print("[INFO] CSV HOTEL(es):")
    for p in hotel_csvs:
        print("   -", os.path.basename(p))

    if not hotel_csvs:
        print("[ERROR] No se encontraron CSV de hoteles.")
        sys.exit(1)

    base_rows = []
    for p in hotel_csvs:
        base_rows += load_hotel_csv(p)

    sust_rows = load_sustituciones_csv(csv_sust) if csv_sust else []

    data = build_schedule(base_rows, sust_rows)
    write_data_js(data, "data.js")

if __name__ == "__main__":
    try:
        if sys.platform.startswith("win"):
            os.environ["PYTHONUTF8"] = os.environ.get("PYTHONUTF8", "1")
    except Exception:
        pass
    main()

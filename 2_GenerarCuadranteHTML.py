# -*- coding: utf-8 -*-
"""
2_GenerarCuadranteHTML.py — v7.5 (robusto + trazas)
- Genera index.html embebiendo window.FULL_DATA.
- Soporta sustituciones (↔) y cambios de turno (🔄).
- NUEVO: 🔄 también funciona si uno participa como SUSTITUTO ese día.
- Trazas en consola para diagnosticar.

Archivos esperados en la carpeta:
- ... - Sercotel Guadiana.csv
- ... - Cumbria Spa&Hotel.csv
- ... - Sustituciones.csv
- turnos_final.html (con __DATA_PLACEHOLDER__)
"""

import csv, json, os, re, sys
from datetime import datetime, timedelta
from collections import defaultdict, OrderedDict

DEBUG = True  # pon a False si no quieres trazas

def log(*a):
    if DEBUG: print(*a)

# ---------- fechas ----------
def to_iso(s):
    if not s: return None
    s = str(s).strip()
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
    try:
        return datetime.fromisoformat(s).strftime("%Y-%m-%d")
    except Exception:
        pass
    try:
        return datetime.strptime(s, "%d-%m-%Y").strftime("%Y-%m-%d")
    except Exception:
        pass
    return None

def monday_of(iso_date):
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    return (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")

# ---------- CSV helpers ----------
def read_csv_rows(path):
    rows = []
    if not path or not os.path.exists(path): return rows
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({(k or "").strip(): (v.strip() if isinstance(v,str) else v) for k,v in r.items()})
    return rows

def guess(row, options):
    if not row: return None
    keys = {k.lower(): k for k in row.keys() if k}
    for opt in options:
        if isinstance(opt, (list, tuple)):
            for o in opt:
                if o.lower() in keys: return keys[o.lower()]
        else:
            if str(opt).lower() in keys: return keys[str(opt).lower()]
    return None

def load_hotel_csv(path, default_hotel):
    out = []
    rows = read_csv_rows(path)
    if not rows: return out
    sample = rows[0]
    c_hotel = guess(sample, ["Hotel"])
    c_fecha = guess(sample, ["Fecha","Día","Dia","Day"])
    c_emp   = guess(sample, ["Empleado","Persona","Nombre"])
    c_turno = guess(sample, ["Turno","TurnoLargo","Turno Largo","Horario"])
    for r in rows:
        hotel = (r.get(c_hotel) or default_hotel).strip()
        fecha = to_iso(r.get(c_fecha))
        emp   = (r.get(c_emp) or "").strip()
        turno = (r.get(c_turno) or "").strip()
        if fecha and emp:
            out.append((hotel, fecha, emp, turno))
    log(f"BASE {default_hotel}: {len(out)} filas leídas")
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
    log(f"SUSTITUCIONES: {len(out)} filas leídas")
    return out

# ---------- construcción ----------
def build_schedule(base_rows, sust_rows):
    weeks = defaultdict(lambda: {"orden": OrderedDict(), "turnos": {}})
    swaps_by_date = defaultdict(set)  # (hotel, fecha) -> {(a,b)}

    # 1) base
    for hotel, fecha, emp, turno in base_rows:
        week = monday_of(fecha)
        g = weeks[(hotel, week)]
        if emp not in g["orden"]: g["orden"][emp] = True
        g["turnos"][(emp, fecha)] = (turno or "").strip()

    # 2) sustituciones + registro de swaps
    for r in sust_rows:
        hotel, fecha, emp = r["hotel"], r["fecha"], r["empleado"]
        week = monday_of(fecha)
        g = weeks[(hotel, week)]
        if emp and emp not in g["orden"]: g["orden"][emp] = True

        if r["tipo_ausencia"] or (r["sustituto"] and r["turno_original"]):
            g["turnos"][(emp, fecha)] = {
                "TipoAusencia": r["tipo_ausencia"] or "Ausencia",
                "Sustituto": r["sustituto"] or "",
                "TurnoOriginal": r["turno_original"] or ""
            }
            if r["sustituto"] and r["sustituto"] not in g["orden"]:
                g["orden"][r["sustituto"]] = True
            log("SUST->", fecha, hotel, "Titular:", emp, "Sust:", r["sustituto"], "TurnoOriginal:", r["turno_original"])

        if r["cambio_con"]:
            a,b = r["empleado"], r["cambio_con"]
            pair = tuple(sorted([a,b]))
            swaps_by_date[(hotel, fecha)].add(pair)
            for n in (a,b):
                if n and n not in g["orden"]:
                    g["orden"][n] = True
            log("SWAP REQ->", fecha, hotel, a, "<>", b)

    # helpers para swaps
    def is_absence_obj(v):
        return isinstance(v, dict) and any(k in v for k in ("TipoAusencia","Tipo","Tipo Ausencia","Sustituto","TurnoOriginal"))

    def get_substitute_of(name, fecha, turnos):
        v = turnos.get((name, fecha))
        if is_absence_obj(v):
            sust = v.get("Sustituto"); torig = v.get("TurnoOriginal")
            if sust: return sust, torig
        for (tit,f), val in turnos.items():
            if f != fecha: continue
            if is_absence_obj(val) and val.get("Sustituto") == name:
                return name, val.get("TurnoOriginal")
        return None, None

    def effective_worker(name, fecha, turnos):
        key = (name, fecha)
        v = turnos.get(key)
        if v and not is_absence_obj(v):    # ya tiene turno string
            return key, v
        sust, torig = get_substitute_of(name, fecha, turnos)
        if sust:                            # name es titular con sustituto
            return (sust, fecha), (torig or "")
        if sust is None and torig is not None:  # name es el sustituto de otro
            return (name, fecha), (torig or "")
        return None, None

    def mark_swap(val):
        if not val: return val
        s = str(val)
        return s if "🔄" in s else f"{s} 🔄"

    # 3) aplicar swaps por semana/fecha
    for (hotel, week), data in weeks.items():
        base = datetime.strptime(week, "%Y-%m-%d")
        fechas = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        T = data["turnos"]

        for fecha in fechas:
            pairs = swaps_by_date.get((hotel, fecha), set())
            if not pairs: continue
            for (a,b) in pairs:
                kA, tA = effective_worker(a, fecha, T)
                kB, tB = effective_worker(b, fecha, T)
                if not kA or not kB:
                    log("SWAP SKIP ->", fecha, hotel, a, b, "(faltan turnos efectivos)")
                    continue
                T[kA] = mark_swap(tB)
                T[kB] = mark_swap(tA)
                log("SWAP->", fecha, hotel, a, "<>", b, "=>", kA, "<->", kB)

    # 4) construir estructura final
    schedule = []
    for (hotel, week), data in sorted(weeks.items(), key=lambda x: (x[0][0], x[0][1])):
        orden = list(data["orden"].keys())
        base = datetime.strptime(week, "%Y-%m-%d")
        fechas = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        turnos_list = []
        for emp in orden:
            for f in fechas:
                v = data["turnos"].get((emp, f), "")
                turnos_list.append({"empleado": emp, "fecha": f, "turno": v})
        schedule.append({
            "semana_lunes": week,
            "hotel": hotel,
            "orden_empleados": orden,
            "turnos": turnos_list
        })
    return {"schedule": schedule}

# ---------- embebido ----------
def embed_into_html(data_obj, template="turnos_final.html", out="index.html"):
    if not os.path.exists(template):
        raise FileNotFoundError("No se encontró la plantilla HTML 'turnos_final.html'")
    with open(template, "r", encoding="utf-8") as f:
        html = f.read()
    payload = "window.FULL_DATA = " + json.dumps(data_obj, ensure_ascii=False)
    html = html.replace("__DATA_PLACEHOLDER__", payload)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    return out

# ---------- main ----------
def main():
    cwd = os.getcwd()
    csv_guadiana = csv_cumbria = csv_sust = None
    for name in os.listdir(cwd):
        low = name.lower()
        if not low.endswith(".csv"): continue
        if "sustituciones" in low:
            csv_sust = os.path.join(cwd, name)
        elif "sercotel guadiana" in low:
            csv_guadiana = os.path.join(cwd, name)
        elif "cumbria spa&hotel" in low or "cumbria spa&hotel" in name:
            csv_cumbria = os.path.join(cwd, name)

    if not (csv_guadiana or csv_cumbria):
        print("❗ No se encontraron CSV de hoteles."); sys.exit(1)
    if not csv_sust:
        print("⚠️  No se encontró CSV de Sustituciones (seguiré sin swaps/↔).")

    base_rows = []
    if csv_guadiana: base_rows += load_hotel_csv(csv_guadiana, "Sercotel Guadiana")
    if csv_cumbria:  base_rows += load_hotel_csv(csv_cumbria, "Cumbria Spa&Hotel")
    sust_rows = load_sustituciones_csv(csv_sust) if csv_sust else []

    data = build_schedule(base_rows, sust_rows)
    out = embed_into_html(data)
    print(f"✅ Generado: {out}")

if __name__ == "__main__":
    main()

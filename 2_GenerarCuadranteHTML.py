# -*- coding: utf-8 -*-
"""
2_GenerarCuadranteHTML.py
v7.3 — Calendario CG (Guadiana & Cumbria)
- Genera index.html embebiendo window.FULL_DATA con estructura por semanas (lunes→domingo).
- Mantiene los puntos clave del proyecto (logos, orden empleados, ausencias, ↔, 🔄, noches, export ICS).
- PARCHE: el cambio de turno (🔄) ahora funciona también cuando uno de los dos
  participa como SUSTITUTO ese mismo día.

Requisitos:
- En la carpeta deben existir los CSV exportados por 1_ExtraerDatosExcel.py:
    • ... - Sercotel Guadiana.csv
    • ... - Cumbria Spa&Hotel.csv
    • ... - Sustituciones.csv
- Debe existir la plantilla HTML: turnos_final.html (contiene __DATA_PLACEHOLDER__).

Salida:
- index.html (con window.FULL_DATA embebido)
"""

import csv
import json
import os
import sys
import re
from datetime import datetime, timedelta
from collections import defaultdict, OrderedDict

# ------------------------------
# Utilidades de fecha
# ------------------------------

def to_iso(date_str):
    """
    Normaliza la fecha a YYYY-MM-DD.
    Acepta: 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD/MM/YY', 'DD-mon-YY' (Excel local) y variantes.
    """
    if not date_str:
        return None
    s = str(date_str).strip()
    # ISO directo
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    # Tipos comunes DD/MM/YYYY o DD/MM/YY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m:
        d, mth, y = m.groups()
        y = int(y)
        if y < 100:
            y += 2000
        return f"{y:04d}-{int(mth):02d}-{int(d):02d}"

    # Casos tipo "lu 08/sep/25" o "8/sep/25"
    m = re.search(r"(\d{1,2})/([A-Za-zñÑáéíóúÁÉÍÓÚ]{3})/(\d{2,4})", s)
    if m:
        d, mon, y = m.groups()
        y = int(y)
        if y < 100:
            y += 2000
        mon_map = {
            'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,
            'jul':7,'ago':8,'sep':9,'oct':10,'nov':11,'dic':12
        }
        mon = mon.lower()[:3]
        if mon in mon_map:
            return f"{y:04d}-{mon_map[mon]:02d}-{int(d):02d}"

    # Último intento: let datetime parse
    try:
        # Excel a veces guarda como número de serie → ya vendría transformado en CSV
        dt = datetime.fromisoformat(s)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    try:
        dt = datetime.strptime(s, "%d-%m-%Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    return None


def monday_of(iso_date):
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    # lunes = 0 ... domingo = 6
    return (d - timedelta(days=(d.weekday()))).strftime("%Y-%m-%d")


# ------------------------------
# Lectura flexible de CSV base
# ------------------------------

def read_csv_rows(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items()})
    return rows


def guess_cols(row, candidates):
    """Devuelve el primer nombre de columna existente (case-insensitive) de la lista candidates."""
    if not row:
        return None
    keys = {k.lower(): k for k in row.keys()}
    for cands in candidates:
        for c in (cands if isinstance(cands, (list, tuple)) else [cands]):
            if c.lower() in keys:
                return keys[c.lower()]
    return None


def load_hotel_csv(path, default_hotel_name=None):
    """
    Lee el CSV base de un hotel y genera una lista de (hotel, fecha_iso, empleado, turno_string).
    El CSV puede tener columnas variadas; intentamos detectarlas.
    """
    out = []
    rows = read_csv_rows(path)
    if not rows:
        return out

    # Detectar columnas
    sample = rows[0]
    col_hotel = guess_cols(sample, ["Hotel"])
    col_fecha = guess_cols(sample, ["Fecha", "Día", "Dia"])
    col_emp   = guess_cols(sample, ["Empleado", "Persona", "Nombre"])
    col_turno = guess_cols(sample, ["Turno", "TurnoLargo", "Turno Largo", "Horario"])

    for r in rows:
        hotel = (r.get(col_hotel) if col_hotel else default_hotel_name) or default_hotel_name or ""
        fecha_iso = to_iso(r.get(col_fecha, ""))
        emp = (r.get(col_emp) or "").strip()
        turno = (r.get(col_turno) or "").strip()
        if not fecha_iso or not emp:
            continue
        out.append((hotel, fecha_iso, emp, turno))
    return out


def load_sustituciones_csv(path):
    """
    Devuelve lista de dicts estandarizados con:
      hotel, fecha, empleado, tipo_ausencia, sustituto, turno_original, cambio_con
    """
    out = []
    for r in read_csv_rows(path):
        hotel = (r.get(guess_cols(r, ["Hotel"])) or "").strip()
        fecha = to_iso(r.get(guess_cols(r, ["Fecha"])) or "")
        emp   = (r.get(guess_cols(r, ["Empleado"])) or "").strip()
        tipo  = (r.get(guess_cols(r, ["TipoAusencia", "Tipo Ausencia", "Ausencia", "Tipo"])) or "").strip()
        sust  = (r.get(guess_cols(r, ["Sustituto"])) or "").strip()
        turno_orig = (r.get(guess_cols(r, ["TurnoOriginal", "Turno Original"])) or "").strip()
        cambio = (r.get(guess_cols(r, ["Cambio de Turno", "CambioTurno"])) or "").strip()

        if not fecha or not hotel or not emp:
            continue

        out.append({
            "hotel": hotel,
            "fecha": fecha,
            "empleado": emp,
            "tipo_ausencia": tipo,
            "sustituto": sust,
            "turno_original": turno_orig,
            "cambio_con": cambio,
        })
    return out


# ------------------------------
# Construcción de semanas (grupos)
# ------------------------------

def build_schedule(hotel_base_rows, sustituciones_rows):
    """
    hotel_base_rows: lista de tuplas (hotel, fecha_iso, empleado, turno_string)
    sustituciones_rows: lista de dicts estandarizados
    Devuelve estructura:
    {
      "schedule": [
        {
          "semana_lunes": "YYYY-MM-DD",
          "hotel": "Sercotel Guadiana",
          "orden_empleados": [...],
          "turnos": [
            {"empleado":"...","fecha":"YYYY-MM-DD","turno":"Mañana" | "Tarde" | "Noche" | "Descanso" | {...obj ausencia...}}
          ]
        },
        ...
      ]
    }
    """

    # Index base por (hotel, semana_lunes)
    weeks = defaultdict(lambda: {
        "orden": OrderedDict(),   # mantiene orden de aparición de empleados
        "turnos": {}              # clave: (empleado, fecha) -> str turno  | dict ausencia
    })

    # 1) Cargar base
    for hotel, fecha, emp, turno in hotel_base_rows:
        if not hotel or not fecha or not emp:
            continue
        week = monday_of(fecha)
        key = (hotel, week)
        if emp not in weeks[key]["orden"]:
            weeks[key]["orden"][emp] = True
        weeks[key]["turnos"][(emp, fecha)] = (turno or "").strip()

    # 2) Registrar ausencias + sustituciones (objeto)
    #    Para cada fila: si hay tipo_ausencia + sustituto + turno_original, se marca la ausencia al titular
    #    y el sustituto recibirá turno_original en la fase de pintado (front) o lo podemos ya aplicar aquí.
    cambios_turno = defaultdict(set)  # (hotel, fecha) -> set( (a,b) ordenados )
    for r in sustituciones_rows:
        hotel = r["hotel"]
        fecha = r["fecha"]
        emp   = r["empleado"]

        week = monday_of(fecha)
        keyw = (hotel, week)

        # Aseguramos existencia del grupo aunque no haya base (para evitar perder sustituciones sueltas)
        _ = weeks[keyw]["orden"]
        # El titular debe estar en orden también para mantener consistencia
        if emp and emp not in weeks[keyw]["orden"]:
            weeks[keyw]["orden"][emp] = True

        # Ausencia + sustituto
        if r["tipo_ausencia"] or (r["sustituto"] and r["turno_original"]):
            weeks[keyw]["turnos"][(emp, fecha)] = {
                "TipoAusencia": r["tipo_ausencia"] or "Ausencia",
                "Sustituto": r["sustituto"] or "",
                "TurnoOriginal": r["turno_original"] or ""
            }
            # incluimos al sustituto en orden para que pueda verse
            if r["sustituto"]:
                if r["sustituto"] not in weeks[keyw]["orden"]:
                    weeks[keyw]["orden"][r["sustituto"]] = True

        # Cambio de turno puro (🔄)
        if r["cambio_con"]:
            a, b = emp, r["cambio_con"]
            pair = tuple(sorted([a, b]))
            cambios_turno[(hotel, fecha)].add(pair)
            # Garantizamos que ambos existan en orden
            for name in (a, b):
                if name and name not in weeks[keyw]["orden"]:
                    weeks[keyw]["orden"][name] = True

    # 3) Aplicar CAMBIOS DE TURNO con soporte a sustitutos (PARCHE)
    def _is_absence_obj(v):
        return isinstance(v, dict) and any(k in v for k in ("TipoAusencia", "Tipo", "Tipo Ausencia", "Sustituto", "TurnoOriginal"))

    def _get_substitute_of(name, fecha, turnos):
        """
        Si 'name' es titular ausente y tiene Sustituto ese día, devuelve (sustituto, turno_original).
        Si 'name' está como SUSTITUTO de otro titular, devuelve (name, turno_original de ese titular).
        Si no aplica, devuelve (None, None).
        """
        v = turnos.get((name, fecha))
        if _is_absence_obj(v):
            sust = v.get("Sustituto")
            to = v.get("TurnoOriginal")
            if sust:
                return sust, to

        for (tit, f), val in turnos.items():
            if f != fecha:
                continue
            if _is_absence_obj(val) and val.get("Sustituto") == name:
                to = val.get("TurnoOriginal")
                return name, to
        return None, None

    def _resolve_effective_worker(name, fecha, turnos):
        """
        Devuelve (worker_key, turno_str) para el 'trabajador efectivo' ese día:
          - Si name ya tiene un turno string => úsalo.
          - Si name es titular AUSENTE con sustituto => worker es ese sustituto con TurnoOriginal.
          - Si name actúa como SUSTITUTO de otro => worker es 'name' con TurnoOriginal del titular.
        """
        key = (name, fecha)
        v = turnos.get(key)
        if v and not _is_absence_obj(v):
            return key, v  # turno string ya existente

        sust, t_orig = _get_substitute_of(name, fecha, turnos)
        if sust:
            return (sust, fecha), (t_orig or "")

        if sust is None and t_orig is not None:
            return (name, fecha), (t_orig or "")

        return None, None

    def _mark_swap_label(val):
        if not val:
            return val
        s = str(val)
        return s if "🔄" in s else f"{s} 🔄"

    # recorremos semana por semana para aplicar swaps de cada fecha
    for (hotel, week), data in weeks.items():
        # fechas de esa semana
        base = datetime.strptime(week, "%Y-%m-%d")
        fechas_semana = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        turnos = data["turnos"]

        for fecha in fechas_semana:
            pairs = cambios_turno.get((hotel, fecha), set())
            if not pairs:
                continue
            for (a, b) in pairs:
                keyA, turnoA = _resolve_effective_worker(a, fecha, turnos)
                keyB, turnoB = _resolve_effective_worker(b, fecha, turnos)
                if not keyA or not keyB:
                    continue
                # Intercambiamos
                turnos[keyA] = _mark_swap_label(turnoB)
                turnos[keyB] = _mark_swap_label(turnoA)

    # 4) Construir estructura final "schedule"
    schedule = []
    # orden por hotel + semana
    for (hotel, week), data in sorted(weeks.items(), key=lambda x: (x[0][0], x[0][1])):
        orden_empleados = list(data["orden"].keys())
        # desplazamos al final a los ausentes TODA la semana lo hará el front si lo desea
        turnos_list = []
        turnos = data["turnos"]
        base = datetime.strptime(week, "%Y-%m-%d")
        fechas_semana = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

        for emp in orden_empleados:
            for fecha in fechas_semana:
                v = turnos.get((emp, fecha), "")
                # si es ausencia ya está como dict; si es string normal que pase tal cual
                turnos_list.append({
                    "empleado": emp,
                    "fecha": fecha,
                    "turno": v
                })

        schedule.append({
            "semana_lunes": week,
            "hotel": hotel,
            "orden_empleados": orden_empleados,
            "turnos": turnos_list
        })

    return {"schedule": schedule}


# ------------------------------
# Embebido en HTML
# ------------------------------

def embed_into_html(data_obj, template_path="turnos_final.html", out_path="index.html"):
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"No se encontró la plantilla HTML: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    payload = "window.FULL_DATA = " + json.dumps(data_obj, ensure_ascii=False)
    html = html.replace("__DATA_PLACEHOLDER__", payload)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return out_path


# ------------------------------
# Main
# ------------------------------

def main():
    # Intentamos localizar los CSV esperados en la carpeta actual
    cwd = os.getcwd()

    csv_guadiana = None
    csv_cumbria = None
    csv_sust = None

    for name in os.listdir(cwd):
        low = name.lower()
        if low.endswith(".csv"):
            if "sustituciones" in low:
                csv_sust = os.path.join(cwd, name)
            elif "sercotel guadiana" in low:
                csv_guadiana = os.path.join(cwd, name)
            elif "cumbria spa&hotel" in low or "cumbria spa&hotel" in name:
                csv_cumbria = os.path.join(cwd, name)

    if not csv_sust:
        print("⚠️  No se encontró el CSV de Sustituciones. Continuaré sin él.")
    if not csv_guadiana and not csv_cumbria:
        print("❗ No se encontraron CSV de hoteles. Nada que procesar.")
        sys.exit(1)

    base_rows = []
    if csv_guadiana:
        base_rows += load_hotel_csv(csv_guadiana, default_hotel_name="Sercotel Guadiana")
    if csv_cumbria:
        base_rows += load_hotel_csv(csv_cumbria, default_hotel_name="Cumbria Spa&Hotel")

    sust_rows = load_sustituciones_csv(csv_sust) if csv_sust else []

    data = build_schedule(base_rows, sust_rows)
    out = embed_into_html(data, template_path="turnos_final.html", out_path="index.html")
    print(f"✅ Generado: {out}")


if __name__ == "__main__":
    main()

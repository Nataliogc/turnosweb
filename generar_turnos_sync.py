# -*- coding: utf-8 -*-
"""
Genera index.html sincronizando:
- Hojas por hotel (todas excepto 'Sustituciones' y validación)
- Hoja 'Sustituciones' (cambios, ausencias y sustitutos)

Incluye parser flexible para hojas de hotel en formato "cuadrante":
- Primera columna = Empleado/Nombre
- Cabecera con fechas (Lun..Dom u otras)
- Celdas con códigos: M, T, N, D, VAC, BAJA, PERMISO, FORMACION, etc.

Ordena por Hotel, Fecha y coloca el Sustituto justo debajo del titular.
Escribe index.html con plantilla externa index_template.html si existe, o plantilla embebida si no.
"""

import os, sys, json, tempfile, shutil
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

# ========= CONFIG =========
EXCEL_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
SHEET_SUST = "Sustituciones"
IGNORE_SHEETS = {SHEET_SUST, "Datos de Validación", "VALIDACION", "Datos", "Data"}

HERE = Path(__file__).resolve().parent
TPL_PATH = HERE / "index_template.html"
OUT_HTML = HERE / "index.html"

# ========= UTILS =========
MAP_TL = {"M":"Mañana","T":"Tarde","N":"Noches","D":"Descanso"}
ABS_WORDS = ["VAC", "VACACIONES", "BAJA", "PERMISO", "FORM", "CURSO", "IT", "FEST", "LIB", "DESC"]


def _canon(s):
    if s is None or (isinstance(s, float) and pd.isna(s)): return ""
    return str(s).strip()


def _parse_fecha(v):
    if v is None: return ""
    try:
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
    except Exception:
        dt = pd.NaT
    return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")


def write_atomic(target_path: Path, data: str, encoding="utf-8"):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, encoding=encoding, newline="\n") as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    shutil.move(str(tmp_path), str(target_path))

EMBED_TEMPLATE = """<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Cuadrantes</title>
<style>:root{--bg:#f6fafb;--ink:#1c2834;--muted:#3c556e;--card:#fff;--br:#e7edf3;--brand:#0a6aa1}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
.wrap{max-width:1180px;margin:20px auto 90px;padding:0 14px}
.card,.bar,header.app{background:#fff;border:1px solid var(--br);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.05)}
header.app{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;margin-bottom:12px;background:var(--brand);color:#fff}
.table-wrap{overflow:auto}table{width:100%;border-collapse:separate;border-spacing:0}th,td{border-bottom:1px solid #eef3f8;padding:8px 8px;text-align:center}
th{text-align:left;background:#f3f7fb;color:var(--muted);position:sticky;top:0}
.namecol{width:260px;text-align:left}.pill-shift{min-width:90px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e6eef6;border-radius:999px;font-weight:600;font-size:.9rem;padding:0 10px;white-space:nowrap}
.ps-m{background:#e9f7ef;border-color:#cbe8d1}.ps-t{background:#fff8df;border-color:#efe6b2}.ps-n{background:#eef2ff;border-color:#cbd7ff}.ps-d{background:#ffeaea;border-color:#ffd0d0}.ps-empty{background:#fff}.abs{background:rgba(128,128,128,.12);border-color:#aaa;color:#444}
.legend{font-size:.85rem;color:#5b6a7c;padding:8px 12px}</style></head><body>
<div class="wrap"><header class="app"><h1 style="margin:0">Cuadrantes de turnos</h1><div>Actualizado: <b id="lastUpdate">—</b></div></header>
<div id="root" class="table-wrap"></div><div class="legend">Leyenda: <span class="pill-shift ps-m">Mañana</span> · <span class="pill-shift ps-t">Tarde</span> · <span class="pill-shift ps-n">Noches</span> · <span class="pill-shift ps-d">Descanso</span> · <span class="pill-shift abs">Ausencias</span></div></div>
<script>
const DATA = __DATA_JSON__;
const $=s=>document.querySelector(s), fmt=d=>new Date(d).toLocaleDateString('es-ES');
function render(){
 const root=$('#root'); if(!DATA||!Array.isArray(DATA.rows)){root.innerHTML='<p>No hay datos.</p>';return;}
 const bh={}; for(const r of DATA.rows){ (bh[r.Hotel]=bh[r.Hotel]||[]).push(r); }
 const blocks=[];
 for(const [hotel,rows] of Object.entries(bh)){
  const emps=[...new Set(rows.map(r=>r.Empleado))], dias=[...new Set(rows.map(r=>r.Fecha))].sort();
  let h = `<div class=\"card\"><div style=\"padding:10px 12px;border-bottom:1px solid #e7edf3\"><b>${hotel}</b></div><div class=\"table-wrap\"><table><thead><tr>`;
  h+=`<th class=\"namecol\">Empleado</th>`;
  for(const d of dias){ const dn=new Date(d).toLocaleDateString('es-ES',{weekday:'long'}); h+=`<th><div><span>${fmt(d)}</span><div style=\"font-size:.8rem;color:#7b8da3\">${dn[0].toUpperCase()+dn.slice(1)}</div></div></th>`; }
  h+=`</tr></thead><tbody>`;
  for(const emp of emps){
   h+=`<tr><td class=\"namecol\"><b>${emp}</b></td>`;
   for(const d of dias){
     const r=rows.find(x=>x.Empleado===emp && x.Fecha===d) || {};
     const v=r.TextoDia || r.TurnoLargo || r.Turno || "";
     const cls = v==="Mañana"?"ps-m": v==="Tarde"?"ps-t": v==="Noches"?"ps-n": v==="Descanso"?"ps-d": (v? "abs":"ps-empty");
     h+=`<td><span class=\"pill-shift ${cls}\">${v||"&nbsp;"}</span></td>`;
   }
   h+=`</tr>`;
  }
  h+=`</tbody></table></div></div>`;
  blocks.push(h);
 }
 root.innerHTML = blocks.join('');
}
render(); document.getElementById('lastUpdate').textContent=new Date().toLocaleString('es-ES');
</script></body></html>"""

# -------- Parsers --------

def parse_hotel_sheet(sh_name: str, df: pd.DataFrame):
    """Devuelve lista de dicts estándar a partir de una hoja de hotel.
    1) Intento columnas clásicas (Fecha/Empleado/Turno/TurnoLargo)
    2) Fallback formato cuadrante: primera col = empleados, cabeceras = fechas
    """
    rows = []
    cols = {str(c).strip().lower(): c for c in df.columns}

    # 1) Columnas clásicas
    def pick(*names):
        for n in names:
            if n.lower() in cols: return cols[n.lower()]
        return None
    c_fecha = pick("Fecha","Día","Dia")
    c_emp   = pick("Empleado","Nombre","Trabajador")
    c_turno = pick("Turno","Shift")
    c_tlong = pick("TurnoLargo","Turno Largo","TLargo")

    if c_fecha and c_emp:
        for _, r in df.iterrows():
            fecha = _parse_fecha(r.get(c_fecha))
            emp   = _canon(r.get(c_emp))
            turno = _canon(r.get(c_turno)) if c_turno else ""
            tlong = _canon(r.get(c_tlong)) if c_tlong else ""
            if not (sh_name and fecha and emp):
                continue
            label = (tlong or MAP_TL.get(turno, turno)).strip()
            rows.append({
                "Hotel": sh_name,
                "Fecha": fecha,
                "Empleado": emp,
                "Turno": turno,
                "TurnoLargo": MAP_TL.get(turno, tlong),
                "TextoDia": label,
            })
        return rows

    # 2) Fallback cuadrante: primera columna nombres, resto columnas con cabeceras = fechas
    df_local = df.copy()
    df_local.columns = [str(c).strip() for c in df_local.columns]
    col0 = df_local.columns[0]

    # Detectar si cabeceras (a partir de la 2ª col) son fechas
    header_dates = []
    for c in df_local.columns[1:]:
        f = _parse_fecha(c)
        header_dates.append(f)
    has_dates = any(bool(x) for x in header_dates)

    if has_dates:
        for _, r in df_local.iterrows():
            emp = _canon(r.get(col0))
            if not emp:
                continue
            for j, c in enumerate(df_local.columns[1:]):
                fecha = header_dates[j]
                if not fecha:
                    continue
                val = _canon(r.get(c))
                if not val:
                    continue
                up = val.upper()
                # Mapear abreviaturas o ausencias
                if up in MAP_TL:
                    tlong = MAP_TL[up]
                    label = tlong
                elif any(up.startswith(x) for x in ABS_WORDS):
                    tlong = ""
                    label = val  # Ej. VAC, BAJA, PERMISO
                else:
                    # texto libre: úsalo como etiqueta
                    tlong = MAP_TL.get(up, "")
                    label = val
                rows.append({
                    "Hotel": sh_name,
                    "Fecha": fecha,
                    "Empleado": emp,
                    "Turno": up if up in MAP_TL else "",
                    "TurnoLargo": tlong,
                    "TextoDia": label,
                })
        return rows

    # No reconocible
    return []


# -------- Main --------

def main():
    print("📄 Excel:", EXCEL_PATH)
    if not os.path.exists(EXCEL_PATH):
        print("❌ No se encuentra el Excel"); return

    xls = pd.ExcelFile(EXCEL_PATH)
    sheets = [s for s in xls.sheet_names if s not in IGNORE_SHEETS]
    if SHEET_SUST not in xls.sheet_names:
        print("❌ No existe la hoja 'Sustituciones'"); return

    # 1) Construir base desde hojas de hotel (incluyendo formato cuadrante)
    base_rows = []
    for sh in sheets:
        try:
            dfh = pd.read_excel(EXCEL_PATH, sheet_name=sh)
        except Exception:
            continue
        parsed = parse_hotel_sheet(sh, dfh)
        if not parsed:
            print(f"⚠️  Hoja '{sh}': formato no reconocido, se omite en base.")
        base_rows.extend(parsed)
    base = pd.DataFrame(base_rows) if base_rows else pd.DataFrame(columns=["Hotel","Fecha","Empleado","Turno","TurnoLargo","TextoDia"])
    print("🧮 Base (hotel sheets) filas:", len(base))

    # 2) Aplicar Sustituciones
    sus = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_SUST)
    for col in ["Hotel","Fecha","Empleado","Cambio de Turno","Sustituto","TipoAusencia","Turno","TurnoLargo"]:
        if col not in sus.columns: sus[col] = ""

    out_rows = base_rows.copy()  # empezamos de la base

    for _, r in sus.iterrows():
        hotel = _canon(r.get("Hotel"))
        fecha = _parse_fecha(r.get("Fecha"))
        titular = _canon(r.get("Empleado"))
        cambio  = _canon(r.get("Cambio de Turno"))
        sustit  = _canon(r.get("Sustituto"))
        tipo    = _canon(r.get("TipoAusencia"))
        turno   = _canon(r.get("Turno"))
        tlong   = _canon(r.get("TurnoLargo")) or MAP_TL.get(turno, "")

        if not (hotel and fecha and titular):
            continue

        # Etiqueta priorizando ausencias
        label = tipo or (f"Cambio: {cambio}" if cambio else (tlong or turno))

        # 2.a) Modificar/crear fila del TITULAR
        found = False
        for row in out_rows:
            if row["Hotel"]==hotel and row["Fecha"]==fecha and row["Empleado"]==titular:
                row["Turno"] = row.get("Turno", "")
                row["TurnoLargo"] = tlong or row.get("TurnoLargo", "")
                row["TextoDia"] = label or row.get("TextoDia", "")
                found = True
                break
        if not found:
            out_rows.append({
                "Hotel": hotel,
                "Fecha": fecha,
                "Empleado": titular,
                "Turno": turno,
                "TurnoLargo": tlong,
                "TextoDia": label or tlong or turno,
            })

        # 2.b) Añadir fila del SUSTITUTO bajo el titular
        if sustit:
            # intentar recuperar turno del titular en base
            titular_turno = ""
            for row in base_rows:
                if row["Hotel"]==hotel and row["Fecha"]==fecha and row["Empleado"]==titular:
                    titular_turno = row.get("TurnoLargo") or MAP_TL.get(row.get("Turno", ""), "")
                    break
            out_rows.append({
                "Hotel": hotel,
                "Fecha": fecha,
                "Empleado": sustit + " (Sustituto)",
                "Turno": "",
                "TurnoLargo": titular_turno,
                "TextoDia": f"Sustituye a {titular}",
            })

    # 3) Ordenar: Hotel, Fecha, y colocar sustituto justo debajo
    def sort_key(x):
        return (x.get("Hotel",""), x.get("Fecha",""), x.get("Empleado","ZZZ"))
    out_rows.sort(key=sort_key)

    # Re-orden fino para colocar sustituto justo debajo
    ordered = []
    i = 0
    while i < len(out_rows):
        row = out_rows[i]
        ordered.append(row)
        if not row["Empleado"].endswith("(Sustituto)"):
            # busca sustituto correspondiente
            j = i + 1
            while j < len(out_rows):
                r2 = out_rows[j]
                if r2["Hotel"]==row["Hotel"] and r2["Fecha"]==row["Fecha"] and r2["Empleado"].endswith("(Sustituto)") and row["Empleado"] in r2["TextoDia"]:
                    ordered.append(r2)
                    break
                j += 1
        i += 1

    final = pd.DataFrame(ordered, columns=["Hotel","Fecha","Empleado","Turno","TurnoLargo","TextoDia"])
    print("📊 Filas tras Sustituciones:", len(final))

    # 4) Construir JSON y escribir HTML
    payload = json.dumps({"rows": final.to_dict(orient="records")}, ensure_ascii=False)
    if TPL_PATH.exists():
        tpl = TPL_PATH.read_text(encoding="utf-8")
        html = tpl.replace("__DATA_JSON__", payload)
    else:
        html = EMBED_TEMPLATE.replace("__DATA_JSON__", payload)

    stamp = f"<!-- build: {datetime.now().isoformat(timespec='seconds')} -->\n"
    write_atomic(OUT_HTML, stamp + html)
    stat = OUT_HTML.stat()
    print("✅ HTML escrito:", OUT_HTML)
    print("   Tamaño:", stat.st_size, "bytes | Modificado:", datetime.fromtimestamp(stat.st_mtime))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("❌ Error:", e)
        raise

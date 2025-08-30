# -*- coding: utf-8 -*-
"""
Genera 'index.html' a partir del Excel (hoja 'Sustituciones').
- Si existe 'index_template.html' en la misma carpeta, la usa.
- Si NO existe, usa una plantilla embebida de emergencia.
- Siempre sobreescribe 'index.html' (escritura atómica) y muestra rutas/logs.
"""

import os, json, sys, tempfile, shutil
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

EXCEL_PATH = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
SHEET_NAME = "Sustituciones"

HERE = Path(__file__).resolve().parent
TPL_PATH = HERE / "index_template.html"
OUT_HTML = HERE / "index.html"

EMBED_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cuadrantes de turnos</title>
<style>
  :root{ --bg:#f6fafb; --ink:#1c2834; --muted:#3c556e; --card:#fff; --br:#e7edf3; --sh:0 4px 16px rgba(0,0,0,.05); --brand:#0a6aa1; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
  .wrap{max-width:1180px;margin:20px auto 90px;padding:0 14px}
  .card, .bar, .panel, header.app{background:var(--card);border:1px solid var(--br);border-radius:14px;box-shadow:var(--sh)}
  header.app{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;margin-bottom:12px;background:var(--brand);color:#fff}
  header.app h1{margin:0;font-size:1.35rem}
  .bar{padding:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
  .btn{border:1px solid #cfe0ec;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
  .btn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
  input[type="text"],select,input[type="date"]{padding:10px 12px;border:1px solid #d6e3ef;border-radius:10px;min-width:180px}
  table{width:100%;border-collapse:separate;border-spacing:0}
  th,td{border-bottom:1px solid #eef3f8;padding:8px 8px;text-align:center;vertical-align:middle}
  th{text-align:left;background:#f3f7fb;color:var(--muted);position:sticky;top:0;z-index:1}
  .card{border-radius:14px;overflow:hidden;margin-bottom:16px}
  .card header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9fbff;border-bottom:1px solid var(--br)}
  .namecol{width:260px;text-align:left}
  .name-with-dot{display:flex;flex-direction:column;gap:2px}
  .name-with-dot .row{display:flex;align-items:center;gap:6px}
  .dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle;background:#cad6e4}
  .pill-shift{min-width:90px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e6eef6;border-radius:999px;font-weight:600;font-size:.9rem;padding:0 10px;white-space:nowrap;gap:6px}
  .ps-m{background:#e9f7ef;border-color:#cbe8d1}.ps-t{background:#fff8df;border-color:#efe6b2}.ps-n{background:#eef2ff;border-color:#cbd7ff}.ps-d{background:#ffeaea;border-color:#ffd0d0}.ps-empty{background:#fff}
  .is-abs{font-weight:700}.abs{background:rgba(128,128,128,0.12);border-color:#aaa;color:#444}
  .legend{font-size:.85rem;color:#5b6a7c;padding:8px 12px}
  .th-day{display:flex;flex-direction:column;align-items:center}.th-day small{color:#7b8da3;font-weight:500;margin-top:2px}
  .error{background:#ffecec;color:#a40000;border:1px solid #f5b5b5;padding:10px 12px;border-radius:10px;margin:12px 0}
  .noprint{@media print {display:none}}
</style>
</head>
<body>
<div class="wrap">
  <header class="app">
    <div style="display:flex;align-items:center;gap:12px;"><h1 style="margin:0;">Cuadrantes de turnos</h1></div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Actualizado: <b id="lastUpdate">—</b></span><button class="btn primary noprint" id="btnRefresh">Refrescar</button></div>
  </header>
  <div id="errors" class="error" style="display:none"></div>
  <div class="bar noprint">
    <div class="row">
      <div><label>Buscar</label><br/><input id="q" type="text" placeholder="Empleado u hotel" /></div>
      <div><label>Hotel</label><br/><select id="hotel"><option value="__ALL__">— Todos —</option></select></div>
      <div><label>Desde</label><br/><input id="desde" type="date" /></div>
      <div><label>Hasta</label><br/><input id="hasta" type="date" /></div>
      <div><label>Empleado</label><br/><select id="empleado"><option value="">— Selecciona —</option></select></div>
      <div><label>&nbsp;</label><br/><button id="btnIcs" class="btn">Descargar .ics</button></div>
      <div><label>&nbsp;</label><br/><button id="btnClear" class="btn">Limpiar</button></div>
    </div>
  </div>
  <div id="root"></div>
  <div class="legend">Leyenda: <span class="pill-shift ps-m">Mañana</span> · <span class="pill-shift ps-t">Tarde</span> · <span class="pill-shift ps-n">Noches</span> · <span class="pill-shift ps-d">Descanso</span> · <span class="pill-shift abs">Ausencias (Vacaciones/Baja/…)</span></div>
</div>
<script>
const DATA = __DATA_JSON__;
const $ = s => document.querySelector(s);
const fmt = d => new Date(d).toLocaleDateString('es-ES');
function render(){
  const root = $('#root');
  if(!DATA || !Array.isArray(DATA.rows)){ root.innerHTML = '<div class="error">No hay datos para mostrar.</div>'; return; }
  const byHotel = {};
  for(const r of DATA.rows){ if(!byHotel[r.Hotel]) byHotel[r.Hotel]=[]; byHotel[r.Hotel].push(r); }
  const blocks=[];
  for(const [hotel, rows] of Object.entries(byHotel)){
    const empleados = [...new Set(rows.map(r=>r.Empleado))];
    const dias = [...new Set(rows.map(r=>r.Fecha))].sort();
    let html = `<div class="card"><header><div><b>${hotel}</b></div></header><div class="table-wrap"><table><thead><tr>`;
    html += `<th class="namecol">Empleado</th>`;
    for(const d of dias){
      const dn = new Date(d).toLocaleDateString('es-ES',{weekday:'long'});
      html += `<th><div class=th-day><span>${fmt(d)}</span><small>${dn[0].toUpperCase()+dn.slice(1)}</small></div></th>`;
    }
    html += `</tr></thead><tbody>`;
    for(const emp of empleados){
      html += `<tr><td class=namecol><div class=name-with-dot><div class=row><span class=dot></span><b>${emp}</b></div></div></td>`;
      for(const d of dias){
        const r = rows.find(x=>x.Empleado===emp && x.Fecha===d) || {};
        const TL = r.TurnoLargo or r.get("TurnoLargo","") if isinstance(r,dict) else "";
        const tll = r.get("TurnoLargo","") if isinstance(r,dict) else ""
        const tl = tll if tll else (r.get("Turno","") if isinstance(r,dict) else "")
        const label = r.get("TextoDia","") if isinstance(r,dict) else ""
        const value = label or tl or ""
        const cls = "ps-m" if value=="Mañana" else "ps-t" if value=="Tarde" else "ps-n" if value=="Noches" else "ps-d" if value=="Descanso" else ("abs" if value else "ps-empty")
        html += `<td><span class="pill-shift ${cls}">${value or '&nbsp;'}</span></td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div></div>`;
    blocks.push(html);
  }
  root.innerHTML = blocks.join('');
}
render();
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('lastUpdate'); if (el) el.textContent = new Date().toLocaleString('es-ES');
  const r = document.getElementById('btnRefresh'); if (r) r.addEventListener('click',()=>location.href='index.html?ts='+Date.now());
});
</script>
</body>
</html>
"""

def _canon(s):
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return str(s).strip()

def _parse_fecha(v):
    if v is None: return ""
    try:
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
    except Exception:
        dt = pd.NaT
    return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")

def write_atomic(target_path: Path, data: str, encoding: str = "utf-8"):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    import tempfile, shutil
    with tempfile.NamedTemporaryFile("w", delete=False, encoding=encoding, newline="\n") as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    shutil.move(str(tmp_path), str(target_path))

def main():
    print("📂 Script dir:", HERE)
    print("📄 Excel:", EXCEL_PATH)
    print("🧩 Template:", TPL_PATH, "(existe:" , TPL_PATH.exists(), ")")
    print("🎯 Salida:", OUT_HTML)
    if not os.path.exists(EXCEL_PATH):
        print("❌ No se encuentra el Excel:", EXCEL_PATH)
        return
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    except Exception as e:
        print("❌ No se pudo abrir el Excel:", e)
        return

    # Columnas posibles: Hotel, Fecha, Empleado, Turno, TurnoLargo, Cambio de Turno
    rows = []
    for _, r in df.iterrows():
        hotel = _canon(r.get("Hotel"))
        fecha = _parse_fecha(r.get("Fecha"))
        emp   = _canon(r.get("Empleado"))
        turno = _canon(r.get("Turno"))
        turnoL= _canon(r.get("TurnoLargo")) or turno
        texto = _canon(r.get("Cambio de Turno")) or turnoL
        if not (hotel and fecha and emp):
            continue
        rows.append({
            "Hotel": hotel,
            "Empleado": emp,
            "Fecha": fecha,
            "Turno": turno,
            "TurnoLargo": turnoL,
            "TextoDia": texto,
        })

    print("🧮 Filas para pintar:", len(rows))
    payload = json.dumps({"rows": rows}, ensure_ascii=False)

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
    main()

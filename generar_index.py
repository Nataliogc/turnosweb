# -*- coding: utf-8 -*-
r"""
Genera index.html (UI moderna tipo tarjetas) desde el Excel de OneDrive.
- Respeta orden de hojas (hoteles) y orden de empleados tal cual en el Excel.
- Aplica Ausencias y Sustituciones (incl. Cambio de turno 🔄) desde "Sustituciones".
- Copia el Excel a %TEMP% para evitar bloqueos de OneDrive/Excel.
Salida: C:\Users\comun\Documents\Turnos web\index.html

Uso:
  py generar_index.py
"""

import pandas as pd
import json, re, unicodedata, shutil, tempfile, sys, warnings
from pathlib import Path

# Silenciar aviso de openpyxl por Data Validation
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl.worksheet._reader")

# === RUTAS FIJAS (no cambiar nombres) ===
EXCEL_SRC = Path(r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx")
OUT_PATH  = Path(r"C:\Users\comun\Documents\Turnos web\index.html")

IGNORE_SHEETS = ["Sustituciones", "Hoja1", "Datos de Validación", "Datos de validación"]

# ------------------ utilidades ------------------
def _strip(s): return "" if s is None else str(s).strip()
def _canon(s):
    s=_strip(s)
    s2=''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn').lower()
    return re.sub(r'\s+',' ',s2)

def classify_cell(val):
    s=_strip(val); c=_canon(s)
    if not s or c in ("nan","none"): return {"code":"","long":"","is_abs":False,"abs_key":""}
    if "vaca" in c:   return {"code":s,"long":"Vacaciones","is_abs":True,"abs_key":"vacaciones"}
    if "baja" in c or " it" in c or c=="it": return {"code":s,"long":"Baja","is_abs":True,"abs_key":"baja"}
    if "permiso" in c or "retribu" in c:     return {"code":s,"long":"Permiso","is_abs":True,"abs_key":"permiso"}
    if "forma" in c or "curso" in c:         return {"code":s,"long":"Formación","is_abs":True,"abs_key":"formacion"}
    if "fest" in c:                          return {"code":s,"long":"Festivo","is_abs":True,"abs_key":"festivo"}
    if "libr" in c or "libre" in c:          return {"code":s,"long":"Libranza","is_abs":True,"abs_key":"libranza"}
    if "desc" in c:                          return {"code":"D","long":"Descanso","is_abs":False,"abs_key":""}
    if "man" in c or "mañana" in s.lower():  return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
    if "tard" in c:                          return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
    if "noch" in c:                          return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    m=re.search(r'(\d{1,2})\s*[:.]?\s*(\d{0,2})?\s*-\s*(\d{1,2})', c)
    if m:
        h1=int(m.group(1))
        if 5<=h1<=12:  return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
        if 12<h1<=20:  return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
        return         {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    return {"code":"", "long":s, "is_abs":False, "abs_key":""}

def safe_copy_to_temp(src: Path) -> Path:
    tmpdir = Path(tempfile.gettempdir()) / "turnosweb_cache"
    tmpdir.mkdir(parents=True, exist_ok=True)
    dst = tmpdir / "plantilla_copy.xlsx"
    try: shutil.copy2(src, dst)
    except PermissionError:
        with open(src, "rb") as fsrc, open(dst, "wb") as fdst: fdst.write(fsrc.read())
    return dst

# Parseo robusto de fecha para hoja Sustituciones (admite "mi 19/nov 25", "19/11/2025", etc.)
MONTHS = {"ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06","jul":"07","ago":"08","sep":"09","oct":"10","nov":"11","dic":"12"}
def parse_fecha_sus(s):
    t=_strip(s).lower().replace(".", "/")
    t=re.sub(r"^[a-záéíóúüñ]{1,3}\s+", "", t)     # quita prefijo "mi ", "ju ", etc.
    t=t.replace(" ", "")
    for k,v in MONTHS.items():
        t=re.sub(rf"/{k}/", f"/{v}/", t)        # "19/nov/25" -> "19/11/25"
    try:
        d=pd.to_datetime(t, dayfirst=True, errors="raise")
        return d.strftime("%Y-%m-%d")
    except Exception:
        d=pd.to_datetime(s, errors="coerce", dayfirst=True)
        return "" if pd.isna(d) else d.strftime("%Y-%m-%d")

# ------------------ lectura de Excel ------------------
def read_hotels_keep_order(xls):
    """Concatena hojas de hoteles y añade HotelOrder (orden de pestaña) y EmpOrder (orden en la hoja)."""
    frames=[]
    for sheet_idx, sh in enumerate(xls.sheet_names):
        if _canon(sh) in map(_canon, IGNORE_SHEETS):
            continue
        df = pd.read_excel(xls, sheet_name=sh)
        if df.empty:
            continue
        df.columns = [str(c).strip() for c in df.columns]
        for col in ["Semana","Empleado","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]:
            if col not in df.columns: df[col] = ""
        # orden de empleado tal cual aparecen (primeras ocurrencias)
        emp_order={}
        for i, name in enumerate([_strip(x) for x in df["Empleado"].tolist() if _strip(x)!=""]):
            if name not in emp_order: emp_order[name]=i
        df["Hotel"]      = sh
        df["HotelOrder"] = sheet_idx
        df["EmpOrder"]   = df["Empleado"].map(lambda x: emp_order.get(_strip(x), 9999))
        frames.append(df)
    if not frames:
        raise RuntimeError("No hay hojas de hoteles válidas.")
    return pd.concat(frames, ignore_index=True)

def read_substitutions(xls):
    if "Sustituciones" not in xls.sheet_names:
        return pd.DataFrame(columns=["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"])
    s0 = pd.read_excel(xls, sheet_name="Sustituciones")
    if s0.empty:
        return pd.DataFrame(columns=["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"])
    s0.columns = s0.columns.str.strip()
    # acepta variantes
    rename_map = {c:c for c in s0.columns}
    for col in s0.columns:
        c=_canon(col)
        if "cambio" in c and "turn" in c: rename_map[col]="CambioDeTurno"
        if c.startswith("tipo") and "ausen" in c: rename_map[col]="TipoAusencia"
    s0 = s0.rename(columns=rename_map)
    for k in ["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"]:
        if k not in s0.columns: s0[k] = ""
    s0["Fecha"] = s0["Fecha"].map(parse_fecha_sus)
    for c in ["Hotel","Empleado","Sustituto","TipoAusencia","CambioDeTurno"]:
        s0[c] = s0[c].fillna("").astype(str).str.strip()
    s0 = s0[s0["Fecha"]!=""]
    return s0[["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"]]

# ------------------ HTML (tarjetas/tabla por semana) ------------------
def build_html(data_rows):
    TEMPLATE = r"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Cuadrantes de turnos</title>
<link rel="icon" href="data:,">
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
</style></head>
<body>
<div class="wrap">
  <header class="app"><div style="display:flex;align-items:center;gap:12px;"><h1 style="margin:0;">Cuadrantes de turnos</h1></div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Actualizado: <b id="lastUpdate">—</b></span><button class="btn primary noprint" id="btnRefresh">Refrescar</button></div></header>

  <div id="errors" class="error" style="display:none"></div>

  <div class="bar noprint"><div class="row">
    <div><label>Buscar</label><br/><input id="q" type="text" placeholder="Empleado u hotel" /></div>
    <div><label>Hotel</label><br/><select id="hotel"><option value="__ALL__">— Todos —</option></select></div>
    <div><label>Desde</label><br/><input id="desde" type="date" /></div>
    <div><label>Hasta</label><br/><input id="hasta" type="date" /></div>
    <div><label>Empleado</label><br/><select id="empleado"><option value="">— Selecciona —</option></select></div>
    <div><label>&nbsp;</label><br/><button id="btnIcs" class="btn">Descargar .ics</button></div>
    <div><label>&nbsp;</label><br/><button id="btnClear" class="btn">Limpiar</button></div>
  </div></div>

  <div id="root"></div>
  <div class="legend">Leyenda: <span class="pill-shift ps-m">Mañana</span> · <span class="pill-shift ps-t">Tarde</span> · <span class="pill-shift ps-n">Noches</span> · <span class="pill-shift ps-d">Descanso</span> · <span class="pill-shift abs">Ausencias (Vacaciones/Baja/…)</span></div>
</div>

<script>
try{
  const DATA = __DATA_PLACEHOLDER__;
  const errors = document.getElementById('errors');
  const showError = (msg) => { errors.textContent = msg; errors.style.display='block'; console.error(msg); };

  document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
  document.getElementById('btnRefresh').onclick = ()=>location.reload();

  const rowsAll = (DATA && DATA.rows) ? DATA.rows : [];
  if (!rowsAll.length) showError("No hay datos para mostrar. Comprueba las fechas en el Excel.");

  const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  const fmtEsFull = (s) => { const d = new Date(s+'T00:00:00'); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); };
  const classFromLong = (x) => { const t=(x||"").toLowerCase(); if(t.startsWith("mañ")||t.startsWith("man"))return"ps-m"; if(t.startsWith("tar"))return"ps-t"; if(t.startsWith("noch"))return"ps-n"; if(t.startsWith("desc"))return"ps-d"; return"ps-empty"; };
  const parseYMD = s => { const [y,m,d]=(s||"").split('-').map(n=>parseInt(n,10)); return new Date(y,(m||1)-1,d||1); };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dayIdx = s => { const x=parseYMD(s); return (x.getDay()+6)%7; };
  const weekStartStr = s => { const x=parseYMD(s); const w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); return ymd(x); };
  const weekEndStr = s => { const x=parseYMD(s); const w=(x.getDay()+6)%7; x.setDate(x.getDate()+(6-w)); return ymd(x); };

  const hotelSel = document.getElementById('hotel');
  const hotels = Array.from(new Set(rowsAll.map(r=>r.Hotel).filter(Boolean)));
  hotels.forEach(h=>{ const o=document.createElement('option'); o.value=h; o.textContent=h; hotelSel.appendChild(o); });

  const desdeEl=document.getElementById('desde'), hastaEl=document.getElementById('hasta');
  const fmt = x => x.toISOString().slice(0,10);
  const today=new Date(), d30=new Date(today); d30.setDate(d30.getDate()+30);
  desdeEl.value=fmt(today); hastaEl.value=fmt(d30);

  let LAST_ROWS=[];
  const state={q:"",hotel:"__ALL__",desde:desdeEl.value,hasta:hastaEl.value};
  function fillEmployees(rows){
    const todayStr=new Date().toISOString().slice(0,10);
    const minDate=state.desde?(state.desde>todayStr?state.desde:todayStr):todayStr;
    let r=rows.filter(x=>(!state.hotel||state.hotel==="__ALL__"||x.Hotel===state.hotel));
    r=r.filter(x=>x.Fecha>=minDate);
    const emps=Array.from(new Set(r.map(x=>x.Empleado).filter(Boolean)));
    const empleadoSel=document.getElementById('empleado');
    empleadoSel.innerHTML='<option value="">— Selecciona —</option>'+emps.map(e=>`<option value="${e}">${e}</option>`).join('');
  }
  const applyFilters=()=>{
    let rows=rowsAll.slice();
    if(state.q){ const q=state.q.toLowerCase(); rows=rows.filter(r=>(r.Empleado||"").toLowerCase().includes(q)||(r.Hotel||"").toLowerCase().includes(q)); }
    if(state.hotel && state.hotel!=="__ALL__"){ rows=rows.filter(r=>r.Hotel===state.hotel); }
    if(state.desde){ rows=rows.filter(r=>r.Fecha>=state.desde); }
    if(state.hasta){ rows=rows.filter(r=>r.Fecha<=state.hasta); }
    LAST_ROWS=rows.slice(); fillEmployees(rows); render(rows);
  };
  document.getElementById('q').addEventListener('input', e=>{state.q=e.target.value; applyFilters();});
  hotelSel.addEventListener('change', e=>{state.hotel=e.target.value; applyFilters();});
  desdeEl.addEventListener('change', e=>{state.desde=e.target.value; applyFilters();});
  hastaEl.addEventListener('change', e=>{state.hasta=e.target.value; applyFilters();});
  document.getElementById('btnClear').addEventListener('click', ()=>{ state.q=""; state.hotel="__ALL__"; const t=new Date(), m=new Date(t); m.setDate(m.getDate()+30); desdeEl.value=fmt(t); hastaEl.value=fmt(m); state.desde=desdeEl.value; state.hasta=hastaEl.value; document.getElementById('q').value=""; hotelSel.value="__ALL__"; document.getElementById('empleado').value=""; applyFilters(); });

  document.getElementById('btnIcs').addEventListener('click', ()=>{
    const empleadoSel=document.getElementById('empleado'); const emp=empleadoSel.value; if(!emp){ alert("Selecciona un empleado."); return; }
    const start=state.desde, end=state.hasta;
    let base=Array.isArray(LAST_ROWS)&&LAST_ROWS.length?LAST_ROWS:(DATA.rows||[]);
    let rows=base.filter(r=>r.Empleado===emp && r.Fecha>=start && r.Fecha<=end);
    if(!rows.length){ rows=(DATA.rows||[]).filter(r=>r.Empleado===emp && r.Fecha>=start && r.Fecha<=end); }
    rows=rows.map(r=>{ const text=(r.TextoDia||r.TurnoLargo||r.Turno||"").toString().trim(); return {...r, _text:text}; }).filter(r=>r._text!=="");
    if(!rows.length){ alert("No hay datos para ese periodo."); return; }
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TurnosWeb//ES"];
    rows.forEach((r,i)=>{ const title=r._text.replace(/\r?\n/g,' '); const dt=r.Fecha.replace(/-/g,""); lines.push("BEGIN:VEVENT","UID:TW-"+dt+"-"+i+"@turnosweb","DTSTAMP:"+dt+"T000000Z","DTSTART;VALUE=DATE:"+dt,"SUMMARY:"+title, r.Hotel?("LOCATION:"+r.Hotel):"", "STATUS:CONFIRMED","END:VEVENT"); });
    lines.push("END:VCALENDAR");
    const blob=new Blob([lines.join("\r\n")],{type:"text/calendar;charset=utf-8"}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`turnos_${emp.replace(/\\s+/g,'_')}_${start}_a_${end}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  });

  function render(rows){
    const root=document.getElementById('root'); root.innerHTML="";
    if(!rows||rows.length===0){ root.innerHTML='<div class="panel" style="padding:12px;">No hay resultados con los filtros aplicados.</div>'; return; }
    const groups=new Map();
    rows.forEach(r=>{
      if(!r.Fecha||!r.Hotel||!r.Empleado) return;
      const k=r.Hotel+"|"+weekStartStr(r.Fecha);
      if(!groups.has(k)){ groups.set(k,{hotel:r.Hotel, wstart:weekStartStr(r.Fecha), wend:weekEndStr(r.Fecha), rows:new Map()}); }
      const g=groups.get(k);
      if(!g.rows.has(r.Empleado)){ g.rows.set(r.Empleado,{name:r.Empleado, order:r.EmpOrder ?? 0, vac:false, cells:new Array(7).fill(null)}); }
      const mainRow=g.rows.get(r.Empleado);
      const idx=dayIdx(r.Fecha);
      const lower=(r.TextoDia||"").toLowerCase();
      if(lower.includes("vaca")) mainRow.vac=true;
      if(lower.includes("vaca") || r.TipoEmpleado==="Ausente"){ const text=r.TextoDia||"Ausencia"; mainRow.cells[idx]={kind:"abs", long:text}; }
      else{ const text=r.TextoDia||r.TurnoLargo||r.Turno||""; mainRow.cells[idx]={kind:"shift", long:text, icon:r.Icono||""}; }
    });
    const ordered=Array.from(groups.values()).sort((a,b)=>(a.wstart<b.wstart?-1: a.wstart>b.wstart?1: a.hotel.localeCompare(b.hotel)));
    let gi=0;
    function renderNextGroup(){
      if(gi>=ordered.length) return;
      const g=ordered[gi++]; let entries=Array.from(g.rows.values());
      entries.sort((a,b)=>{ if(a.vac!==b.vac) return a.vac?1:-1; if(a.order!==b.order) return (a.order||0)-(b.order||0); return a.name.localeCompare(b.name,'es'); });
      const card=document.createElement('div'); card.className='card';
      card.innerHTML=`<header><div><b>${g.hotel}</b> — Semana ${fmtEsFull(g.wstart)} a ${fmtEsFull(g.wend)}</div><div style="font-size:.9rem;color:#6a7b8e">${entries.length} empleados / 7 días</div></header>`;
      const table=document.createElement('table'); const startDate=parseYMD(g.wstart); let thDays='<thead><tr><th class="namecol">Empleado</th>';
      for(let i=0;i<7;i++){ const d=new Date(startDate); d.setDate(startDate.getDate()+i); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); thDays+=`<th><div class="th-day"><span>${days[i]}</span><small>${dd}/${mm}</small></div></th>`; }
      thDays+='</tr></thead>'; table.innerHTML=thDays;
      const tbody=document.createElement('tbody');
      const cellHTML=c=>{ if(!c) return '<div class="pill-shift ps-empty">&nbsp;</div>'; if(c.kind==="abs"){ return `<div class="pill-shift is-abs abs" title="${c.long||""}">${c.long||"&nbsp;"}</div>`;} const cls=classFromLong(c.long); const icon=c.icon?(c.icon+"&nbsp;"):""; return `<div class="pill-shift ${cls}" title="${c.long||""}">${icon}${c.long||"&nbsp;"}</div>`; };
      entries.forEach(row=>{ const nameCell=`<div class="name-with-dot"><div class="row"><span class="dot"></span><b>${row.name}</b></div></div>`; const tr=document.createElement('tr'); tr.innerHTML = `<td class="namecol">${nameCell}</td>${row.cells.map(c=>`<td>${cellHTML(c)}</td>`).join('')}`; tbody.appendChild(tr); });
      table.appendChild(tbody);
      document.getElementById('root').appendChild(card); card.appendChild(table);
      requestAnimationFrame(renderNextGroup);
    }
    requestAnimationFrame(renderNextGroup);
  }

  applyFilters();
  window.addEventListener('error', e=>showError('Error JS: '+e.message));
}catch(e){ const errors=document.getElementById('errors'); errors.textContent='Error de inicio: '+(e&&e.message?e.message:e); errors.style.display='block'; }
</script></body></html>"""
    return TEMPLATE.replace("__DATA_PLACEHOLDER__", json.dumps({"rows": data_rows}, ensure_ascii=False))

# ------------------ pipeline principal ------------------
def main():
    tmp = safe_copy_to_temp(EXCEL_SRC)
    xls = pd.ExcelFile(tmp)

    # hoteles manteniendo orden de pestañas y de empleados
    df = read_hotels_keep_order(xls)
    df["Semana"] = pd.to_datetime(df["Semana"], errors="coerce")

    days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    melted = df.melt(id_vars=["Semana","Empleado","Hotel","HotelOrder","EmpOrder"],
                     value_vars=days, var_name="Dia", value_name="TurnoRaw").dropna(subset=["Empleado"]).copy()

    idx = {d:i for i,d in enumerate(days)}
    week_start = melted["Semana"] - pd.to_timedelta(melted["Semana"].dt.weekday, unit="D")
    offs = melted["Dia"].map(idx).fillna(0).astype(int)
    melted["Fecha"] = (week_start + pd.to_timedelta(offs, unit="D")).dt.strftime("%Y-%m-%d")

    # clasificación
    cl = melted["TurnoRaw"].map(classify_cell).tolist()
    melted["Turno"]      = [c["code"] for c in cl]
    melted["TurnoLargo"] = [c["long"] for c in cl]
    melted["TextoDia"]   = [("" if (c["long"] in ("nan","None")) else c["long"]) for c in cl]
    melted["TipoEmpleado"] = ["Ausente" if c["is_abs"] else "Normal" for c in cl]
    melted["Icono"] = ""
    melted["NameColorC"] = ""
    melted["Sustituto"] = ""

    # Guardar base para clonar turnos originales (antes de sustituciones)
    melted_orig = melted.copy()

    # Sustituciones (si existe)
    subs = read_substitutions(xls)
    for _, r in subs.iterrows():
        hotel, emp, fecha = r["Hotel"], r["Empleado"], r["Fecha"]
        sustituto, tipo_raw, cambio = r["Sustituto"], r["TipoAusencia"], r["CambioDeTurno"]
        m_emp = (melted["Hotel"]==hotel)&(melted["Empleado"]==emp)&(melted["Fecha"]==fecha)

        # Cambio de turno 🔄
        if _strip(cambio):
            m_other = (melted["Hotel"]==hotel)&(melted["Empleado"]==cambio)&(melted["Fecha"]==fecha)
            if m_emp.any() and m_other.any():
                t1 = melted.loc[m_emp,  ["Turno","TurnoLargo","TextoDia"]].iloc[0].to_dict()
                t2 = melted.loc[m_other,["Turno","TurnoLargo","TextoDia"]].iloc[0].to_dict()
                melted.loc[m_emp,  ["Turno","TurnoLargo","TextoDia","Icono"]] = [t2["Turno"],t2["TurnoLargo"],t2["TextoDia"],"🔄"]
                melted.loc[m_other,["Turno","TurnoLargo","TextoDia","Icono"]] = [t1["Turno"],t1["TurnoLargo"],t1["TextoDia"],"🔄"]
            continue

        # Ausencia explícita
        if _strip(tipo_raw) and m_emp.any():
            melted.loc[m_emp, ["TipoEmpleado","TextoDia"]] = ["Ausente", tipo_raw]

        # Clonar turno del titular al sustituto
        if _strip(sustituto) and m_emp.any():
            orig = melted_orig[(melted_orig["Hotel"]==hotel)&(melted_orig["Empleado"]==emp)&(melted_orig["Fecha"]==fecha)]
            turno = orig["Turno"].iloc[0] if not orig.empty else melted.loc[m_emp,"Turno"].iloc[0]
            largo = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[m_emp,"TurnoLargo"].iloc[0]
            texto = orig["TextoDia"].iloc[0] if not orig.empty else melted.loc[m_emp,"TextoDia"].iloc[0]
            m_sub = (melted["Hotel"]==hotel)&(melted["Empleado"]==sustituto)&(melted["Fecha"]==fecha)
            if m_sub.any():
                melted.loc[m_sub, ["Turno","TurnoLargo","TextoDia","Icono"]] = [turno, largo, texto, ""]
            else:
                base = melted.loc[m_emp].iloc[0].copy()
                base["Empleado"] = sustituto
                base["Turno"], base["TurnoLargo"], base["TextoDia"] = turno, largo, texto
                base["TipoEmpleado"] = "Normal"
                base["Icono"] = ""
                melted = pd.concat([melted, pd.DataFrame([base])], ignore_index=True)

    # claves de semana/orden para UI
    week_start2 = pd.to_datetime(melted["Fecha"])
    wstart = week_start2 - pd.to_timedelta(week_start2.dt.weekday, unit="D")
    melted["SemKey"]   = wstart.dt.strftime("%Y-%m-%d")
    melted["SemStart"] = melted["SemKey"]
    melted["SemEnd"]   = (wstart + pd.to_timedelta(6, unit="D")).dt.strftime("%Y-%m-%d")

    day_order = {"Lunes":0,"Martes":1,"Miércoles":2,"Jueves":3,"Viernes":4,"Sábado":5,"Domingo":6}
    melted["DayIdx"] = melted["Dia"].map(day_order).fillna(0).astype(int)

    # ORDEN: por pestaña (HotelOrder), semana (SemKey), orden de empleado (EmpOrder), día
    melted = melted.sort_values(["HotelOrder","SemKey","EmpOrder","DayIdx"], kind="stable")

    # serialización segura
    for col in list(melted.columns):
        if pd.api.types.is_datetime64_any_dtype(melted[col]):
            melted[col] = melted[col].dt.strftime("%Y-%m-%d")

    rows = melted.to_dict("records")
    html = build_html(rows)
    OUT_PATH.write_text(html, encoding="utf-8")
    print(f"✔ index.html generado con {len(rows)} filas -> {OUT_PATH}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("❌ Error:", e)
        sys.exit(1)

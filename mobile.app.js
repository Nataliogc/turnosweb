(function(){"use strict";
const $=(s,ctx=document)=>ctx.querySelector(s);
const DAY=86400000;
function fixMojibake(s){
  if(typeof s !== "string") return s;
  const map = [
    [/Ã¡/g,"á"],[/Ã©/g,"é"],[/Ã­/g,"í"],[/Ã³/g,"ó"],[/Ãº/g,"ú"],
    [/Ã±/g,"ñ"],[/Ã‘/g,"Ñ"],[/Ã¼/g,"ü"],[/Ã€/g,"À"],[/Ã¨/g,"è"],
    [/Â¿/g,"¿"],[/Â¡/g,"¡"],[/Âº/g,"º"],[/Âª/g,"ª"],[/Â·/g,"·"],
  ];
  let out = s;
  for(const [re,rep] of map){ out = out.replace(re,rep); }
  out = out.replace(/[ðÂŸ][\u0080-\u00FF\-””“„’ï¸\u00A0-\u00FF]*/g, "").trim();
  out = out.replace(/\s{2,}/g," ");
  return out;
}
const isoLocal=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const monday=d=>{const x=new Date(d);const w=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-w);return x;};
const range7=mon=>Array.from({length:7},(_,i)=>isoLocal(new Date(mon.getTime()+i*DAY)));
const mini=dISO=>{const dt=new Date(dISO+'T00:00:00');return dt.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}).toLowerCase();};

const DATA=(window.FULL_DATA||{});
const SCHEDULE=Array.isArray(DATA.schedule)?DATA.schedule:[];
const byWeekHotel = new Map();
for(const g of SCHEDULE){ const k = g.semana_lunes + "||" + g.hotel; byWeekHotel.set(k,g); }

function labelFromTurno(turno, role){
  if (turno==null) return "";
  if (typeof turno === "string") return fixMojibake(turno);
  const tInt = fixMojibake(turno.TipoInterpretado||"");
  const tOrg = fixMojibake(turno.TurnoOriginal||"");
  if (tInt) return tInt;
  if (tOrg) return tOrg + (role==='sustituto' ? " ↔" : "");
  return "";
}

function render(){
  const meta=document.getElementById("meta"); const weeks=document.getElementById("weeks");
  weeks.innerHTML=""; if(!SCHEDULE.length){ meta.textContent="Sin datos."; return; }
  const mon=monday(new Date()); const weekISO=isoLocal(mon);
  const hotels=[...new Set(SCHEDULE.map(x=>x.hotel))];
  meta.textContent=`Semana ${mini(weekISO)} → ${mini(isoLocal(new Date(mon.getTime()+6*DAY)))}`;

  for(const h of hotels){
    const g = byWeekHotel.get(weekISO+"||"+h);
    if(!g) continue;
    const dias = range7(new Date(g.semana_lunes+"T00:00:00"));
    const idx = new Map();
    for(const t of (g.turnos||[])){ const lab = labelFromTurno(t.turno,""); idx.set(t.empleado+"__"+isoLocal(t.fecha), lab); }
    const orden = (g.orden_empleados||[]).map(fixMojibake);

    const card=document.createElement('article'); card.className='card';
    card.innerHTML=`<div class="head"><img src="${ /cumbria/i.test(h)?'cumbria%20logo.jpg':'guadiana%20logo.jpg' }" alt="logo">
      <div><div style="font-weight:700">${fixMojibake(h)} – Semana ${g.semana_lunes}</div>
      <div style="color:#6b7280;font-size:12px">${dias[0]} → ${dias[6]}</div></div></div>
      <div class="body"><table><thead><tr><th>Empleados</th>${dias.map(d=>`<th>${new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long'}).toUpperCase()}<div class='sub'>${mini(d)}</div></th>`).join("")}
</tr></thead><tbody></tbody></table></div>`;

    const tb=card.querySelector('tbody');
    for(const emp of orden){
      const tr=document.createElement('tr'); let tds=`<td style="text-align:left">${fixMojibake(emp)}</td>`;
      for(const d of dias){
        let lab = idx.get(emp+"__"+d) || "";
        lab = fixMojibake(lab);
        const low = lab.toLowerCase();
        let cls=""; if(/vacaciones|baja|descanso/.test(low)) cls="p-x"; else if(/noche/.test(low)) cls="p-n"; else if(/tarde/.test(low)) cls="p-t"; else if(/mañana|manana/.test(low)) cls="p-m";
        tds += `<td>${ lab ? `<span class="pill ${cls}">${lab}</span>` : '<span class="dash">—</span>' }</td>`;
      }
      tr.innerHTML=tds; tb.appendChild(tr);
    }
    weeks.appendChild(card);
  }
}
document.addEventListener('DOMContentLoaded', render);
})();
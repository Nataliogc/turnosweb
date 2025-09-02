# -*- coding: utf-8 -*-
"""
Generador alineado con 'generar_turnos.py' del usuario:
- Misma clasificación de turnos/ausencias.
- Misma fusión de Sustituciones (incluye 'Cambio de Turno' con swap).
- Misma construcción de 'OrderSemana' y 'VacSemana'.
- Misma estructura final de filas.
- Usa plantilla con marcador __DATA_PLACEHOLDER__ y escribe index.html
"""
import pandas as pd
import json, os, re, unicodedata, sys, tempfile, shutil, time as _time
from pathlib import Path

# --- Rutas
EXCEL_FILE = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
TEMPLATE_HTML = "turnos_final.html"   # debe contener __DATA_PLACEHOLDER__
OUTPUT_HTML = "index.html"

IGNORE_SHEETS = {"Sustituciones", "Hoja1", "Datos de Validación"}

ABSENCE_COLOR = {
    "vacaciones":"#FF4C4C",
    "baja":"#A64CA6",
    "permiso":"#4C6AFF",
    "formacion":"#FFA64C",
    "festivo":"#4CAF50",
    "libranza":"#B59F3B"
}

def _strip(s): return "" if s is None else str(s).strip()
def _canon(s):
    s=_strip(s)
    s2=''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn').lower()
    return re.sub(r'\s+',' ',s2)

def is_absence_text(t):
    if "vaca" in t: return "vacaciones"
    if "baja" in t or "incapac" in t or " it" in t or t=="it": return "baja"
    if "permiso" in t or "retribu" in t: return "permiso"
    if "forma" in t or "curso" in t: return "formacion"
    if "fest" in t: return "festivo"
    if "libr" in t or "libre" in t: return "libranza"
    if "desc" in t: return "descanso"
    return ""

def classify_cell(val):
    s=_strip(val)
    if not s: return {"code":"","long":"","is_abs":False,"abs_key":""}
    c=_canon(s)
    ak=is_absence_text(c)
    if ak and ak!="descanso":
        return {"code":s,"long":s,"is_abs":True,"abs_key":ak}
    if ak=="descanso":
        return {"code":"D","long":"Descanso","is_abs":False,"abs_key":""}
    if c.startswith("man") or "mañana" in s.lower():
        return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
    if "tard" in c:
        return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
    if "noch" in c:
        return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    m=re.search(r'(\d{1,2})\s*[:.]?\s*(\d{0,2})?\s*-\s*(\d{1,2})', c)
    if m:
        h1=int(m.group(1) or 0)
        if 5<=h1<=12: return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
        if 12<h1<=20: return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
        return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    return {"code":"","long":s,"is_abs":False,"abs_key":""}

def open_excel_with_fallback(path: Path):
    last_exc=None
    for _ in range(2):
        try:
            return pd.ExcelFile(path)
        except Exception as e:
            last_exc=e; _time.sleep(0.4)
    # copia temporal
    with tempfile.NamedTemporaryFile(suffix=path.suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)
    shutil.copy2(path, tmp_path)
    try:
        xls = pd.ExcelFile(tmp_path)
        return xls
    except Exception as e2:
        raise RuntimeError(f"No se pudo abrir Excel: {path}\nPrimero: {last_exc}\nFallback: {e2}")
    finally:
        try: tmp_path.unlink(missing_ok=True)
        except Exception: pass

def main():
    script_dir=os.path.dirname(os.path.abspath(__file__))
    excel_path=EXCEL_FILE if os.path.exists(EXCEL_FILE) else os.path.join(script_dir, "Plantilla Cuadrante con Sustituciones v.6.0.xlsx")
    template_path=os.path.join(script_dir, TEMPLATE_HTML)
    output_path=os.path.join(script_dir, OUTPUT_HTML)
    if not os.path.exists(excel_path):
        print(f"❌ Falta Excel: {excel_path}"); sys.exit(1)
    if not os.path.exists(template_path):
        print(f"❌ Falta plantilla: {template_path}"); sys.exit(1)

    xls=open_excel_with_fallback(Path(excel_path))
    hoteles=[]
    order_base_hotel={}
    order_week_map={}

    for sh in xls.sheet_names:
        if sh in IGNORE_SHEETS: continue
        df=pd.read_excel(xls, sheet_name=sh)
        df.columns=df.columns.str.strip()
        df["Hotel"]=sh
        # orden base por hotel
        order_map={}; order=0
        for e in df.get("Empleado", pd.Series(dtype=str)).astype(str).fillna(""):
            e=e.strip()
            if e and e not in order_map:
                order_map[e]=order; order+=1
        order_base_hotel[sh]=order_map
        df["OrderBaseHotel"]=df["Empleado"].astype(str).map(lambda x: order_map.get(x.strip(), 9999))
        # orden semanal por semana
        if "Semana" in df.columns and "Empleado" in df.columns:
            for sem, dfx in df.groupby("Semana", dropna=False):
                try: sem_key=pd.to_datetime(sem).date().isoformat()
                except Exception: continue
                ordmap={}; idx=0
                for e in dfx["Empleado"].astype(str).map(str.strip):
                    if e and e not in ordmap:
                        ordmap[e]=idx; idx+=1
                order_week_map[(sh, sem_key)]=ordmap
        hoteles.append(df)

    if not hoteles:
        print("❌ No hay hojas de hoteles"); sys.exit(1)

    df=pd.concat(hoteles, ignore_index=True)
    df.columns=df.columns.str.strip()
    if "Semana" not in df.columns:
        print("❌ Falta columna 'Semana' en el Excel"); sys.exit(1)

    # normalizar semana como string ISO
    df["Semana"]=pd.to_datetime(df["Semana"]).dt.date.astype(str)

    days=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    for d in days:
        if d not in df.columns: df[d]=""

    melted=df.melt(
        id_vars=["Semana","Empleado","Hotel","OrderBaseHotel"],
        value_vars=days, var_name="Dia", value_name="TurnoRaw"
    ).dropna(subset=["Empleado"]).copy()

    melted["Empleado"]=melted["Empleado"].astype(str).str.strip()
    melted["TurnoRaw"]=melted["TurnoRaw"].fillna("").astype(str)
    melted["Fecha"]=melted.apply(lambda r: (pd.to_datetime(r["Semana"]) + pd.Timedelta(days=days.index(r["Dia"]))).strftime("%Y-%m-%d"), axis=1)

    clist=melted["TurnoRaw"].map(classify_cell).tolist()
    melted["Turno"]=[c["code"] for c in clist]
    melted["TurnoLargo"]=[c["long"] for c in clist]
    melted["TextoDia"]=melted["TurnoLargo"].fillna("").astype(str)

    melted["TipoEmpleado"]="Normal"
    melted["NameColorC"]=""
    melted["Icono"]=""
    melted["Sustituto"]=""
    melted["SustitucionPor"]=""

    def _ord_semana(row):
        return order_week_map.get((row["Hotel"], row["Semana"]), {}).get(row["Empleado"], row["OrderBaseHotel"])
    melted["EmpleadoOrdenSemanaBase"]=melted.apply(_ord_semana, axis=1)
    melted["OrderDia"]=melted["EmpleadoOrdenSemanaBase"].copy()

    melted_orig=melted.copy()

    # Pintar ausencias según celda (vacaciones, baja, ...)
    for i, c in enumerate(clist):
        if c["is_abs"] and c["abs_key"]:
            melted.loc[i,"TipoEmpleado"]="Ausente"
            melted.loc[i,"NameColorC"]=ABSENCE_COLOR.get(c["abs_key"], "#FF4C4C")
            melted.loc[i,"Icono"]=""  # sin emoji salvo cambio de turno
            melted.loc[i,"SustitucionPor"]=melted.loc[i,"TurnoLargo"]
            melted.loc[i,"TextoDia"]=melted.loc[i,"TurnoLargo"]

    # Fusión de hoja Sustituciones (si existe) con swap y creación de fila del sustituto
    sust = pd.DataFrame(columns=["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"])
    if "Sustituciones" in xls.sheet_names:
        s0=pd.read_excel(xls, sheet_name="Sustituciones")
        if not s0.empty:
            s0.columns=s0.columns.str.strip()
            rename_map = {
                "Hotel":"Hotel","Empleado":"Empleado","Fecha":"Fecha","Sustituto":"Sustituto",
                "Tipo Ausencia":"TipoAusencia","Cambio de Turno":"CambioDeTurno"
            }
            for k,v in list(rename_map.items()):
                if k not in s0.columns:
                    # tolerar variantes
                    for cand in s0.columns:
                        if cand.lower().replace("á","a").replace("í","i").replace("ó","o").replace("ú","u").replace("é","e")==k.lower().replace("á","a").replace("í","i").replace("ó","o").replace("ú","u").replace("é","e"):
                            rename_map[k]=cand; break
            s0=s0.rename(columns=rename_map)
            if "Fecha" in s0.columns:
                s0["Fecha"]=pd.to_datetime(s0["Fecha"], dayfirst=True, errors="coerce").dt.strftime("%Y-%m-%d")
            for ccol in ["Hotel","Empleado","Sustituto","TipoAusencia","CambioDeTurno"]:
                if ccol in s0.columns: s0[ccol]=s0[ccol].fillna("").astype(str).str.strip()
            sust=s0

    # aplicar cambios
    for _, r in sust.iterrows():
        hotel, emp, fecha = r.get("Hotel",""), r.get("Empleado",""), r.get("Fecha","")
        sustituto, tipo_raw, cambio = r.get("Sustituto",""), r.get("TipoAusencia",""), r.get("CambioDeTurno","")
        idx_emp=melted[(melted["Hotel"]==hotel)&(melted["Empleado"]==emp)&(melted["Fecha"]==fecha)].index
        if cambio:
            idx2=melted[(melted["Hotel"]==hotel)&(melted["Empleado"]==cambio)&(melted["Fecha"]==fecha)].index
            if not idx_emp.empty and not idx2.empty:
                t1,l1,x1=melted.loc[idx_emp,"Turno"].iloc[0],melted.loc[idx_emp,"TurnoLargo"].iloc[0],melted.loc[idx_emp,"TextoDia"].iloc[0]
                t2,l2,x2=melted.loc[idx2,"Turno"].iloc[0],melted.loc[idx2,"TurnoLargo"].iloc[0],melted.loc[idx2,"TextoDia"].iloc[0]
                melted.loc[idx_emp,["Turno","TurnoLargo","TextoDia","Icono"]]=[t2,l2,x2,"🔄"]
                melted.loc[idx2, ["Turno","TurnoLargo","TextoDia","Icono"]]=[t1,l1,x1,"🔄"]
            continue
        tipo_exact=(tipo_raw or "").strip()
        if tipo_exact and not idx_emp.empty:
            canon=_canon(tipo_exact)
            if is_absence_text(canon):
                melted.loc[idx_emp, ["Turno","TurnoLargo","NameColorC","Icono","TipoEmpleado","SustitucionPor","TextoDia"]] = [tipo_exact,tipo_exact,"#FF4C4C","", "Ausente", tipo_exact, tipo_exact]
        if sustituto and not idx_emp.empty:
            orig=melted_orig[(melted_orig["Hotel"]==hotel)&(melted_orig["Empleado"]==emp)&(melted_orig["Fecha"]==fecha)]
            turno_original = orig["Turno"].iloc[0] if not orig.empty else melted.loc[idx_emp,"Turno"].iloc[0]
            turno_largo_original = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp,"TurnoLargo"].iloc[0]
            texto_original = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp,"TextoDia"].iloc[0]
            ord_tit = orig["EmpleadoOrdenSemanaBase"].iloc[0] if not orig.empty else melted.loc[idx_emp,"EmpleadoOrdenSemanaBase"].iloc[0]
            idx_sub=melted[(melted["Hotel"]==hotel)&(melted["Empleado"]==sustituto)&(melted["Fecha"]==fecha)].index
            if not idx_sub.empty:
                melted.loc[idx_sub, ["Turno","TurnoLargo","TextoDia","Icono","OrderDia"]] = [turno_original, turno_largo_original, texto_original, "", ord_tit]
            else:
                new_r=melted.loc[idx_emp].iloc[0].copy()
                new_r["Empleado"]=sustituto
                new_r["Turno"]=turno_original
                new_r["TurnoLargo"]=turno_largo_original
                new_r["TextoDia"]=texto_original
                new_r["NameColorC"] = ""
                new_r["Icono"] = ""
                new_r["Sustituto"]=emp
                new_r["TipoEmpleado"]="Normal"
                new_r["SustitucionPor"]="Sustitución"
                new_r["OrderDia"]=ord_tit
                base=order_base_hotel.get(hotel, {})
                new_r["OrderBaseHotel"]=base.get(sustituto, 9999)
                wk=order_week_map.get((hotel, new_r["Semana"]), {})
                new_r["EmpleadoOrdenSemanaBase"]=wk.get(sustituto, new_r["OrderBaseHotel"])
                melted=pd.concat([melted, pd.DataFrame([new_r])], ignore_index=True)

    # VacSemana y OrderSemana como en tu script
    melted["VacFlag"]=(melted["TipoEmpleado"].eq("Ausente") & melted["TextoDia"].str.lower().str.contains("vaca")).astype(int)
    agg=melted.groupby(["Hotel","Semana","Empleado"], as_index=False).agg(
        BaseSemana=("EmpleadoOrdenSemanaBase","min"),
        DiaMin=("OrderDia","min"),
        VacSemana=("VacFlag","max")
    )
    agg["OrderSemana"]=agg[["BaseSemana","DiaMin"]].min(axis=1)
    melted=melted.merge(agg[["Hotel","Semana","Empleado","OrderSemana","VacSemana"]], on=["Hotel","Semana","Empleado"], how="left")

    final_df=melted.sort_values(by=["Hotel","Semana","VacSemana","OrderSemana","Empleado","Fecha"])
    final_data=final_df[["Hotel","Empleado","Dia","Fecha","Turno","TurnoLargo","TextoDia","NameColorC","Icono","Sustituto","TipoEmpleado","SustitucionPor","OrderBaseHotel","EmpleadoOrdenSemanaBase","OrderDia","OrderSemana","VacSemana","Semana"]].to_dict("records")

    with open(template_path,"r",encoding="utf-8") as f: html=f.read()
    if "__DATA_PLACEHOLDER__" not in html:
        raise RuntimeError("La plantilla HTML no contiene __DATA_PLACEHOLDER__")
    html=html.replace("__DATA_PLACEHOLDER__", json.dumps({"rows": final_data}, ensure_ascii=False))
    with open(output_path,"w",encoding="utf-8") as f: f.write(html)
    print(f"✅ Generado {OUTPUT_HTML} ({len(final_data)} registros)")

if __name__=="__main__":
    try:
        main()
    except Exception as e:
        print("❌ Error:", e); import traceback; traceback.print_exc(); sys.exit(1)
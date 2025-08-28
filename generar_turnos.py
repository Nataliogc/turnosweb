import pandas as pd
import json, os, re, unicodedata, sys
from datetime import datetime, date

# ==== CONFIGURACIÓN ====
# Ajusta esta ruta si mueves el Excel
excel_file = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
template_html = "turnos_final.html"
output_html   = "index.html"   # publicamos como index.html para GitHub Pages
ignore_sheets = ["Sustituciones", "Hoja1", "Datos de Validación"]

DEBUG_LOG = True  # logs de CAMBIO/SUSTITUTO/AUSENCIA en consola

ABSENCE_COLOR = {
    "vacaciones": "#FF4C4C",
    "baja": "#A64CA6",
    "permiso": "#4C6AFF",
    "formacion": "#FFA64C",
    "festivo": "#4CAF50",
    "libranza": "#B59F3B",
}

# ---------- utilidades ----------
def _strip(s): return "" if s is None else str(s).strip()

def _canon(s: str) -> str:
    """Normaliza para comparar nombres: sin acentos, minúsculas y espacios comprimidos."""
    s = _strip(s)
    s2 = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
    s2 = re.sub(r'[^a-z0-9\s]', ' ', s2)  # fuera signos (& , .)
    return re.sub(r'\s+', ' ', s2).strip()

def _log(msg):
    if DEBUG_LOG: print(msg)

# fecha “vi 29/ago 25”, “29-ago-2025”, Excel-date, etc. -> "YYYY-MM-DD"
MESES = {"ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06","jul":"07",
         "ago":"08","set":"09","sep":"09","sept":"09","oct":"10","nov":"11","dic":"12"}
WD = r'(lu|ma|mi|ju|vi|sa|do)\.?'

def norm_fecha(v) -> str:
    # vacío / NaT
    if v is None or v == "" or (hasattr(pd, "isna") and pd.isna(v)):
        return ""
    # datetime real (no NaT)
    if isinstance(v, (datetime, date, pd.Timestamp)) and not pd.isna(v):
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
        return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")

    # texto tipo "vi 29/ago 25"
    s = str(v).strip().lower()
    s = re.sub(rf'^\s*{WD}\s*', '', s)            # quita "vi ", "lu. ", etc.
    s = s.replace(' de ', ' ').replace(' del ', ' ')
    s = s.replace('-', '/')

    m = re.search(r'(\d{1,2})[\/\s\-\.]([a-zñ]{3,5})[\/\s\-\.](\d{2,4})', s)
    if m:
        dd = int(m.group(1))
        mon = MESES.get(m.group(2)[:4], MESES.get(m.group(2)[:3]))
        yy = int(m.group(3));  yy = (yy+2000) if yy < 100 else yy
        if mon: return f"{yy:04d}-{mon}-{dd:02d}"

    dt = pd.to_datetime(s, dayfirst=True, errors="coerce")
    return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")

def is_absence_text(tcanon: str) -> str:
    if "vaca" in tcanon: return "vacaciones"
    if "baja" in tcanon or "incapac" in tcanon or " it" in tcanon or tcanon=="it": return "baja"
    if "permiso" in tcanon or "retribu" in tcanon: return "permiso"
    if "forma" in tcanon or "curso" in tcanon: return "formacion"
    if "fest" in tcanon: return "festivo"
    if "libr" in tcanon or "libre" in tcanon: return "libranza"
    if "desc" in tcanon: return "descanso"
    return ""

def classify_cell(val: str):
    s = _strip(val)
    if not s: return {"code":"","long":"","is_abs":False,"abs_key":""}
    c = _canon(s)
    ak = is_absence_text(c)
    if ak and ak != "descanso": return {"code":s,"long":s,"is_abs":True,"abs_key":ak}
    if ak == "descanso": return {"code":"D","long":"Descanso","is_abs":False,"abs_key":""}
    if c.startswith("man") or "mañana" in s.lower(): return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
    if "tard" in c: return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
    if "noch" in c: return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    m = re.search(r'(\d{1,2})\s*[:.]?\s*(\d{0,2})?\s*-\s*(\d{1,2})', c)
    if m:
        h1 = int(m.group(1))
        if 5 <= h1 <= 12: return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
        if 12 < h1 <= 20: return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
        return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    return {"code":"","long":s,"is_abs":False,"abs_key":""}

# ---------- generador principal ----------
def process_excel_sheets():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = excel_file if os.path.isabs(excel_file) else os.path.join(script_dir, excel_file)
    template_path = os.path.join(script_dir, template_html)
    output_path = os.path.join(script_dir, output_html)

    if not os.path.exists(excel_path):
        print(f"❌ Falta Excel: {excel_path}"); return
    if not os.path.exists(template_path):
        print(f"❌ Falta plantilla: {template_path}"); return

    xls = pd.ExcelFile(excel_path)
    hoteles = []
    order_base_hotel = {}
    order_week_map = {}

    for sh in xls.sheet_names:
        if sh in ignore_sheets: continue
        df = pd.read_excel(xls, sheet_name=sh)
        df["Hotel"] = sh

        # Orden base por primera aparición del empleado (columna B)
        order_map = {}
        order = 0
        for e in df.get("Empleado", pd.Series(dtype=str)).astype(str).fillna(""):
            e = e.strip()
            if e and e not in order_map:
                order_map[e] = order; order += 1
        order_base_hotel[sh] = order_map
        df["OrderBaseHotel"] = df["Empleado"].astype(str).map(lambda x: order_map.get(x.strip(), 9999))

        # Orden exacto por semana (aparición esa semana)
        if "Semana" in df.columns and "Empleado" in df.columns:
            for sem, dfx in df.groupby("Semana", dropna=False):
                try: sem_key = pd.to_datetime(sem).date().isoformat()
                except Exception: continue
                ordmap = {}
                idx = 0
                for e in dfx["Empleado"].astype(str).map(str.strip):
                    if e and e not in ordmap:
                        ordmap[e] = idx; idx += 1
                order_week_map[(sh, sem_key)] = ordmap

        hoteles.append(df)

    if not hoteles:
        print("❌ No hay hojas de hoteles"); return

    df = pd.concat(hoteles, ignore_index=True)
    df.columns = df.columns.str.strip()
    if "Semana" not in df.columns:
        print("❌ Falta columna 'Semana' en el Excel"); return
    df["Semana"] = pd.to_datetime(df["Semana"]).dt.date.astype(str)

    days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
    for d in days:
        if d not in df.columns: df[d] = ""

    melted = df.melt(
        id_vars=["Semana","Empleado","Hotel","OrderBaseHotel"],
        value_vars=days,
        var_name="Dia",
        value_name="TurnoRaw"
    ).dropna(subset=["Empleado"]).copy()

    melted["Empleado"] = melted["Empleado"].astype(str).str.strip()
    melted["EmpleadoCanon"] = melted["Empleado"].map(_canon)
    melted["HotelCanon"] = melted["Hotel"].map(_canon)
    melted["TurnoRaw"] = melted["TurnoRaw"].fillna("").astype(str)
    melted["Fecha"] = melted.apply(
        lambda r: (pd.to_datetime(r["Semana"]) + pd.Timedelta(days=days.index(r["Dia"]))).strftime("%Y-%m-%d"), axis=1
    )

    # Clasificar celdas (día a día)
    clist = melted["TurnoRaw"].map(classify_cell).tolist()
    melted["Turno"]      = [c["code"] for c in clist]
    melted["TurnoLargo"] = [c["long"] for c in clist]
    melted["TextoDia"]   = melted["TurnoLargo"].fillna("").astype(str)

    melted["TipoEmpleado"] = "Normal"
    melted["NameColorC"] = ""
    melted["Icono"] = ""        # 🔄 solo para cambio de turno
    melted["Sustituto"] = ""
    melted["SustitucionPor"] = ""

    # Orden semanal base
    def _ord_semana(row):
        return order_week_map.get((row["Hotel"], row["Semana"]), {}).get(row["Empleado"], row["OrderBaseHotel"])
    melted["EmpleadoOrdenSemanaBase"] = melted.apply(_ord_semana, axis=1)
    melted["OrderDia"] = melted["EmpleadoOrdenSemanaBase"].copy()

    melted_orig = melted.copy()

    # Marcar ausencias según texto en las celdas del cuadrante
    for i, c in enumerate(clist):
        if c["is_abs"] and c["abs_key"]:
            melted.loc[i, "TipoEmpleado"] = "Ausente"
            melted.loc[i, "NameColorC"] = ABSENCE_COLOR.get(c["abs_key"], "#FF4C4C")
            melted.loc[i, "Icono"] = ""
            melted.loc[i, "SustitucionPor"] = melted.loc[i,"TurnoLargo"]
            melted.loc[i, "TextoDia"] = melted.loc[i,"TurnoLargo"]

    # ===== SUSTITUCIONES / CAMBIOS =====
    sust = pd.DataFrame(columns=["Hotel","Empleado","Fecha","Sustituto","TipoAusencia","CambioDeTurno"])
    if "Sustituciones" in xls.sheet_names:
        s0 = pd.read_excel(xls, sheet_name="Sustituciones")
        if not s0.empty:
            s0.columns = s0.columns.str.strip()
            # aceptar ambos encabezados: "TipoAusencia"/"Tipo Ausencia", "CambioDeTurno"/"Cambio de Turno"
            rename_map = {c:c for c in s0.columns}
            for a,b in [("Tipo Ausencia","TipoAusencia"), ("Cambio de Turno","CambioDeTurno")]:
                if a in s0.columns: rename_map[a] = b
            s0 = s0.rename(columns=rename_map)

            s0["Fecha"] = s0["Fecha"].apply(norm_fecha)
            s0 = s0[s0["Fecha"] != ""]   # descarta filas sin fecha

            for ccol in ["Hotel","Empleado","Sustituto","TipoAusencia","CambioDeTurno"]:
                if ccol in s0.columns: s0[ccol] = s0[ccol].fillna("").astype(str).str.strip()

            s0["HotelCanon"]    = s0["Hotel"].map(_canon)
            s0["EmpleadoCanon"] = s0["Empleado"].map(_canon)
            s0["SustitutoCanon"]= s0["Sustituto"].map(_canon)
            s0["CambioCanon"]   = s0["CambioDeTurno"].map(_canon)
            sust = s0

    def _find_idx(hotel_can, name_can, fecha):
        m = melted
        return m.index[(m["HotelCanon"]==hotel_can)&(m["EmpleadoCanon"]==name_can)&(m["Fecha"]==fecha)].tolist()

    for _, r in sust.iterrows():
        hotel, emp, fecha = _strip(r.get("Hotel","")), _strip(r.get("Empleado","")), _strip(r.get("Fecha",""))
        hotel_can, emp_can = _canon(hotel), _canon(emp)
        sustituto, tipo_raw = _strip(r.get("Sustituto","")), _strip(r.get("TipoAusencia",""))
        sust_can = _canon(sustituto)
        cambio_raw = _strip(r.get("CambioDeTurno",""))
        cambio_can = _canon(cambio_raw)

        if not fecha or not emp: 
            continue

        idx_emp = _find_idx(hotel_can, emp_can, fecha)

        # --- CAMBIO DE TURNO ---
        # a) "Cambio de Turno" = nombre del otro
        # b) "Cambio de Turno" = si/sí/x y el nombre del otro en "Sustituto"
        cambio_name_can = ""
        if cambio_can and cambio_can not in ("si","sí","si.","sí.","x","✓","ok"):
            cambio_name_can = cambio_can
        elif sust_can:
            cambio_name_can = sust_can

        if cambio_name_can:
            idx_other = _find_idx(hotel_can, cambio_name_can, fecha)
            if idx_emp and idx_other:
                i1, i2 = idx_emp[0], idx_other[0]
                t1, l1, x1 = melted.loc[i1, ["Turno","TurnoLargo","TextoDia"]]
                t2, l2, x2 = melted.loc[i2, ["Turno","TurnoLargo","TextoDia"]]
                melted.loc[i1, ["Turno","TurnoLargo","TextoDia","Icono"]] = [t2, l2, x2, "🔄"]
                melted.loc[i2, ["Turno","TurnoLargo","TextoDia","Icono"]] = [t1, l1, x1, "🔄"]
                _log(f"🔄 CAMBIO {fecha} {hotel}: {emp} ⇄ {cambio_raw or sustituto}")
            else:
                _log(f"⚠️ No localizo CAMBIO {fecha} {hotel}: '{emp}' / '{cambio_raw or sustituto}'")
            continue

        # --- AUSENCIA desde Sustituciones ---
        tipo_exact = _strip(tipo_raw)
        if tipo_exact and idx_emp:
            ak = is_absence_text(_canon(tipo_exact))
            if ak:
                melted.loc[idx_emp, ["Turno","TurnoLargo","NameColorC","Icono","TipoEmpleado","SustitucionPor","TextoDia"]] = \
                    [tipo_exact, tipo_exact, ABSENCE_COLOR.get(ak, "#FF4C4C"), "", "Ausente", tipo_exact, tipo_exact]
                _log(f"🅰️ AUSENCIA {fecha} {hotel}: {emp} -> '{tipo_exact}'")

        # --- SUSTITUTO hereda turno y posición del titular ---
        if sust_can and idx_emp:
            orig = melted_orig[(melted_orig["HotelCanon"]==hotel_can)&(melted_orig["EmpleadoCanon"]==emp_can)&(melted_orig["Fecha"]==fecha)]
            turno_original = orig["Turno"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"Turno"]
            turno_largo_original = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"TurnoLargo"]
            texto_original = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"TextoDia"]
            ord_tit = orig["EmpleadoOrdenSemanaBase"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"EmpleadoOrdenSemanaBase"]

            idx_sub = _find_idx(hotel_can, sust_can, fecha)
            if idx_sub:
                melted.loc[idx_sub, ["Turno","TurnoLargo","TextoDia","Icono","OrderDia"]] = [turno_original, turno_largo_original, texto_original, "", ord_tit]
            else:
                new_r = melted.loc[idx_emp[0]].copy()
                new_r["Empleado"] = sustituto
                new_r["EmpleadoCanon"] = sust_can
                new_r["Turno"] = turno_original
                new_r["TurnoLargo"] = turno_largo_original
                new_r["TextoDia"] = texto_original
                new_r["NameColorC"] = ""
                new_r["Icono"] = ""
                new_r["Sustituto"] = emp
                new_r["TipoEmpleado"] = "Normal"
                new_r["SustitucionPor"] = "Sustitución"
                new_r["OrderDia"] = ord_tit
                melted = pd.concat([melted, pd.DataFrame([new_r])], ignore_index=True)
            _log(f"👤 SUSTITUTO {fecha} {hotel}: {sustituto} ocupa turno de {emp}")

    # Orden final por semana + vacaciones al final
    melted["VacFlag"] = (melted["TipoEmpleado"].eq("Ausente") & melted["TextoDia"].str.lower().str.contains("vaca")).astype(int)
    agg = melted.groupby(["Hotel","Semana","Empleado"], as_index=False).agg(
        BaseSemana=("EmpleadoOrdenSemanaBase","min"),
        DiaMin=("OrderDia","min"),
        VacSemana=("VacFlag","max")
    )
    agg["OrderSemana"] = agg[["BaseSemana","DiaMin"]].min(axis=1)
    melted = melted.merge(agg[["Hotel","Semana","Empleado","OrderSemana","VacSemana"]], on=["Hotel","Semana","Empleado"], how="left")

    final_df = melted.sort_values(by=["Hotel","Semana","VacSemana","OrderSemana","Empleado","Fecha"])
    final_data = final_df[[
        "Hotel","Empleado","Dia","Fecha","Turno","TurnoLargo","TextoDia","NameColorC","Icono",
        "Sustituto","TipoEmpleado","SustitucionPor","OrderBaseHotel","EmpleadoOrdenSemanaBase","OrderDia","OrderSemana","VacSemana","Semana"
    ]].to_dict("records")

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()
    if "__DATA_PLACEHOLDER__" not in html:
        raise RuntimeError("La plantilla HTML no contiene __DATA_PLACEHOLDER__")
    html = html.replace("__DATA_PLACEHOLDER__", json.dumps({"rows": final_data}, ensure_ascii=False))

    # sello anti-caché
    build_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    html = html.replace("</head>", f"\n<!-- build:{build_ts} -->\n</head>")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Generado {output_html} ({len(final_data)} registros)")

if __name__ == "__main__":
    try:
        process_excel_sheets()
    except Exception as e:
        print('❌ Error:', e)
        import traceback; traceback.print_exc()
        sys.exit(1)

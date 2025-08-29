# -*- coding: utf-8 -*-
"""
Generador de cuadrantes -> index.html para GitHub Pages

Incluye:
- Diagnóstico CSV (sustituciones_diagnostico.csv)
- Copia temporal si OneDrive/Excel bloquea el archivo (PermissionError)
- Regla: SUSTITUTO > CAMBIO salvo afirmativo (sí/x/ok/✓)
- Renderiza VACACIONES de forma explícita (icono 🏖️, texto y color),
  tanto si vienen desde la celda del calendario como desde la hoja Sustituciones.
"""

import pandas as pd
import json, os, re, unicodedata, sys, shutil, time
from datetime import datetime, date

# ============ CONFIGURACIÓN ============
excel_file = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
template_html = "turnos_final.html"
output_html   = "index.html"
ignore_sheets = ["Sustituciones", "Hoja1", "Datos de Validación"]

DEBUG_LOG = True

ABSENCE_COLOR = {
    "vacaciones": "#FF4C4C",
    "baja": "#A64CA6",
    "permiso": "#4C6AFF",
    "formacion": "#FFA64C",
    "festivo": "#4CAF50",
    "libranza": "#B59F3B",
}

YES_CAMBIO = {"si","sí","si.","sí.","x","✓","ok","cambio","swap"}

def _strip(s): 
    return "" if s is None else str(s).strip()

def _canon(s: str) -> str:
    s = _strip(s)
    s2 = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
    s2 = re.sub(r'[^a-z0-9\s]', ' ', s2)
    return re.sub(r'\s+', ' ', s2).strip()

def _log(msg):
    if DEBUG_LOG:
        print(msg)

MESES = {"ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06","jul":"07",
         "ago":"08","set":"09","sep":"09","sept":"09","oct":"10","nov":"11","dic":"12"}
WD = r'(lu|ma|mi|ju|vi|sa|do)\.?'

def norm_fecha(v) -> str:
    if v is None or v == "" or (hasattr(pd, "isna") and pd.isna(v)):
        return ""
    if isinstance(v, (datetime, date, pd.Timestamp)) and not pd.isna(v):
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
        return "" if pd.isna(dt) else dt.strftime("%Y-%m-%d")
    s = str(v).strip().lower()
    s = re.sub(rf'^\s*{WD}\s*', '', s)
    s = s.replace(' de ', ' ').replace(' del ', ' ')
    s = s.replace('-', '/')
    m = re.search(r'(\d{1,2})[\/\s\-\.]([a-zñ]{3,5})[\/\s\-\.](\d{2,4})', s)
    if m:
        dd  = int(m.group(1))
        mon = MESES.get(m.group(2)[:4], MESES.get(m.group(2)[:3]))
        yy  = int(m.group(3));  yy = (yy+2000) if yy < 100 else yy
        if mon:
            return f"{yy:04d}-{mon}-{dd:02d}"
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
    if not s: 
        return {"code":"","long":"","is_abs":False,"abs_key":""}
    c = _canon(s)
    ak = is_absence_text(c)
    if ak and ak != "descanso": 
        return {"code":s, "long":s, "is_abs":True, "abs_key":ak}
    if ak == "descanso":
        return {"code":"D", "long":"Descanso", "is_abs":False, "abs_key":""}
    if c.startswith("man") or "mañana" in s.lower(): 
        return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
    if "tard" in c:   
        return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
    if "noch" in c:   
        return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    m = re.search(r'(\d{1,2})\s*[:.]?\s*(\d{0,2})?\s*-\s*(\d{1,2})', c)
    if m:
        h1 = int(m.group(1))
        if 5 <= h1 <= 12:   return {"code":"M","long":"Mañana","is_abs":False,"abs_key":""}
        if 12 < h1 <= 20:   return {"code":"T","long":"Tarde","is_abs":False,"abs_key":""}
        return {"code":"N","long":"Noches","is_abs":False,"abs_key":""}
    return {"code":"","long":s,"is_abs":False,"abs_key":""}

def decide_action(cambio_can: str, sust_can: str, tipo_aus: str):
    aus = _strip(tipo_aus)
    if sust_can and cambio_can not in YES_CAMBIO:
        return "SUSTITUTO", sust_can, _strip(sust_can)
    if cambio_can in YES_CAMBIO and sust_can:
        return "CAMBIO", sust_can, _strip(sust_can)
    if cambio_can and not sust_can:
        return "CAMBIO", cambio_can, _strip(cambio_can)
    if aus:
        return "AUSENCIA", "", ""
    return "SIN_ACCION", "", ""

def process_excel_sheets():
    script_dir    = os.path.dirname(os.path.abspath(__file__))
    excel_path    = excel_file if os.path.isabs(excel_file) else os.path.join(script_dir, excel_file)
    template_path = os.path.join(script_dir, template_html)
    output_path   = os.path.join(script_dir, output_html)
    diag_path     = os.path.join(script_dir, "sustituciones_diagnostico.csv")

    if not os.path.exists(excel_path):
        print(f"❌ Falta Excel: {excel_path}"); return
    if not os.path.exists(template_path):
        print(f"❌ Falta plantilla: {template_path}"); return

    xls = None
    tmp_copy = None
    try:
        try:
            xls = pd.ExcelFile(excel_path)
        except PermissionError:
            ts = datetime.now().strftime("%Y%m%d%H%M%S")
            tmp_copy = os.path.join(script_dir, f"_excel_tmp_{ts}.xlsx")
            err = None
            for _ in range(5):
                try:
                    shutil.copy2(excel_path, tmp_copy)
                    _log(f"📄 Copia temporal del Excel (bloqueado): {tmp_copy}")
                    break
                except Exception as e:
                    err = e; time.sleep(0.8)
            if not os.path.exists(tmp_copy):
                raise err or PermissionError("No pude copiar el Excel bloqueado")
            xls = pd.ExcelFile(tmp_copy)

        hoteles = []
        order_base_hotel = {}
        order_week_map   = {}

        for sh in xls.sheet_names:
            if sh in ignore_sheets: 
                continue
            df = pd.read_excel(xls, sheet_name=sh)
            df["Hotel"] = sh

            order_map = {}
            order = 0
            for e in df.get("Empleado", pd.Series(dtype=str)).astype(str).fillna(""):
                e = e.strip()
                if e and e not in order_map:
                    order_map[e] = order; order += 1
            order_base_hotel[sh] = order_map
            df["OrderBaseHotel"] = df["Empleado"].astype(str).map(lambda x: order_map.get(x.strip(), 9999))

            if "Semana" in df.columns and "Empleado" in df.columns:
                for sem, dfx in df.groupby("Semana", dropna=False):
                    try:
                        sem_key = pd.to_datetime(sem).date().isoformat()
                    except Exception:
                        continue
                    ordmap, idx = {}, 0
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
            if d not in df.columns:
                df[d] = ""

        melted = df.melt(
            id_vars=["Semana","Empleado","Hotel","OrderBaseHotel"],
            value_vars=days,
            var_name="Dia",
            value_name="TurnoRaw"
        ).dropna(subset=["Empleado"]).copy()

        melted["Empleado"]      = melted["Empleado"].astype(str).str.strip()
        melted["EmpleadoCanon"] = melted["Empleado"].map(_canon)
        melted["HotelCanon"]    = melted["Hotel"].map(_canon)
        melted["TurnoRaw"]      = melted["TurnoRaw"].fillna("").astype(str)
        melted["Fecha"]         = melted.apply(
            lambda r: (pd.to_datetime(r["Semana"]) + pd.Timedelta(days=days.index(r["Dia"]))).strftime("%Y-%m-%d"), axis=1
        )

        clist = melted["TurnoRaw"].map(classify_cell).tolist()
        melted["Turno"]      = [c["code"] for c in clist]
        melted["TurnoLargo"] = [c["long"] for c in clist]
        melted["TextoDia"]   = melted["TurnoLargo"].fillna("").astype(str)

        melted["TipoEmpleado"] = "Normal"
        melted["NameColorC"]   = ""
        melted["Icono"]        = ""   # 🔄 para cambios
        melted["Sustituto"]    = ""
        melted["SustitucionPor"] = ""

        def _ord_semana(row):
            return order_week_map.get((row["Hotel"], row["Semana"]), {}).get(row["Empleado"], row["OrderBaseHotel"])
        melted["EmpleadoOrdenSemanaBase"] = melted.apply(_ord_semana, axis=1)
        melted["OrderDia"] = melted["EmpleadoOrdenSemanaBase"].copy()

        melted_orig = melted.copy()

        # --- DIAGNÓSTICO SOBRE SUSTITUCIONES ---
        diag_rows = []
        if "Sustituciones" in xls.sheet_names:
            s0 = pd.read_excel(xls, sheet_name="Sustituciones")
            if not s0.empty:
                s0.columns = s0.columns.str.strip()
                s0 = s0.rename(columns={
                    "Hotel":"Hotel","Empleado":"Empleado","Fecha":"Fecha",
                    "Sustituto":"Sustituto","Tipo Ausencia":"TipoAusencia","Cambio de Turno":"CambioDeTurno"
                })
                s0["FechaOriginal"] = s0["Fecha"]
                s0["Fecha"] = s0["Fecha"].apply(norm_fecha)
                s0 = s0[s0["Fecha"] != ""]
                for ccol in ["Hotel","Empleado","Sustituto","TipoAusencia","CambioDeTurno"]:
                    if ccol in s0.columns: s0[ccol] = s0[ccol].fillna("").astype(str).str.strip()
                s0["HotelCanon"]    = s0["Hotel"].map(_canon)
                s0["EmpleadoCanon"] = s0["Empleado"].map(_canon)
                s0["SustitutoCanon"]= s0["Sustituto"].map(_canon)
                s0["CambioCanon"]   = s0["CambioDeTurno"].map(_canon)

                def has_hotel_date(hcan, fecha):
                    m = melted_orig
                    return not m[(m["HotelCanon"]==hcan) & (m["Fecha"]==fecha)].empty

                def has_person(hcan, ncan, fecha):
                    m = melted_orig
                    return not m[(m["HotelCanon"]==hcan) & (m["EmpleadoCanon"]==ncan) & (m["Fecha"]==fecha)].empty

                for _, rr in s0.iterrows():
                    hotel = _strip(rr["Hotel"]);  hcan = rr["HotelCanon"]
                    emp   = _strip(rr["Empleado"]); ecan = rr["EmpleadoCanon"]
                    fecha = _strip(rr["Fecha"])
                    sust  = _strip(rr["Sustituto"]); scan = rr["SustitutoCanon"]
                    camb  = _strip(rr["CambioDeTurno"]); ccan = rr["CambioCanon"]

                    tipo, otro_can, otro_txt = decide_action(ccan, scan, _strip(rr.get("TipoAusencia","")))

                    existe_fecha = has_hotel_date(hcan, fecha)
                    existe_emp   = has_person(hcan, ecan, fecha) if existe_fecha else False
                    existe_otro  = has_person(hcan, otro_can, fecha) if (existe_fecha and otro_can) else (False if otro_can else None)

                    motivo = []
                    if not existe_fecha: motivo.append("No hay cuadrante ese día/hotel")
                    if existe_fecha and not existe_emp: motivo.append("No está el titular en esa fecha")
                    if tipo in ("CAMBIO","SUSTITUTO") and existe_fecha and otro_can and not existe_otro:
                        motivo.append("No está el otro empleado en esa fecha")
                    if not motivo: motivo = [f"OK {tipo}"]
                    motivo = "; ".join(motivo)

                    diag_rows.append({
                        "Hotel": hotel,
                        "FechaOriginal": rr["FechaOriginal"],
                        "FechaNorm": fecha,
                        "Empleado": emp,
                        "CambioDeTurno": camb,
                        "Sustituto": sust,
                        "TipoAusencia": _strip(rr.get("TipoAusencia","")),
                        "TipoInterpretado": tipo,
                        "ExisteFechaEnHotel": existe_fecha,
                        "ExisteTitular": existe_emp,
                        "ExisteOtro": existe_otro,
                        "OtroTexto": otro_txt,
                        "Motivo": motivo,
                    })

        if diag_rows:
            pd.DataFrame(diag_rows).to_csv(diag_path, index=False, encoding="utf-8-sig")
            print(f"🧪 Diagnóstico guardado en: {diag_path} ({len(diag_rows)} filas)")

        # === APLICAR ===
        sust = pd.DataFrame()
        if "Sustituciones" in xls.sheet_names:
            sust = pd.read_excel(xls, sheet_name="Sustituciones")
            if not sust.empty:
                sust.columns = sust.columns.str.strip()
                sust = sust.rename(columns={
                    "Hotel":"Hotel","Empleado":"Empleado","Fecha":"Fecha",
                    "Sustituto":"Sustituto","Tipo Ausencia":"TipoAusencia","Cambio de Turno":"CambioDeTurno"
                })
                sust["Fecha"] = sust["Fecha"].apply(norm_fecha)
                sust = sust[sust["Fecha"] != ""]
                for ccol in ["Hotel","Empleado","Sustituto","TipoAusencia","CambioDeTurno"]:
                    if ccol in sust.columns: sust[ccol] = sust[ccol].fillna("").astype(str).str.strip()
                sust["HotelCanon"]    = sust["Hotel"].map(_canon)
                sust["EmpleadoCanon"] = sust["Empleado"].map(_canon)
                sust["SustitutoCanon"]= sust["Sustituto"].map(_canon)
                sust["CambioCanon"]   = sust["CambioDeTurno"].map(_canon)

        # ausencias en celdas directas (incluye vacaciones)
        for i, c in enumerate(clist):
            if c["is_abs"] and c["abs_key"]:
                melted.loc[i, "TipoEmpleado"]   = "Ausente"
                melted.loc[i, "NameColorC"]     = ABSENCE_COLOR.get(c["abs_key"], "#FF4C4C")
                # Si son VACACIONES, mostrar claramente en el index
                if c["abs_key"] == "vacaciones":
                    melted.loc[i, "Turno"]      = "VAC"
                    melted.loc[i, "TurnoLargo"] = "Vacaciones"
                    melted.loc[i, "TextoDia"]   = "Vacaciones"
                    melted.loc[i, "Icono"]      = "🏖️"
                else:
                    melted.loc[i, "Icono"]      = ""
                    melted.loc[i, "SustitucionPor"] = melted.loc[i,"TurnoLargo"]
                    melted.loc[i, "TextoDia"]       = melted.loc[i,"TurnoLargo"]

        def _find_idx(hotel_can, name_can, fecha):
            m = melted
            return m.index[(m["HotelCanon"]==hotel_can)&(m["EmpleadoCanon"]==name_can)&(m["Fecha"]==fecha)].tolist()

        if not sust.empty:
            for _, r in sust.iterrows():
                hotel      = _strip(r.get("Hotel",""));      hotel_can  = _canon(hotel)
                emp        = _strip(r.get("Empleado",""));   emp_can    = _canon(emp)
                fecha      = _strip(r.get("Fecha",""))
                sustituto  = _strip(r.get("Sustituto",""));  sust_can   = _canon(sustituto)
                tipo_raw   = _strip(r.get("TipoAusencia",""))
                cambio_raw = _strip(r.get("CambioDeTurno","")); cambio_can = _canon(cambio_raw)

                if not fecha or not emp:
                    continue

                idx_emp = _find_idx(hotel_can, emp_can, fecha)

                tipo, otro_can, _ = decide_action(cambio_can, sust_can, tipo_raw)

                if tipo == "CAMBIO":
                    idx_other = _find_idx(hotel_can, otro_can, fecha)
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

                if tipo == "AUSENCIA" and idx_emp:
                    ak = is_absence_text(_canon(tipo_raw))
                    if ak:
                        # Si la ausencia es VACACIONES, estandariza a 'Vacaciones' con icono y color
                        if ak == "vacaciones":
                            melted.loc[idx_emp, ["Turno","TurnoLargo","TextoDia","NameColorC","Icono","TipoEmpleado","SustitucionPor"]] = \
                                ["VAC","Vacaciones","Vacaciones",ABSENCE_COLOR.get("vacaciones","#FF4C4C"),"🏖️","Ausente",tipo_raw]
                        else:
                            melted.loc[idx_emp, ["Turno","TurnoLargo","TextoDia","NameColorC","Icono","TipoEmpleado","SustitucionPor"]] = \
                                [tipo_raw, tipo_raw, tipo_raw, ABSENCE_COLOR.get(ak, "#FF4C4C"), "", "Ausente", tipo_raw]
                        _log(f"🅰️ AUSENCIA {fecha} {hotel}: {emp} -> '{tipo_raw}'")

                if tipo == "SUSTITUTO" and idx_emp:
                    orig = melted[(melted["HotelCanon"]==hotel_can)&(melted["EmpleadoCanon"]==emp_can)&(melted["Fecha"]==fecha)]
                    turno_original       = orig["Turno"].iloc[0]      if not orig.empty else melted.loc[idx_emp[0],"Turno"]
                    turno_largo_original = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"TurnoLargo"]
                    texto_original       = orig["TurnoLargo"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"TextoDia"]
                    ord_tit              = orig["EmpleadoOrdenSemanaBase"].iloc[0] if not orig.empty else melted.loc[idx_emp[0],"EmpleadoOrdenSemanaBase"]

                    idx_sub = _find_idx(hotel_can, otro_can, fecha)
                    if idx_sub:
                        melted.loc[idx_sub, ["Turno","TurnoLargo","TextoDia","Icono","OrderDia"]] = \
                            [turno_original, turno_largo_original, texto_original, "", ord_tit]
                    else:
                        new_r = melted.loc[idx_emp[0]].copy()
                        new_r["Empleado"]      = _strip(r.get("Sustituto",""))
                        new_r["EmpleadoCanon"] = otro_can
                        new_r["Turno"]         = turno_original
                        new_r["TurnoLargo"]    = turno_largo_original
                        new_r["TextoDia"]      = texto_original
                        new_r["NameColorC"]    = ""
                        new_r["Icono"]         = ""
                        new_r["Sustituto"]     = emp
                        new_r["TipoEmpleado"]  = "Normal"
                        new_r["SustitucionPor"]= "Sustitución"
                        new_r["OrderDia"]      = ord_tit
                        melted = pd.concat([melted, pd.DataFrame([new_r])], ignore_index=True)
                    _log(f"👤 SUSTITUTO {fecha} {hotel}: {sustituto} ocupa turno de {emp}")

        # ===== Normalización adicional de VACACIONES por si quedan abreviaturas =====
        vacmask = melted["TextoDia"].str.lower().str.contains("vaca", na=False) | melted["Turno"].str.upper().eq("VAC")
        melted.loc[vacmask, "Turno"]       = "VAC"
        melted.loc[vacmask, "TurnoLargo"]  = "Vacaciones"
        melted.loc[vacmask, "TextoDia"]    = "Vacaciones"
        melted.loc[vacmask, "Icono"]       = melted.loc[vacmask, "Icono"].mask(melted.loc[vacmask, "Icono"].eq(""), "🏖️")
        melted.loc[vacmask, "NameColorC"]  = ABSENCE_COLOR.get("vacaciones", "#FF4C4C")
        melted.loc[vacmask, "TipoEmpleado"]= "Ausente"

        # Orden y render
        melted["VacFlag"] = vacmask.astype(int)
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

        build_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        html = html.replace("</head>", f"\n<!-- build:{build_ts} -->\n</head>")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"✅ Generado {output_html} ({len(final_data)} registros)")

    finally:
        try:
            if xls is not None:
                xls.close()
        except Exception:
            pass
        if tmp_copy and os.path.exists(tmp_copy):
            try:
                os.remove(tmp_copy)
                _log(f"🗑️  Borrada copia temporal: {tmp_copy}")
            except Exception:
                pass

if __name__ == "__main__":
    try:
        process_excel_sheets()
    except Exception as e:
        print('❌ Error:', e)
        import traceback; traceback.print_exc()
        sys.exit(1)

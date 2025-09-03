# exportar_turnos_desde_excel.py  (v2.2 ASCII-safe + excluye hojas auxiliares)
import sys, re, unicodedata, traceback
from pathlib import Path
import pandas as pd
from datetime import datetime

LOG = Path("exportar_turnos.log")

def log(msg:str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with LOG.open("a", encoding="utf-8") as f: f.write(f"[{ts}] {msg}\n")
    try: print(msg)
    except: print(msg.encode("ascii","ignore").decode("ascii"))

def norm(s:str)->str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii","ignore").decode("ascii")
    return re.sub(r"\s+"," ", s).strip().lower()

EXCLUDE_SHEETS = {"datos de validacion","validacion","validaciones","datos validacion","datos"}

def pick_excel_path(arg_path:str|None)->Path:
    if arg_path:
        p=Path(arg_path); 
        if not p.exists(): raise FileNotFoundError(f"No existe el Excel: {p}")
        return p
    cands=sorted(Path(".").glob("*.xlsx"))
    pri=[p for p in cands if re.search(r"plantilla|cuadrante", p.name, re.I)]
    if pri: return pri[0]
    if cands: return cands[0]
    raise FileNotFoundError("ERROR: no encontre ningun .xlsx en la carpeta.")

def main():
    LOG.write_text("", encoding="utf-8")
    try:
        arg = sys.argv[1] if len(sys.argv)>1 else None
        excel = pick_excel_path(arg)
    except FileNotFoundError as e:
        log(str(e)); sys.exit(1)

    log(f"OK Excel usado: {excel.name}")
    try:
        xls = pd.read_excel(excel, sheet_name=None, dtype=str)
    except Exception as e:
        log("ERROR al leer el Excel: "+repr(e)); log(traceback.format_exc()); sys.exit(2)

    frames=[]
    for sheet, df in xls.items():
        try:
            if norm(sheet) in EXCLUDE_SHEETS:
                log(f"- {sheet}: hoja auxiliar, se omite."); continue
            if df is None or df.empty: log(f"- {sheet}: vacia, se omite."); continue
            df=df.dropna(how="all")
            if df.empty: log(f"- {sheet}: solo filas vacias, se omite."); continue

            df.columns=[str(c).strip() for c in df.columns]
            colmap={norm(c):c for c in df.columns}
            hotel_col=None
            for k,v in colmap.items():
                if k=="hotel": hotel_col=v; break
            if not hotel_col:
                for cand in("centro","sede"):
                    if cand in colmap: hotel_col=colmap[cand]; break

            if hotel_col is None:
                df["Hotel"]=sheet; log(f"- {sheet}: anadida columna Hotel='{sheet}'.")
            else:
                if hotel_col!="Hotel":
                    df=df.rename(columns={hotel_col:"Hotel"}); log(f"- {sheet}: renombrada '{hotel_col}' -> 'Hotel'.")
                else:
                    log(f"- {sheet}: columna Hotel OK.")
            if "_Hoja" not in df.columns: df["_Hoja"]=sheet
            frames.append(df)
        except Exception as e:
            log(f"! {sheet}: ERROR procesando hoja, se omite. {repr(e)}"); log(traceback.format_exc()); continue

    if not frames:
        log("ERROR: No se detectaron filas con datos."); sys.exit(2)

    out=pd.concat(frames, ignore_index=True)

    # Filtra filas residuales "Datos de Validación" por seguridad
    mask = out["Hotel"].astype(str).map(lambda s: norm(s)!="datos de validacion")
    out=out[mask]

    cols=list(out.columns)
    if "Hotel" in cols: out=out[["Hotel"]+[c for c in cols if c!="Hotel"]]

    out.to_csv("turnos_mes.csv", index=False, encoding="utf-8-sig")
    log(f"OK generado turnos_mes.csv (filas={len(out)})")
    sys.exit(0)

if __name__=="__main__": main()

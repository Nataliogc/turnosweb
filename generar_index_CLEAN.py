# generar_index_CLEAN.py (v2 - acepta plantilla; filtra hojas auxiliares)
import csv, json, sys, unicodedata
from pathlib import Path
from datetime import datetime

def _norm(s):
    return unicodedata.normalize("NFKD", (s or "")).encode("ascii","ignore").decode("ascii").strip().lower()

ROOT = Path(".")
CSV_PATH = ROOT/"turnos_mes.csv"
TEMPLATE_HTML = ROOT/(sys.argv[1] if len(sys.argv)>1 else "turnos_final.html")
OUTPUT_HTML   = ROOT/"index.html"

def read_rows(p:Path):
    if not p.exists(): raise FileNotFoundError("No existe turnos_mes.csv. Ejecuta exportar_turnos_desde_excel.py primero.")
    with p.open("r", encoding="utf-8-sig", newline="") as f:
        return [{k:(v or "") for k,v in r.items()} for r in csv.DictReader(f)]

def load_tpl(p:Path)->str:
    if not p.exists(): raise FileNotFoundError(f"No existe la plantilla: {p}")
    html=p.read_text(encoding="utf-8")
    if "__DATA_PLACEHOLDER__" not in html: raise ValueError("La plantilla no contiene __DATA_PLACEHOLDER__.")
    return html

rows = read_rows(CSV_PATH)
# filtro anti-hojas auxiliares
rows = [r for r in rows if _norm(r.get("Hotel")) not in {"datos de validacion","validacion","validaciones"}]
data = {"rows": rows, "meta": {"generado": datetime.now().isoformat()}}
html = load_tpl(TEMPLATE_HTML).replace("__DATA_PLACEHOLDER__", json.dumps(data, ensure_ascii=False))
OUTPUT_HTML.write_text(html, encoding="utf-8")
f1 = rows[0].get("Fecha","?") if rows else "?"
f2 = rows[-1].get("Fecha","?") if rows else "?"
print("OK Generado index.html (filas=%d) Rango: %s -> %s  Plantilla: %s" % (len(rows), f1, f2, TEMPLATE_HTML.name))

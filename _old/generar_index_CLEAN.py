# generar_index_CLEAN.py (v2)
import csv, json, sys
from pathlib import Path
from datetime import datetime

ROOT = Path(".")
CSV_PATH = ROOT/"turnos_mes.csv"
TEMPLATE_HTML = ROOT/(sys.argv[1] if len(sys.argv)>1 else "turnos_final.html")
OUTPUT_HTML   = ROOT/"index.html"

def read_rows(p):
    if not p.exists(): raise FileNotFoundError("No existe turnos_mes.csv.")
    with p.open("r",encoding="utf-8-sig",newline="") as f:
        return [ {k:(v or "") for k,v in row.items()} for row in csv.DictReader(f) ]

def load_tpl(p):
    if not p.exists(): raise FileNotFoundError(f"No existe la plantilla: {p}")
    html = p.read_text(encoding="utf-8")
    if "__DATA_PLACEHOLDER__" not in html:
        raise ValueError("La plantilla no contiene __DATA_PLACEHOLDER__.")
    return html

rows = read_rows(CSV_PATH)
data = {"rows":rows, "meta":{"generado":datetime.now().isoformat()}}
html = load_tpl(TEMPLATE_HTML).replace("__DATA_PLACEHOLDER__", json.dumps(data, ensure_ascii=False))
OUTPUT_HTML.write_text(html, encoding="utf-8")
print("OK Generado index.html (filas=%d) Plantilla: %s" % (len(rows), TEMPLATE_HTML.name))

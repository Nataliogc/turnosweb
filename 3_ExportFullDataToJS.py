# 3_ExportFullDataToJS.py
# Extrae window.FULL_DATA de index.html y genera/actualiza data.js
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
index_path = ROOT / "index.html"
data_js_path = ROOT / "data.js"

html = index_path.read_text(encoding="utf-8")

marker = "window.FULL_DATA ="
idx = html.find(marker)
if idx == -1:
    raise SystemExit("No se encontró 'window.FULL_DATA =' en index.html")

# Buscar el final del bloque: hasta el cierre del </script> que lo contiene
end_script = html.find("</script>", idx)
if end_script == -1:
    raise SystemExit("No se encontró cierre </script> después de FULL_DATA")

block = html[idx:end_script].strip()
# Asegurarnos de que termina en ';'
if not block.rstrip().endswith(";"):
    block = block.rstrip() + ";"

ts = datetime.now().strftime("%Y%m%d_%H%M")
header = f"// generado {ts}\n"

data_js_path.write_text(header + block + "\n", encoding="utf-8")
print(f"[OK] Actualizado {data_js_path.name} a partir de index.html")

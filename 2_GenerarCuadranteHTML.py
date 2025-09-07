# 2_GenerarCuadranteHTML.py — v6.5
# - Inyecta FULL_DATA en index.html
# - Garantiza enlaces versionados a CSS/JS (?v=6.5)

import os, re, json, sys

VER = "6.5"
HTML_PATH = "index.html"

# 1) Localiza el JSON con los datos (producido por 1_ExtraerDatosExcel.py)
CANDIDATES = [
    "DATA_preview.json",
    os.path.join("turnosweb", "DATA_preview.json"),
    os.path.join("turnosweb", "DATA.json"),
]
data = None
for p in CANDIDATES:
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        break

if data is None:
    print("[ERROR] No encuentro DATA_preview.json / DATA.json. Ejecuta antes 1_ExtraerDatosExcel.py")
    sys.exit(1)

# 2) Lee index.html (la plantilla con [[DATA_PLACEHOLDER]])
if not os.path.exists(HTML_PATH):
    print(f"[ERROR] No existe {HTML_PATH}. Copia la versión v6.5 que te pasé.")
    sys.exit(1)

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# 3) Fuerza enlaces versionados a CSS/JS
html = re.sub(r'href="\./styles\.css[^"]*"', f'href="./styles.css?v={VER}"', html)
html = re.sub(r'src="\./plantilla_adapter_semana\.js[^"]*"', f'src="./plantilla_adapter_semana.js?v={VER}"', html)

# 4) Inserta/actualiza el bloque de datos
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
script_block = f'<script id="fullData">window.FULL_DATA={payload};</script>'

if "[[DATA_PLACEHOLDER]]" in html:
    html = html.replace("[[DATA_PLACEHOLDER]]", script_block)
elif re.search(r'<script[^>]+id=["\']fullData["\'][\s\S]*?</script>', html, flags=re.I):
    html = re.sub(r'<script[^>]+id=["\']fullData["\'][\s\S]*?</script>', script_block, html, flags=re.I)
else:
    html = html.replace("</body>", script_block + "\n</body>")

# 5) Escribe el resultado
with open(HTML_PATH, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)

print("[OK] index.html v6.5 actualizado con datos y enlaces versionados.")

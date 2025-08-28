# Turnos Web

Genera un **cuadrante HTML** y permite **exportar ICS** desde tu Excel maestro (que mantienes en OneDrive).

## Requisitos
- Python 3.10+
- `pip install -r requirements.txt`

## Configuración
En `generar_turnos.py` ya está apuntando a tu Excel en OneDrive:

```python
excel_file = r"C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
template_html = "turnos_final.html"
output_html = "cuadrante.html"   # cambia a "index.html" si quieres que sea la home de Pages
```

## Generar
```bash
python generar_turnos.py
```
Abrir `cuadrante.html` (mejor sirviendo por HTTP local):
```bash
python -m http.server 8000
# http://localhost:8000/cuadrante.html
```

## Publicar en GitHub Pages
1. Sube el repo a GitHub.
2. En **Settings → Pages**, activa Pages con **Source: GitHub Actions** (o "Deploy from Branch" y usa `main / root`).  
3. (Opcional) Usa el workflow `.github/workflows/pages.yml` incluido.

La página quedará accesible en:
```
https://TU_USUARIO.github.io/TU_REPO/cuadrante.html
```

## Actualizar (rápido)
Cada vez que modifiques el Excel en OneDrive:
```bash
python generar_turnos.py
git add cuadrante.html
git commit -m "Actualiza cuadrante"
git push
```

## Notas
- El botón ICS exporta **exactamente** lo que aparece en cada día (incluye Vacaciones/Descanso/Baja).
- Orden por semana/columna B del Excel, sustitutos **sin duplicar fila**, vacaciones **al final**, semanas **L→D** con fecha `dd/mm`.

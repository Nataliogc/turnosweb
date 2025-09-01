# Turnos Web (última versión)

Este paquete deja **tu visualización intacta** y solo reescribe `sustituciones_diagnostico.csv`
desde el Excel maestro en OneDrive:

```
C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx
```

## Requisitos
- Python 3.10+
- `pip install -r requirements.txt`

## Uso
1. Ejecuta el generador (desde la carpeta del repo):
   ```powershell
   py -u .\generar_turnos.py
   ```
2. Publica en GitHub (incluye CSV/HTML si cambiaron):
   ```powershell
   .\actualizar.ps1
   ```

## GitHub Pages
- Settings → Pages → “Deploy from a branch” → `main` → root (`/`).
- `.nojekyll` fuerza contenido estático sin procesado Jekyll.

---
**Notas**
- El script tolera el bloqueo de OneDrive/Excel copiando a temporal.
- Fechas en español (ej. `lu 09/jun 25`). Lee **hasta la última fila** de la hoja.

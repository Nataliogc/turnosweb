# Turnos Web (pipeline)

## Flujo
1) `exportar_turnos_desde_excel.py` -> genera `turnos_mes.csv` (excluye hoja "Datos de Validación").
2) `generar_index_CLEAN.py` -> inyecta datos en `turnos_final.html` (marca: __DATA_PLACEHOLDER__).
3) `generar_live.py` -> genera `live.html` (UI completa).
4) `run_turnos.bat` -> ejecuta todo y copia `live.html` como `index.html`.

## Uso rápido

## Publicar (opcional)
Añade tu lógica en `publicar.ps1` y lánzalo tras generar.

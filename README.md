
# Traslado Municipal — Reservas (MVP gratis)

Frontend estático + backend Apps Script/Sheets.

## Flujo
1. Crear Spreadsheet + Apps Script (`backend.gs`) y publicar Web App.
2. Poner la URL del Web App en `api.json` (campo `API_URL`).
3. Conectar el repo a Netlify (build vacío, publish directory `/`).

## Endpoints (backend)
- GET `?action=availability&date=YYYY-MM-DD`
- POST `{ action:"reservar", nombre, departamento, vehiculo_id, fecha, inicio, fin }`
- POST `{ action:"bloquear", vehiculo_id, fecha, inicio, fin, motivo, token }`


INSTRUCCIONES RÁPIDAS (100% GRATIS)

A) Backend (Google Apps Script + Google Sheets)
1) Crea un Google Spreadsheet llamado "Traslado Municipal — Reservas".
2) Hojas y cabeceras:
   - vehiculos: id | nombre | tipo | patente | estado
   - reservas : id | fecha | inicio | fin | vehiculo_id | nombre | departamento | estado | created_at
   - bloqueos : id | fecha | inicio | fin | vehiculo_id | motivo
3) Extensiones > Apps Script: pega backend.gs.
4) File > Project properties > Script properties: agrega SS_ID con el ID de la planilla.
5) Deploy > New deployment > Web app > acceso: Anyone. Copia la URL.

B) Frontend (GitHub + Netlify)
1) Crea repo `traslado-municipal` y sube: index.html, brand.json, api.json, backend.gs, README_RESERVAS.txt, README.md
2) Netlify: Add new site > Import from Git. Build command: (vacío). Publish dir: /
3) Edita api.json y pega la URL del Web App en API_URL. Netlify se actualiza solo.

Reglas del backend:
- Un vehículo por DEPARTAMENTO en el mismo rango horario.
- Buffer 30 min por vehículo antes/después de cada reserva.
- Bloqueos de mantención impiden reservar.

Config UI (index.html):
- Slots de 1h, inicios cada 30m. Jornada 08:00–20:00 (ajustable).

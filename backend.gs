/*****************************************************
 * Traslado Municipal — Backend (Google Apps Script)
 * Hoja de cálculo: "RESERVAS" con encabezados:
 * A: timestamp | B: fecha | C: nombre | D: depto | E: motivo | F: vehiculo | G: horario | H: estado
 *****************************************************/

// === CONFIG ===
const SHEET_NAME = "RESERVAS";     // nombre de la pestaña
const HEADERS = ["timestamp","fecha","nombre","depto","motivo","vehiculo","horario","estado"];

// Si usas varios orígenes, agrega aquí tus dominios Netlify/Render permitidos
const ALLOWED_ORIGINS = [
  "https://tusitio.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

// === CORS helper ===
function withCors_(e, payload, status) {
  const origin = (e && e.parameter && e.parameter.origin) || "";
  const headers = {
    "Access-Control-Allow-Origin": "*", // o usa origin dinámico si quieres estricto
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return ContentService
    .createTextOutput(typeof payload === "string" ? payload : JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}

function doOptions(e) { // preflight
  return withCors_(e, { ok: true });
}

// === Entradas ===
function doGet(e) {
  try {
    const op = (e.parameter && e.parameter.op) || "";
    if (op === "listar_reservas") {
      const data = listarReservas_();
      return withCors_(e, { ok: true, reservas: data });
    }
    // default: ping
    return withCors_(e, { ok: true, msg: "Traslado Municipal API (GET)" });
  } catch (err) {
    return withCors_(e, { ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const op = body.op || "";

    if (op === "crear_reserva") {
      const { nombre, depto, motivo, vehiculo, horario } = body;
      if (!nombre || !depto) {
        return withCors_(e, { ok: false, error: "Faltan campos obligatorios (nombre, depto)." });
      }
      const id = crearReserva_({ nombre, depto, motivo, vehiculo, horario });
      return withCors_(e, { ok: true, id });
    }

    return withCors_(e, { ok: false, error: "Operación no soportada." });
  } catch (err) {
    return withCors_(e, { ok: false, error: String(err) });
  }
}

// === Lógica ===
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  // Asegura encabezados
  const currentHeaders = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
  if (HEADERS.join("|") !== currentHeaders.join("|")) {
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function listarReservas_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const range = sh.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();

  // Mapea columnas a objeto
  return values.map(row => ({
    timestamp: row[0],
    fecha:     row[1],
    nombre:    row[2],
    depto:     row[3],
    motivo:    row[4],
    vehiculo:  row[5],
    horario:   row[6],
    estado:    row[7] || "Pendiente"
  }));
}

function crearReserva_({ nombre, depto, motivo, vehiculo, horario }) {
  const sh = getSheet_();
  const now = new Date();
  const fecha = Utilities.formatDate(now, Session.getScriptTimeZone() || "America/Santiago", "yyyy-MM-dd HH:mm");

  // Inserta al final
  const row = [
    now,               // timestamp (Date)
    fecha,             // fecha legible
    nombre,
    depto,
    motivo || "",
    vehiculo || "",    // puede venir vacío, luego se asigna
    horario || "",     // puede venir vacío, luego se asigna
    "Pendiente"
  ];
  sh.appendRow(row);
  return sh.getLastRow(); // ID básico: número de fila
}

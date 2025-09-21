/*****************************************************
 * Traslado Municipal — Backend (Google Apps Script)
 * Hoja: RESERVAS
 * A: timestamp | B: fecha | C: nombre | D: depto | E: direccion | F: motivo | G: vehiculo | H: horario | I: estado
 *****************************************************/

const SHEET_NAME = "RESERVAS";
const HEADERS = ["timestamp","fecha","nombre","depto","direccion","motivo","vehiculo","horario","estado"];

// CORS
function withCors_(e, payload) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return ContentService.createTextOutput(
    typeof payload === "string" ? payload : JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON).setHeaders(headers);
}
function doOptions(e){ return withCors_(e, { ok:true }); }

// Entradas
function doGet(e){
  try{
    const op = (e.parameter && e.parameter.op) || "";
    if(op === "listar_reservas"){
      return withCors_(e, { ok:true, reservas: listarReservas_() });
    }
    return withCors_(e, { ok:true, msg:"Traslado Municipal API (GET)" });
  }catch(err){ return withCors_(e, { ok:false, error:String(err) }); }
}
function doPost(e){
  try{
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const op = body.op || "";
    if(op === "crear_reserva"){
      // Normalizamos a MAYÚSCULA desde servidor
      const nombre    = (body.nombre||"").toString().trim().toUpperCase();
      const depto     = (body.depto||"").toString().trim().toUpperCase();
      const direccion = (body.direccion||"").toString().trim().toUpperCase();
      const motivo    = (body.motivo||"").toString().trim().toUpperCase();
      const vehiculo  = (body.vehiculo||"").toString().trim().toUpperCase();
      const horario   = (body.horario||"").toString().trim().toUpperCase();

      if(!nombre || !depto || !direccion){
        return withCors_(e, { ok:false, error:"FALTAN CAMPOS OBLIGATORIOS: NOMBRE / DEPTO / DIRECCIÓN." });
      }
      if(horario && direccion && existeChoqueDireccionHorario_(direccion, horario)){
        return withCors_(e, { ok:false, error:"LA DIRECCIÓN YA TIENE UNA RESERVA EN ESE HORARIO." });
      }
      const id = crearReserva_({ nombre, depto, direccion, motivo, vehiculo, horario });
      return withCors_(e, { ok:true, id });
    }
    return withCors_(e, { ok:false, error:"OPERACIÓN NO SOPORTADA." });
  }catch(err){ return withCors_(e, { ok:false, error:String(err) }); }
}

// Hoja
function getSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if(!sh){
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  // Asegura encabezados correctos
  const cur = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
  if(cur.join("|") !== HEADERS.join("|")){
    sh.clear(); // limpia encabezado/estructura
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function listarReservas_(){
  const sh = getSheet_();
  const last = sh.getLastRow();
  if(last < 2) return [];
  const rng = sh.getRange(2,1,last-1,HEADERS.length).getValues();
  return rng.map(r=>({
    timestamp: r[0],
    fecha:     r[1],
    nombre:    r[2],
    depto:     r[3],
    direccion: r[4],
    motivo:    r[5],
    vehiculo:  r[6],
    horario:   r[7],
    estado:    r[8] || "PENDIENTE",
  }));
}

function crearReserva_({ nombre, depto, direccion, motivo, vehiculo, horario }){
  const sh = getSheet_();
  const now = new Date();
  const fecha = Utilities.formatDate(now, Session.getScriptTimeZone() || "America/Santiago", "yyyy-MM-dd HH:mm");
  const row = [ now, fecha, nombre, depto, direccion, motivo||"", vehiculo||"", horario||"", "PENDIENTE" ];
  sh.appendRow(row);
  return sh.getLastRow();
}

// Evita dos reservas de la misma DIRECCIÓN en el mismo HORARIO
function existeChoqueDireccionHorario_(direccion, horario){
  const sh = getSheet_();
  const last = sh.getLastRow();
  if(last < 2) return false;
  const rng = sh.getRange(2,1,last-1,HEADERS.length).getValues();
  return rng.some(r => (r[4]||"") === direccion && (r[7]||"") === horario);
}

// === Google Apps Script backend para Traslado Municipal ===
// Hojas requeridas: 'vehiculos', 'reservas', 'bloqueos'
const ADMIN_TOKEN = "cambia-este-token-seguro";

function _ss(){ const ssId = PropertiesService.getScriptProperties().getProperty("SS_ID"); if(!ssId) throw new Error("Configura SS_ID"); return SpreadsheetApp.openById(ssId); }
function _sheet(name){ return _ss().getSheetByName(name); }

function doGet(e){
  const action = (e.parameter.action || "").toLowerCase();
  if (action === "availability"){
    const date = e.parameter.date; // YYYY-MM-DD
    return _json(availability(date));
  }
  return _json({ ok:false, error:"Bad request" }, 400);
}

function doPost(e){
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err){}
  const action = (body.action || "").toLowerCase();
  if (action === "reservar") return _json(reservar(body));
  if (action === "bloquear"){
    if (body.token !== ADMIN_TOKEN) return _json({ ok:false, error:"Unauthorized" }, 401);
    return _json(bloquear(body));
  }
  return _json({ ok:false, error:"Bad request" }, 400);
}

function availability(date){
  return {
    ok: true,
    vehiculos: _readVehiculos(),
    reservas: _readReservas(date),
    bloqueos: _readBloqueos(date)
  };
}

function reservar({ nombre, departamento, vehiculo_id, fecha, inicio, fin }){
  const lock = LockService.getScriptLock(); lock.tryLock(5000);
  try {
    if (!nombre || !departamento || !vehiculo_id || !fecha || !inicio || !fin) return { ok:false, error:"Campos incompletos." };
    const s = _toMin(inicio), e = _toMin(fin); if (s >= e) return { ok:false, error:"Rango horario inválido." };
    const reservas = _readReservas(fecha);
    const bloqueos = _readBloqueos(fecha);
    // 1) regla por departamento
    const deptConflict = reservas.some(r => r.departamento === departamento && _overlap(s,e,_toMin(r.inicio),_toMin(r.fin)));
    if (deptConflict) return { ok:false, error:"Tu departamento ya usa un vehículo en ese horario." };
    // 2) ocupación + buffer 30
    const buffer = 30;
    const vehConflict = reservas.some(r => r.vehiculo_id === vehiculo_id && _overlap(s,e,_toMin(r.inicio)-buffer,_toMin(r.fin)+buffer));
    if (vehConflict) return { ok:false, error:"El vehículo no está disponible (ocupado o en buffer de 30 min)." };
    // 3) mantención
    const blkConflict = bloqueos.some(b => b.vehiculo_id === vehiculo_id && _overlap(s,e,_toMin(b.inicio),_toMin(b.fin)));
    if (blkConflict) return { ok:false, error:"Vehículo bloqueado por mantención." };
    // registrar
    const sh = _sheet("reservas");
    const id = "R-"+Date.now();
    sh.appendRow([id, fecha, inicio, fin, vehiculo_id, nombre, departamento, "CONFIRMADA", new Date()]);
    return { ok:true, id };
  } finally { lock.releaseLock(); }
}

function bloquear({ vehiculo_id, fecha, inicio, fin, motivo }){
  if (!vehiculo_id || !fecha || !inicio || !fin) return { ok:false, error:"Campos incompletos." };
  const sh = _sheet("bloqueos");
  const id = "B-"+Date.now();
  sh.appendRow([id, fecha, inicio, fin, vehiculo_id, motivo || "Mantención"]);
  return { ok:true, id };
}

// Helpers
function _json(obj, code){
  const out = ContentService.createTextOutput(JSON.stringify(obj || {}));
  out.setMimeType(ContentService.MimeType.JSON);
  if (code) out.setContent(JSON.stringify({ code, ...(obj||{}) }));
  return out;
}
function _toMin(hhmm){ const [h,m] = hhmm.split(":"); return parseInt(h)*60 + parseInt(m); }
function _overlap(a1,a2,b1,b2){ return (a1 < b2 && b1 < a2); }

function _readVehiculos(){
  const sh = _sheet("vehiculos"); const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  return rows.filter(r => r[0]).map(r => ({ id:r[0], nombre:r[1], tipo:r[2], patente:r[3], estado:r[4] }));
}
function _readReservas(fecha){
  const sh = _sheet("reservas"); const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  return rows.filter(r => r[0] && r[1] === fecha).map(r => ({
    id:r[0], fecha:r[1], inicio:r[2], fin:r[3], vehiculo_id:r[4],
    nombre:r[5], departamento:r[6], estado:r[7]
  }));
}
function _readBloqueos(fecha){
  const sh = _sheet("bloqueos"); const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  return rows.filter(r => r[0] && r[1] === fecha).map(r => ({
    id:r[0], fecha:r[1], inicio:r[2], fin:r[3], vehiculo_id:r[4], motivo:r[5]
  }));
}

/* === CONFIG === */
const SPREADSHEET_ID = 'PEGAR_AQUI_ID_DE_TU_PLANILLA'; // File > Share link -> toma el ID
const SHEET_VEHICULOS = 'vehiculos';
const SHEET_RESERVAS  = 'reservas';
const SHEET_BLOQUEOS  = 'bloqueos';

// Ajustes de reglas
const BUFFER_MIN = 30;     // colchón entre reservas del MISMO vehículo
const SLOT_MIN   = 60;     // duración mínima que esperas (1h)
const FMT_TZ     = Session.getScriptTimeZone() || 'America/Santiago';

/* === HTTP === */
function doGet(e){
  try{
    const action = (e.parameter.action || '').toLowerCase();
    if (action === 'availability'){
      const date = e.parameter.date; // YYYY-MM-DD
      if (!date) return _json({ok:false, error:'date requerido'});
      return _json({
        ok:true,
        vehiculos: _readVehiculos(),
        reservas:  _readReservas(date),
        bloqueos:  _readBloqueos(date)
      });
    }
    return _json({ok:true, hello:'ok'});
  }catch(err){
    return _json({ok:false, error:String(err)});
  }
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents || '{}');
    const action = (body.action || '').toLowerCase();

    if (action === 'reservar'){
      const result = _reservar(body);
      return _json(result);
    }
    return _json({ok:false, error:'acción no soportada'});
  }catch(err){
    return _json({ok:false, error:String(err)});
  }
}

/* === CORE === */
function _reservar(p){
  // payload esperado
  // { fecha, inicio, fin, vehiculo_id, nombre, departamento }
  const req = ['fecha','inicio','fin','vehiculo_id','nombre','departamento'];
  for (const k of req) if (!p[k]) return {ok:false, error:`Falta ${k}`};

  // normaliza
  const fecha = p.fecha;          // YYYY-MM-DD
  const inicio = p.inicio;        // HH:MM
  const fin    = p.fin;           // HH:MM
  const veh    = String(p.vehiculo_id).trim();
  const nombre = String(p.nombre).trim();
  const depto  = String(p.departamento).trim();

  // Reglas:
  // 1) Vehículo libre con buffer (BUFFER_MIN)
  const vehFree = _vehiculoLibre(fecha, veh, inicio, fin, BUFFER_MIN);
  if (!vehFree.ok) return vehFree;

  // 2) Departamento NO puede tener 2 vehículos en el mismo rango horario
  const deptFree = _deptoLibre(fecha, depto, inicio, fin);
  if (!deptFree.ok) return deptFree;

  // 3) Anotar reserva
  const sh = _sheet(SHEET_RESERVAS);
  const created = Utilities.formatDate(new Date(), FMT_TZ, 'yyyy-MM-dd HH:mm:ss');
  sh.appendRow([fecha, inicio, fin, veh, nombre, depto, created]);

  return {ok:true};
}

/* === Reglas === */
function _vehiculoLibre(fecha, vehId, inicio, fin, bufferMin){
  const s = _toMin(inicio), e = _toMin(fin);

  // bloqueos/mantención
  const bloqs = _readBloqueos(fecha).filter(b => b.vehiculo_id == vehId);
  for (const b of bloqs){
    if (_overlap(s,e, _toMin(b.inicio), _toMin(b.fin))){
      return {ok:false, error:'Vehículo en mantención'};
    }
  }
  // reservas del mismo vehículo (aplica buffer)
  const res = _readReservas(fecha).filter(r => r.vehiculo_id == vehId);
  for (const r of res){
    if (_overlap(s,e, _toMin(r.inicio)-bufferMin, _toMin(r.fin)+bufferMin)){
      return {
        ok:false,
        error:'Vehículo ocupado',
        conflict: {
          nombre: r.nombre, departamento: r.departamento,
          vehiculo: vehId, inicio: r.inicio, fin: r.fin
        }
      };
    }
  }
  return {ok:true};
}

function _deptoLibre(fecha, depto, inicio, fin){
  const s = _toMin(inicio), e = _toMin(fin);
  const res = _readReservas(fecha).filter(r => (r.departamento||'').toLowerCase() === depto.toLowerCase());
  for (const r of res){
    // NO se aplica buffer a nivel depto: se bloquea SOLO si se traslapan horario exacto
    if (_overlap(s,e, _toMin(r.inicio), _toMin(r.fin))){
      return {
        ok:false,
        error:'Tu departamento ya tiene una reserva en ese horario',
        conflict: {
          nombre: r.nombre, departamento: r.departamento,
          vehiculo: r.vehiculo_id, inicio: r.inicio, fin: r.fin
        }
      };
    }
  }
  return {ok:true};
}

/* === Lecturas === */
function _readVehiculos(){
  const sh = _sheet(SHEET_VEHICULOS);
  const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  // id | nombre | tipo | patente | estado | foto_url
  return rows.filter(r => r[0]).map(r => ({
    id:String(r[0]), nombre:r[1], tipo:r[2], patente:r[3], estado:r[4], foto_url:r[5]
  }));
}

function _readReservas(fecha){
  const sh = _sheet(SHEET_RESERVAS);
  const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  // fecha | inicio | fin | vehiculo_id | nombre | departamento | created_at
  return rows.filter(r => r[0] && r[0] === fecha).map(r => ({
    fecha:r[0], inicio:r[1], fin:r[2], vehiculo_id:String(r[3]), nombre:r[4], departamento:r[5]
  }));
}

function _readBloqueos(fecha){
  const sh = _sheet(SHEET_BLOQUEOS);
  const vals = sh.getDataRange().getValues();
  const [hdr, ...rows] = vals;
  // fecha | inicio | fin | vehiculo_id | motivo
  return rows.filter(r => r[0] && r[0] === fecha).map(r => ({
    fecha:r[0], inicio:r[1], fin:r[2], vehiculo_id:String(r[3]), motivo:r[4]
  }));
}

/* === Utils === */
function _sheet(name){ return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }
function _toMin(hhmm){ const [H,M]=(hhmm||'0:0').split(':').map(Number); return H*60+M; }
function _overlap(a1,a2,b1,b2){ return Math.max(a1,b1) < Math.min(a2,b2); }
function _json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

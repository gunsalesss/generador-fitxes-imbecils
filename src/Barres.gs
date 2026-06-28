/**
 * Lector de la pestanya "Barres 2026" (dins de la pròpia Llibreta).
 *
 * Estructura: seccions per dia (fila amb el dia a la columna A, p. ex.
 * "DISSABTE 22 D'AGOST") i, a sota, una fila per barra amb:
 *   B = Plaça · D = Grup 1 · E = Grup 2 · G = BOLO (acte) · J = Satèl·lit ·
 *   K = Durada (horari).
 *
 * Retorna una llista de files: {dia, place, grup1, grup2, acte, satellit, durada}
 * o null si no hi ha la pestanya.
 */
function parseBarres_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetPerNom_(ss, CONFIG.BARRES_SHEET);
  if (!sheet) return null;

  var disp = sheet.getDataRange().getDisplayValues();
  var files = [];
  var diaActual = null;

  for (var r = 0; r < disp.length; r++) {
    var a = String(disp[r][0] || '').trim(); // col A: capçalera de dia
    if (a) {
      var m = a.match(/\d+/);
      if (m) diaActual = parseInt(m[0], 10);
      continue; // fila de capçalera, no és una barra
    }
    var place = String(disp[r][1] || '').trim(); // col B
    if (!place) continue;
    files.push({
      dia: diaActual,
      place: place,
      grup1: String(disp[r][3] || '').trim(),   // col D
      grup2: String(disp[r][4] || '').trim(),   // col E
      acte: String(disp[r][6] || '').trim(),    // col G (BOLO)
      satellit: String(disp[r][9] || '').trim(),// col J
      durada: String(disp[r][10] || '').trim()  // col K
    });
  }
  return files;
}

/**
 * Troba la fila de Barres 2026 d'una barra: per dia + plaça, i si la plaça es
 * repeteix el mateix dia, desempata pel BOLO (acte de CODIBA).
 * Retorna { row, estat: 'ok'|'ambigu'|'no-trobat', opcions }.
 */
function resolBarres_(barra, files) {
  var diaNum = parseInt(diaDelMes_(barra.header.data), 10);
  var n = norm_(barra.header.lloc);
  var cand = files.filter(function (f) {
    if (f.dia !== diaNum) return false;
    var p = norm_(f.place);
    return p === n || p.indexOf(n) !== -1 || n.indexOf(p) !== -1;
  });
  if (cand.length === 1) return { row: cand[0], estat: 'ok' };
  if (cand.length === 0) return { row: null, estat: 'no-trobat' };

  // Desempat per acte/BOLO.
  var a = norm_(barra.header.acte);
  var perActe = cand.filter(function (f) {
    var b = norm_(f.acte);
    return b && a && (b === a || b.indexOf(a) !== -1 || a.indexOf(b) !== -1);
  });
  if (perActe.length === 1) return { row: perActe[0], estat: 'ok' };
  return {
    row: null, estat: 'ambigu',
    opcions: cand.map(function (f) { return f.place + ' / ' + f.acte; })
  };
}

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
      responsable: String(disp[r][8] || '').trim(), // col I
      satellit: String(disp[r][9] || '').trim(),// col J
      durada: String(disp[r][10] || '').trim()  // col K
    });
  }
  return files;
}

/**
 * Compara el responsable de CODIBA amb el de Barres 2026. Tolera abreviatures
 * (un conté l'altre). Si algun és buit, no es pot comparar -> es considera OK.
 */
function mateixResponsable_(a, b) {
  a = norm_(a); b = norm_(b);
  if (!a || !b) return true;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
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

  // Desempat: tria la fila que casi amb més camps (BOLO/acte i/o responsable).
  var a = norm_(barra.header.acte);
  var rsp = norm_(barra.header.responsable);
  var scored = cand.map(function (f) {
    var s = 0;
    if (coincideixText_(a, norm_(f.acte))) s++;
    if (coincideixText_(rsp, norm_(f.responsable))) s++;
    return { f: f, s: s };
  });
  var max = Math.max.apply(null, scored.map(function (x) { return x.s; }));
  var best = scored.filter(function (x) { return x.s === max; });
  if (max > 0 && best.length === 1) return { row: best[0].f, estat: 'ok' };
  return {
    row: null, estat: 'ambigu',
    opcions: cand.map(function (f) { return f.place + ' / ' + f.acte; })
  };
}

/** Dos textos (ja normalitzats) coincideixen si són iguals o un conté l'altre. */
function coincideixText_(a, b) {
  if (!a || !b) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

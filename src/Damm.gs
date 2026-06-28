/**
 * FASE 2 — Parser del Planning DAMM.
 *
 * Estructura del planning:
 *  - Fila 1: etiquetes de dia (DV21, DS22, ... DG30) en grups de 3 columnes.
 *  - Fila 2: subcapçaleres M / T / N per cada dia.
 *  - Cada plaça ocupa un BLOC de 3 files:
 *      fila r   -> nom de la plaça (col A) + hora d'ENTREGA (a la col M del dia)
 *      fila r+1 -> quantitats M / T / N per cada dia
 *      fila r+2 -> hora de RECOLLIDA (a la col M del dia)
 *
 * Retorna:
 *   { mapa: { 'NORMPLACA|diaNum': {mostradors,tiradors,neveres,entrega,recollida} },
 *     placesNorm: [ ... ],
 *     dies: [num, ...] }
 */
function parseDamm_(urlOId) {
  var ss = obreSpreadsheet_(urlOId);
  var sheet = CONFIG.DAMM_SHEET
    ? getSheetPerNom_(ss, CONFIG.DAMM_SHEET)
    : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('No trobo la pestanya del Planning DAMM ('
      + (CONFIG.DAMM_SHEET || 'primera pestanya') + ').');
  }

  var rang = sheet.getDataRange();
  var values = rang.getValues();
  var disp = rang.getDisplayValues();
  if (!disp.length) throw new Error('El Planning DAMM sembla buit.');

  // 1) Dies: a la primera fila, cada etiqueta no buida marca la columna M del
  //    dia. El número de l'etiqueta (DJ27 -> 27) és la clau d'emparellament.
  var dies = {}; // diaNum -> colM (0-based)
  for (var c = 1; c < disp[0].length; c++) {
    var lab = String(disp[0][c] || '').trim();
    if (!lab) continue;
    var m = lab.match(/\d+/);
    if (m) dies[parseInt(m[0], 10)] = c;
  }

  // 2) Places: blocs de 3 files a partir de la fila 3 (índex 2) fins la llegenda.
  var mapa = {};
  var placesNorm = [];
  for (var r = 2; r < disp.length; r++) {
    var nomA = String(disp[r][0] || '').trim();
    if (!nomA) continue;
    if (nomA.indexOf('=') !== -1) break; // llegenda (M = Mostradors, ...)

    var pn = norm_(nomA);
    if (placesNorm.indexOf(pn) === -1) placesNorm.push(pn);

    Object.keys(dies).forEach(function (diaNum) {
      var colM = dies[diaNum];
      var most = cellNum_(values, r + 1, colM);
      var tir = cellNum_(values, r + 1, colM + 1);
      var nev = cellNum_(values, r + 1, colM + 2);
      var entrega = String((disp[r] && disp[r][colM]) || '').trim();
      var recollida = (disp[r + 2] && String(disp[r + 2][colM] || '').trim()) || '';
      if (most === null && tir === null && nev === null && !entrega && !recollida) {
        return; // res per aquest dia
      }
      mapa[pn + '|' + diaNum] = {
        mostradors: most, tiradors: tir, neveres: nev,
        entrega: entrega, recollida: recollida
      };
    });
  }

  return { mapa: mapa, placesNorm: placesNorm, dies: Object.keys(dies).map(Number) };
}

/**
 * Resol la plaça d'una barra (LLOC de CODIBA) cap a la plaça del DAMM.
 * Prioritat: equivalència explícita -> coincidència exacta -> per inclusió.
 * Retorna { place: NORMPLACA|null, estat: 'ok'|'ambigu'|'no-trobat', opcions }.
 */
function resolPlaceDamm_(lloc, placesNorm) {
  var n = norm_(lloc);
  var eq = CONFIG.DAMM_EQUIV[norm_(lloc)] || CONFIG.DAMM_EQUIV[lloc];
  if (eq) return { place: norm_(eq), estat: 'ok' };
  if (placesNorm.indexOf(n) !== -1) return { place: n, estat: 'ok' };
  var matches = placesNorm.filter(function (p) {
    return p.indexOf(n) !== -1 || n.indexOf(p) !== -1;
  });
  if (matches.length === 1) return { place: matches[0], estat: 'ok' };
  if (matches.length > 1) return { place: null, estat: 'ambigu', opcions: matches };
  return { place: null, estat: 'no-trobat' };
}

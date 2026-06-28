/**
 * FASE 2 — Parser del Planning DAMM.
 *
 * Estructura del planning:
 *  - Fila 1: etiquetes de dia (DV21, DS22, ... DG30) en grups de 3 columnes.
 *  - Fila 2: subcapçaleres M / T / N (Mostradors / Tiradors / Neveres).
 *  - Cada plaça ocupa un BLOC de 3 files:
 *      fila r   -> nom de la plaça (col A) + hora d'ENTREGA (verd, a la col M)
 *      fila r+1 -> quantitats M / T / N per cada dia
 *      fila r+2 -> hora de RECOLLIDA (vermell, a la col M)
 *
 * El material s'entrega un dia i es recull un altre, però hi és tots els dies
 * entremig. Per això es desa, per plaça: les quantitats per dia, i totes les
 * entregues i recollides amb el seu dia. Després, per a una fitxa d'un dia D:
 *  - Arribada material = l'entrega del dia <= D més proper (es manté fins que es
 *    recull).
 *  - Recollida material = la recollida del dia >= D més proper.
 *
 * Retorna { perPlaca: { NORMPLACA: {q:{dia:{mostradors,tiradors,neveres}},
 *                                   ent:{dia:hora}, rec:{dia:hora}} },
 *           placesNorm: [...], dies: [num,...] }
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

  // 1) Dies: a la primera fila, cada etiqueta marca la columna M del dia.
  var dies = {}; // diaNum -> colM (0-based)
  for (var c = 1; c < disp[0].length; c++) {
    var lab = String(disp[0][c] || '').trim();
    if (!lab) continue;
    var m = lab.match(/\d+/);
    if (m) dies[parseInt(m[0], 10)] = c;
  }

  // 2) Places: blocs de 3 files fins la llegenda.
  var perPlaca = {};
  var placesNorm = [];
  for (var r = 2; r < disp.length; r++) {
    var nomA = String(disp[r][0] || '').trim();
    if (!nomA) continue;
    if (nomA.indexOf('=') !== -1) break; // llegenda (M = Mostradors, ...)

    var pn = norm_(nomA);
    if (!perPlaca[pn]) { perPlaca[pn] = { q: {}, ent: {}, rec: {} }; placesNorm.push(pn); }
    var P = perPlaca[pn];

    Object.keys(dies).forEach(function (diaNum) {
      var colM = dies[diaNum];
      var most = cellNum_(values, r + 1, colM);
      var tir = cellNum_(values, r + 1, colM + 1);
      var nev = cellNum_(values, r + 1, colM + 2);
      var entrega = String((disp[r] && disp[r][colM]) || '').trim();
      var recollida = (disp[r + 2] && String(disp[r + 2][colM] || '').trim()) || '';
      if (most !== null || tir !== null || nev !== null) {
        P.q[diaNum] = { mostradors: most, tiradors: tir, neveres: nev };
      }
      if (entrega) P.ent[diaNum] = entrega;
      if (recollida) P.rec[diaNum] = recollida;
    });
  }

  return { perPlaca: perPlaca, placesNorm: placesNorm, dies: Object.keys(dies).map(Number) };
}

/** Entrega aplicable al dia D: la del dia <= D més proper (es manté fins recollir). */
function entregaAplicable_(P, dia) {
  if (P.ent[dia]) return P.ent[dia];
  var best = null;
  Object.keys(P.ent).forEach(function (d) {
    d = Number(d);
    if (d <= dia && (best === null || d > best)) best = d;
  });
  return best === null ? '' : P.ent[best];
}

/**
 * Resol la plaça d'una barra (LLOC de CODIBA) cap a la plaça del DAMM.
 * Prioritat: equivalència explícita -> exacta -> per inclusió. Si la inclusió
 * dóna més d'una candidata (p. ex. "PORXADA" -> GRAN/OLIVERES), desempata per
 * la que tingui dades (quantitats) per al dia concret de la barra.
 * Retorna { place: NORMPLACA|null, estat: 'ok'|'ambigu'|'no-trobat', opcions }.
 */
function resolPlaceDamm_(lloc, damm, diaNum) {
  var placesNorm = damm.placesNorm;
  var n = norm_(lloc);
  var eq = CONFIG.DAMM_EQUIV[norm_(lloc)] || CONFIG.DAMM_EQUIV[lloc];
  if (eq) return { place: norm_(eq), estat: 'ok' };
  if (placesNorm.indexOf(n) !== -1) return { place: n, estat: 'ok' };
  var matches = placesNorm.filter(function (p) {
    return p.indexOf(n) !== -1 || n.indexOf(p) !== -1;
  });
  if (matches.length === 1) return { place: matches[0], estat: 'ok' };
  if (matches.length > 1) {
    var ambDades = matches.filter(function (p) {
      var P = damm.perPlaca[p];
      return P && P.q[diaNum];
    });
    if (ambDades.length === 1) return { place: ambDades[0], estat: 'ok' };
    return { place: null, estat: 'ambigu', opcions: matches };
  }
  return { place: null, estat: 'no-trobat' };
}

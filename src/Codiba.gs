/**
 * Parser de la comanda de CODIBA.
 *
 * Estratègia robusta: NO depèn de números de fila/columna.
 *  - Localitza les files de capçalera (DATA, LLOC, ...) buscant el seu text
 *    a la columna A.
 *  - Tracta cada COLUMNA amb dades com una barra independent.
 *  - Tot el que hi ha sota l'àncora GASOS i té etiqueta a la columna A és un
 *    producte de beguda.
 *
 * Retorna { barres: [...], avisos: [...] }
 *   barra = {
 *     header: {data, dia, lloc, acte, colla, horaEntrega, responsable, telefon, gasos},
 *     productes: [{nom, qty}],
 *     colIndex
 *   }
 */
function parseCodiba_(urlOId) {
  var ss = obreSpreadsheet_(urlOId);
  var sheet = getSheetPerNom_(ss, CONFIG.CODIBA_SHEET);
  if (!sheet) {
    throw new Error('No trobo la pestanya "' + CONFIG.CODIBA_SHEET + '" dins de '
      + 'la comanda. Revisa CONFIG.CODIBA_SHEET.');
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('La comanda de CODIBA sembla buida.');

  var avisos = [];

  // 1) Localitzar la fila de cada camp de capçalera per la seva etiqueta (col A).
  var filaCamp = {};        // nomCamp -> índex de fila (0-based)
  Object.keys(CONFIG.CODIBA_CAMPS).forEach(function (camp) {
    var fila = trobaFilaPerEtiqueta_(values, CONFIG.CODIBA_CAMPS[camp]);
    if (fila === -1) {
      avisos.push('No he trobat la fila "' + CONFIG.CODIBA_CAMPS[camp]
        + '" a la comanda. Aquest camp quedarà buit a les fitxes.');
    } else {
      filaCamp[camp] = fila;
    }
  });

  // 2) Localitzar l'àncora de productes (GASOS) i la primera columna de dades.
  var filaAncora = trobaFilaPerEtiqueta_(values, CONFIG.CODIBA_ANCORA_PRODUCTES);
  if (filaAncora === -1) {
    throw new Error('No trobo la fila "' + CONFIG.CODIBA_ANCORA_PRODUCTES
      + '" que marca on comencen els productes. Revisa CONFIG.');
  }

  // Les columnes de dades són de la B en endavant (col 1+). Una columna és una
  // barra si té algun valor a les files de capçalera (data o lloc).
  var numCols = maxAmplada_(values);
  var colsBarra = [];
  for (var c = 1; c < numCols; c++) {
    var teData = filaCamp.data !== undefined && cellText_(values, filaCamp.data, c) !== '';
    var teLloc = filaCamp.lloc !== undefined && cellText_(values, filaCamp.lloc, c) !== '';
    if (teData || teLloc) colsBarra.push(c);
  }
  if (!colsBarra.length) {
    throw new Error('No he detectat cap columna de barra amb data o lloc. '
      + 'Comprova que la comanda té dades a partir de la columna B.');
  }

  // 3) Llista de productes: files amb etiqueta a col A per sota de l'àncora.
  var productesFiles = [];
  for (var r = filaAncora + 1; r < values.length; r++) {
    var nom = cellText_(values, r, 0);
    if (nom !== '') productesFiles.push({ row: r, nom: nom });
  }

  // 4) Construir una barra per columna.
  var barres = colsBarra.map(function (c) {
    var header = {};
    Object.keys(filaCamp).forEach(function (camp) {
      header[camp] = cellText_(values, filaCamp[camp], c);
    });

    var productes = [];
    productesFiles.forEach(function (p) {
      var qty = cellNum_(values, p.row, c);
      if (qty !== null && qty !== 0) productes.push({ nom: p.nom, qty: qty });
    });

    return { header: header, productes: productes, colIndex: c };
  });

  return { barres: barres, avisos: avisos };
}

/* ---- helpers locals ---- */

function trobaFilaPerEtiqueta_(values, etiqueta) {
  for (var r = 0; r < values.length; r++) {
    if (etiquetaCoincideix_(values[r][0], etiqueta)) return r;
  }
  return -1;
}

function maxAmplada_(values) {
  var m = 0;
  for (var r = 0; r < values.length; r++) m = Math.max(m, values[r].length);
  return m;
}

function cellText_(values, r, c) {
  if (r == null || r < 0 || r >= values.length) return '';
  if (c < 0 || c >= values[r].length) return '';
  var v = values[r][c];
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG_TZ_(), 'dd/MM/yyyy');
  return v === null || v === undefined ? '' : String(v).trim();
}

function cellNum_(values, r, c) {
  if (r < 0 || r >= values.length || c < 0 || c >= values[r].length) return null;
  var v = values[r][c];
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function CONFIG_TZ_() {
  return Session.getScriptTimeZone() || 'Europe/Madrid';
}

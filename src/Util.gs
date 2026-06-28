/**
 * Utilitats compartides: normalització de text i cerca per etiquetes.
 */

/** Normalitza text per comparar: majúscules, sense accents, espais col·lapsats. */
function norm_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // treu accents
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Versió "agressiva" per emparellar noms de producte: a més del de dalt,
 * treu mides/volums i signes de puntuació, perquè "WHISKY JB 1L" i "WHISKY JB"
 * acabin igual.
 */
function normProducte_(s) {
  return norm_(s)
    .replace(/\b\d+([.,]\d+)?\s?(L|CL|ML|KG|G)\b/g, '') // 1L, 0,7L, 33CL, 10KG...
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comprova si el text d'una cel·la coincideix amb una etiqueta (amb sinònims |). */
function etiquetaCoincideix_(valorCel, etiqueta) {
  const v = norm_(valorCel);
  return String(etiqueta).split('|').some(function (alt) {
    return v === norm_(alt);
  });
}

/**
 * Busca dins una matriu 2D la PRIMERA cel·la el valor de la qual coincideix amb
 * l'etiqueta. Retorna {row, col} (0-based) o null.
 */
function trobaEtiqueta_(values, etiqueta) {
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (etiquetaCoincideix_(values[r][c], etiqueta)) return { row: r, col: c };
    }
  }
  return null;
}

/** Obre un spreadsheet a partir d'un link o ID. Llança error clar si falla. */
function obreSpreadsheet_(urlOId) {
  if (!urlOId) throw new Error('No s\'ha proporcionat cap link de comanda.');
  try {
    if (/^https?:\/\//.test(urlOId)) return SpreadsheetApp.openByUrl(urlOId);
    return SpreadsheetApp.openById(urlOId);
  } catch (e) {
    throw new Error('No he pogut obrir el document. Comprova que el link és '
      + 'correcte i que hi tens accés:\n' + urlOId);
  }
}

/** Converteix un índex de columna 0-based a lletra (0->A, 26->AA). */
function colLletra_(i) {
  var s = '';
  i = i + 1;
  while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/** Retorna la pestanya pel nom, provant variants normalitzades. */
function getSheetPerNom_(ss, nom) {
  var exacte = ss.getSheetByName(nom);
  if (exacte) return exacte;
  var objectiu = norm_(nom);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (norm_(sheets[i].getName()) === objectiu) return sheets[i];
  }
  return null;
}

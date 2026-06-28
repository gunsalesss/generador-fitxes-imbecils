/* ============================================================
 * Generador de fitxes d'imbècils — fitxer únic (build)
 * Generat automàticament a partir de src/. Enganxa'l sencer
 * dins de Code.gs a l'editor d'Apps Script de la Llibreta.
 * ============================================================ */


// ===== Config.gs =====
/**
 * ============================================================================
 *  CONFIGURACIÓ — Generador de fitxes d'imbècils
 * ============================================================================
 *  Aquest és l'ÚNIC fitxer que normalment caldrà tocar si canvia el format
 *  dels documents. No cal saber programar: només editar text entre cometes.
 *
 *  El parseig NO depèn de números de fila ni de lletres de columna: busca les
 *  coses pel TEXT de les etiquetes. Per això pots afegir/treure/reordenar
 *  places (columnes) i productes (files) sense tocar res.
 * ============================================================================
 */

const CONFIG = {

  // --- Document d'ORIGEN: la comanda de CODIBA -----------------------------
  // Enganxa aquí el link de la comanda. També es pot deixar buit i el botó
  // demanarà el link cada vegada.
  CODIBA_URL: '',

  // Nom de la pestanya dins de CODIBA que conté la comanda principal.
  CODIBA_SHEET: 'COMANDA CODIBA',

  // --- Document de DESTÍ: la Llibreta d'imbècils ---------------------------
  // Per defecte s'escriu a la MATEIXA Llibreta on viu aquest script.
  // El nom de la pestanya plantilla que es clona per cada barra:
  PLANTILLA_SHEET: 'Plantilla Barra',

  // Pestanyes que NO s'han de tocar mai (no són fitxes de barra).
  PESTANYES_PROTEGIDES: [
    'Plantilla Barra', 'Material', 'Barres 2026', 'Material Damm 2026',
    'Planning CST 2026', 'Mapa gasos 2026', 'Mapa BARRA MÒBIL 2026'
  ],

  // --- Etiquetes de les files de capçalera dins de CODIBA (columna A) -------
  // El parser busca aquests textos a la columna A (sense distingir accents ni
  // majúscules). Pots posar diversos sinònims separant-los amb |.
  CODIBA_CAMPS: {
    data:         'DATA',
    dia:          'DIA',
    lloc:         'LLOC',
    acte:         'ACTE',
    colla:        'COLLA',
    horaEntrega:  'HORA ENTREGA|HORA D\'ENTREGA',
    responsable:  'RESPONSABLE',
    telefon:      'TELEFON|TELÈFON',
    gasos:        'GASOS'
  },

  // Els PRODUCTES són totes les files amb etiqueta a la columna A que estiguin
  // PER SOTA d'aquesta fila ancla. Tot el que hi hagi sota "GASOS" es tracta
  // com a producte de beguda.
  CODIBA_ANCORA_PRODUCTES: 'GASOS',

  // --- Mapeig de noms de producte CODIBA -> fila de la Llibreta ------------
  // Només cal afegir aquí els casos on el nom NO coincideix prou. La resta es
  // resol automàticament normalitzant el text (treu accents, mides, etc.).
  // Format:  'NOM A CODIBA': 'NOM A LA LLIBRETA'
  SINONIMS_PRODUCTES: {
    'PACK 6 COCA COLA 2L ZERO': 'PACK 6 COCA COLA 2L',
    'PACK 6 FANTA LLIMONA 2L':  'PACK 6 FANTA LLIMONA 2L',
    'PACK 12 TONICA SCHWEPPES 1L': 'PACK 12 TONICA SCHWEPPES 1L',
    'WHISKY JB 1L':    'WHISKY JB',
    'WHISKY JAMESON 0,7L': 'WHISCKY JAMESON',
    'VODKA ERISTOFF 0,7L': 'VODKA ERISTOFF',
    'VODKA ABSOLUT 0,7L':  'VODKA ABSOLUT',
    'RON NEGRITA 1L':  'RON NEGRITA',
    'RON CACIQUE 0,7L':'RON CACIQUE',
    'GIN GIRÓ 1L':     'GIN GIRÓ',
    'GIN SEAGRAMS 0,7L':'GIN SEAGRAMS',
    'CAIXA 6 CAVA BRUT': 'CAIXA 6 CAVA BRUT',
    'PACK 12 SUCS TARONJA 1L': 'PACK 12 SUCS TARONJA 1L',
    'PACK 24 LLAUNA DAURA 33CL': 'PACK 24 DAURA',
    'PACK 24 LLAUNA FREEDAMM TORRADA 33CL': 'PACK 24 FREE DAMM TORRADA'
  },

  // --- On va cada camp dins de la PLANTILLA --------------------------------
  // Les taules de Beguda i Material es localitzen SOLES buscant les seves
  // capçaleres ('Beguda', 'Material') dins la plantilla, així que si les mous
  // segueix funcionant. Els camps solts d'aquí baix es localitzen buscant la
  // seva etiqueta i escrivint a la cel·la indicada al costat.
  //
  // capLlibreta -> { etiqueta: text a buscar, offsetCol: cap a on escriure }
  // offsetCol = 1 vol dir "escriu a la cel·la de la dreta de l'etiqueta".
  PLANTILLA_CAMPS: {
    acte:        { etiqueta: 'Bolo',          offsetCol: 1 },
    lloc:        { etiqueta: 'Ubicació',      offsetCol: 1 },
    dia:         { etiqueta: 'Dia',           offsetCol: 1 },
    horaEntrega: { etiqueta: 'Arribada beguda', offsetCol: 1 },
    responsable: { etiqueta: 'Resp. Imbecils', offsetCol: 1 },
    telefon:     { etiqueta: 'Resp. Imbecils', offsetCol: 2 }
  },

  // Capçaleres de les taules dins la plantilla (per localitzar-les soles).
  PLANTILLA_TAULA_BEGUDA:  'Beguda',   // capçalera de la columna de noms
  PLANTILLA_TAULA_MATERIAL:'Material', // capçalera de la taula de material
  PLANTILLA_COL_DEMANAT:   'Demanat',  // nom de la columna a omplir
  PLANTILLA_FILA_GASOS:    'Gasos',    // dins la taula Material

  // --- Comportament --------------------------------------------------------
  // Si una fitxa ja existeix, què fem? 'replace' = la regenera de zero.
  // 'skip' = la deixa intacta.  (De moment només 'replace'.)
  SI_JA_EXISTEIX: 'replace'
};

// ===== Util.gs =====
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

// ===== Codiba.gs =====
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

  return { barres: barres, avisos: avisos, origenId: ss.getId() };
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

// ===== Llibreta.gs =====
/**
 * Generador de fitxes de la Llibreta a partir de les barres parsejades.
 *
 * Per cada barra:
 *  1) Clona la pestanya plantilla.
 *  2) Omple els camps solts (acte, lloc, dia, responsable...) per etiqueta.
 *  3) Omple la taula Beguda (columna "Demanat") emparellant productes per nom.
 *  4) Omple el Gasos a la taula Material.
 *
 * NO toca format, colors, checkboxes ni la columna "Arribat" (es deixa per
 * omplir a mà). Retorna un informe amb el detall del que ha passat.
 */
function generaLlibreta_(barres) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var plantilla = getSheetPerNom_(ss, CONFIG.PLANTILLA_SHEET);
  if (!plantilla) {
    throw new Error('No trobo la pestanya plantilla "' + CONFIG.PLANTILLA_SHEET
      + '" en aquest document. Revisa CONFIG.PLANTILLA_SHEET.');
  }

  var informe = { creades: [], productesNoMapejats: {}, avisos: [] };
  var nomsUsats = {};

  barres.forEach(function (barra) {
    var nom = nomFitxa_(barra, nomsUsats);

    // Substituir si ja existeix.
    var existent = ss.getSheetByName(nom);
    if (existent) {
      if (esProtegida_(nom)) {
        informe.avisos.push('Salto "' + nom + '": és una pestanya protegida.');
        return;
      }
      ss.deleteSheet(existent);
    }

    var full = plantilla.copyTo(ss);
    full.setName(nom);
    full.showSheet();
    ss.setActiveSheet(full);
    ss.moveActiveSheet(ss.getNumSheets());

    omplePlantilla_(full, barra, informe);
    informe.creades.push(nom);
  });

  return informe;
}

/** Construeix un nom de pestanya únic per la fitxa. */
function nomFitxa_(barra, nomsUsats) {
  var base = (barra.header.lloc || barra.header.acte || 'BARRA').trim();
  if (barra.header.data) base += ' ' + barra.header.data;
  base = base.substring(0, 90); // límit de Sheets
  var nom = base, i = 2;
  while (nomsUsats[nom]) { nom = base + ' (' + i + ')'; i++; }
  nomsUsats[nom] = true;
  return nom;
}

function esProtegida_(nom) {
  return CONFIG.PESTANYES_PROTEGIDES.some(function (p) {
    return norm_(p) === norm_(nom);
  });
}

/** Omple una fitxa ja clonada amb les dades d'una barra. */
function omplePlantilla_(full, barra, informe) {
  var values = full.getDataRange().getValues();

  // --- 1) Camps solts (per etiqueta + offset) ---
  Object.keys(CONFIG.PLANTILLA_CAMPS).forEach(function (camp) {
    var spec = CONFIG.PLANTILLA_CAMPS[camp];
    var val = barra.header[camp];
    if (val === undefined || val === '') return;
    var pos = trobaEtiqueta_(values, spec.etiqueta);
    if (!pos) {
      informe.avisos.push('Fitxa "' + full.getName() + '": no trobo l\'etiqueta "'
        + spec.etiqueta + '" a la plantilla (camp ' + camp + ').');
      return;
    }
    full.getRange(pos.row + 1, pos.col + 1 + spec.offsetCol).setValue(val);
  });

  // --- 2) Taula Beguda: omplir columna Demanat ---
  ompleTaulaBeguda_(full, values, barra, informe);

  // --- 3) Gasos a la taula Material ---
  ompleGasos_(full, values, barra, informe);
}

/**
 * Localitza la taula Beguda: capçalera "Beguda" (columna de noms) i, a la
 * mateixa fila, la columna "Demanat". Després emparella cada producte de la
 * barra amb la fila corresponent i escriu la quantitat.
 */
function ompleTaulaBeguda_(full, values, barra, informe) {
  var capBeguda = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_BEGUDA);
  if (!capBeguda) {
    informe.avisos.push('Fitxa "' + full.getName() + '": no trobo la taula "'
      + CONFIG.PLANTILLA_TAULA_BEGUDA + '".');
    return;
  }
  var colNoms = capBeguda.col;
  var colDemanat = trobaColumnaEnFila_(values, capBeguda.row, CONFIG.PLANTILLA_COL_DEMANAT);
  if (colDemanat === -1) {
    informe.avisos.push('Fitxa "' + full.getName() + '": no trobo la columna "'
      + CONFIG.PLANTILLA_COL_DEMANAT + '" a la taula Beguda.');
    return;
  }

  // Index de files de producte de la plantilla per nom normalitzat.
  var filesPlantilla = {}; // normProducte -> rowIndex
  for (var r = capBeguda.row + 1; r < values.length; r++) {
    var nom = cellText_(values, r, colNoms);
    if (nom === '') continue;
    filesPlantilla[normProducte_(nom)] = r;
  }

  barra.productes.forEach(function (p) {
    var key = clauProducte_(p.nom);
    var row = filesPlantilla[key];
    if (row === undefined) {
      // Intent extra: coincidència per inclusió (un conté l'altre).
      row = trobaPerInclusio_(filesPlantilla, key);
    }
    if (row === undefined) {
      informe.productesNoMapejats[p.nom] = (informe.productesNoMapejats[p.nom] || 0) + 1;
      return;
    }
    full.getRange(row + 1, colDemanat + 1).setValue(p.qty);
  });
}

/** Aplica el sinònim configurat (si n'hi ha) i normalitza el nom del producte. */
function clauProducte_(nom) {
  var sinonim = CONFIG.SINONIMS_PRODUCTES[norm_(nom)]
    || CONFIG.SINONIMS_PRODUCTES[nom];
  return normProducte_(sinonim || nom);
}

function trobaPerInclusio_(filesPlantilla, key) {
  var keys = Object.keys(filesPlantilla);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf(key) !== -1 || key.indexOf(keys[i]) !== -1) {
      return filesPlantilla[keys[i]];
    }
  }
  return undefined;
}

/** Escriu el valor de gasos a la cel·la Demanat de la columna Gasos (taula Material). */
function ompleGasos_(full, values, barra, informe) {
  if (barra.header.gasos === undefined || barra.header.gasos === '') return;
  var capMaterial = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_MATERIAL);
  if (!capMaterial) return; // sense taula material, ho ignorem silenciosament

  var colGasos = trobaColumnaEnFila_(values, capMaterial.row, CONFIG.PLANTILLA_FILA_GASOS);
  if (colGasos === -1) return;

  // La fila "Demanat" dins la taula material (per sota de la capçalera).
  var filaDemanat = -1;
  for (var r = capMaterial.row + 1; r < values.length; r++) {
    if (etiquetaCoincideix_(values[r][capMaterial.col], CONFIG.PLANTILLA_COL_DEMANAT)) {
      filaDemanat = r; break;
    }
  }
  if (filaDemanat === -1) return;
  full.getRange(filaDemanat + 1, colGasos + 1).setValue(barra.header.gasos);
}

/** Busca a la fila `row` la columna la capçalera de la qual coincideix amb `etiqueta`. */
function trobaColumnaEnFila_(values, row, etiqueta) {
  if (row < 0 || row >= values.length) return -1;
  for (var c = 0; c < values[row].length; c++) {
    if (etiquetaCoincideix_(values[row][c], etiqueta)) return c;
  }
  return -1;
}

// ===== Damm.gs =====
/**
 * FASE 2 (pendent) — Integració del Planning DAMM.
 *
 * Objectiu: donat el link del Planning DAMM, omplir a cada fitxa la taula
 * Material (Mostradors / Tiradors / Neveres) i les hores d'entrega/recollida.
 *
 * El Planning DAMM té una estructura diferent (places a les files, dies a les
 * columnes, amb subcolumnes per material i cel·les de color per hores). Per
 * implementar-ho bé necessito un export real d'aquesta pestanya.
 *
 * Quan estigui llest, aquesta funció rebrà l'objecte `barres` ja parsejat de
 * CODIBA i hi afegirà el material de DAMM emparellant per (lloc + dia).
 */
function parseDamm_(urlOId) {
  throw new Error('La integració amb el Planning DAMM encara no està '
    + 'implementada (Fase 2).');
}

/**
 * Esquema previst del retorn, per quan s'implementi:
 *   { 'LLOC|DIA': { mostradors, tiradors, neveres, horaEntrega, horaRecollida } }
 */

// ===== Menu.gs =====
/**
 * Punt d'entrada i menú dins de Google Sheets.
 *
 * En obrir la Llibreta apareix un menú "🍺 Imbècils" amb el botó per generar
 * les fitxes a partir de la comanda de CODIBA.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍺 Imbècils')
    .addItem('Generar fitxes des de CODIBA', 'generarFitxes')
    .addSeparator()
    .addItem('Ajuda', 'mostraAjuda')
    .addToUi();
}

/** Botó principal: demana el link (si cal), parseja, genera i informa. */
function generarFitxes() {
  var ui = SpreadsheetApp.getUi();

  // 1) Obtenir el link de la comanda.
  var url = CONFIG.CODIBA_URL;
  if (!url) {
    var resp = ui.prompt('Comanda CODIBA',
      'Enganxa el link de la comanda de CODIBA:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    url = resp.getResponseText().trim();
  }
  if (!url) { ui.alert('No has posat cap link. Cancel·lat.'); return; }

  try {
    // 2) Parsejar.
    var parsed = parseCodiba_(url);
    if (!parsed.barres.length) {
      ui.alert('No he detectat cap barra a la comanda. Revisa el document.');
      return;
    }

    // Seguretat: no escriure MAI dins de la pròpia comanda de CODIBA.
    if (parsed.origenId === SpreadsheetApp.getActiveSpreadsheet().getId()) {
      ui.alert('Atenció',
        'Aquest document és la pròpia comanda de CODIBA. L\'script ha d\'estar '
        + 'instal·lat dins de la Llibreta d\'imbècils, no dins de la comanda.\n\n'
        + 'No s\'ha tocat res.', ui.ButtonSet.OK);
      return;
    }

    // 3) Confirmar abans d'escriure (és destructiu: regenera fitxes existents).
    var ok = ui.alert('Generar fitxes',
      'He detectat ' + parsed.barres.length + ' barres a la comanda.\n\n'
      + 'Es crearan/regeneraran les seves fitxes en aquest document. '
      + 'Les pestanyes protegides no es toquen.\n\nVols continuar?',
      ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;

    // 4) Generar.
    var informe = generaLlibreta_(parsed.barres);

    // 5) Informe final (parseig + generació).
    mostraInforme_(ui, parsed, informe);

  } catch (e) {
    ui.alert('Error', String(e.message || e), ui.ButtonSet.OK);
    throw e; // queda registrat als logs d'Apps Script
  }
}

/** Mostra un resum clar del que ha passat, inclosos els avisos. */
function mostraInforme_(ui, parsed, informe) {
  var linies = [];
  linies.push('✅ Fitxes generades: ' + informe.creades.length);
  if (informe.creades.length) {
    linies.push('   ' + informe.creades.join(', '));
  }

  var noMap = Object.keys(informe.productesNoMapejats);
  if (noMap.length) {
    linies.push('');
    linies.push('⚠️ Productes NO mapejats (' + noMap.length + '):');
    noMap.forEach(function (n) { linies.push('   • ' + n); });
    linies.push('');
    linies.push('→ Afegeix-los a CONFIG.SINONIMS_PRODUCTES indicant a quina '
      + 'fila de la Llibreta corresponen, i torna a generar.');
  }

  var avisos = (parsed.avisos || []).concat(informe.avisos || []);
  if (avisos.length) {
    linies.push('');
    linies.push('ℹ️ Avisos:');
    avisos.forEach(function (a) { linies.push('   • ' + a); });
  }

  if (!noMap.length && !avisos.length) {
    linies.push('');
    linies.push('Tot correcte, sense incidències. 🎉');
  }

  ui.alert('Resultat', linies.join('\n'), ui.ButtonSet.OK);
}

function mostraAjuda() {
  SpreadsheetApp.getUi().alert('Generador de fitxes d\'imbècils',
    '1. Clica "Generar fitxes des de CODIBA".\n'
    + '2. Enganxa el link de la comanda de CODIBA.\n'
    + '3. Confirma. Es crearà una fitxa per barra clonant la plantilla.\n\n'
    + 'Què NO toca: format, checkboxes ni la columna "Arribat" (per omplir a mà).\n\n'
    + 'Si algun producte surt com a "no mapejat", afegeix-lo a la configuració '
    + '(fitxer Config) i torna a generar.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

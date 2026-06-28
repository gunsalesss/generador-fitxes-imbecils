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

  // --- 1b) Buidar cel·les amb dades d'exemple de la plantilla ---
  (CONFIG.PLANTILLA_BUIDAR || []).forEach(function (spec) {
    var pos = trobaEtiqueta_(values, spec.etiqueta);
    if (!pos) return;
    full.getRange(pos.row + 1, pos.col + 1 + spec.offsetCol).clearContent();
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

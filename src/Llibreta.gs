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
function generaLlibreta_(barres, damm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var plantilla = getSheetPerNom_(ss, CONFIG.PLANTILLA_SHEET);
  if (!plantilla) {
    throw new Error('No trobo la pestanya plantilla "' + CONFIG.PLANTILLA_SHEET
      + '" en aquest document. Revisa CONFIG.PLANTILLA_SHEET.');
  }

  var informe = { creades: [], productesAfegits: {}, avisos: [] };
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

    omplePlantilla_(full, barra, informe, damm);
    informe.creades.push(nom);
  });

  return informe;
}

/**
 * Construeix un nom de pestanya únic amb el format:
 *   <dia_setmana> <dia_mes> <plaça>   ->  "Dijous 27 BARANGÉ"
 */
function nomFitxa_(barra, nomsUsats) {
  var parts = [
    capitalitza_(barra.header.dia),     // Dijous
    diaDelMes_(barra.header.data),       // 27
    (barra.header.lloc || '').trim()     // BARANGÉ
  ].filter(function (x) { return x; });
  var base = parts.join(' ').trim() || (barra.header.acte || 'BARRA');
  base = base.substring(0, 90); // límit de Sheets
  var nom = base, i = 2;
  while (nomsUsats[nom]) { nom = base + ' (' + i + ')'; i++; }
  nomsUsats[nom] = true;
  return nom;
}

/** "DISSABTE" -> "Dissabte". */
function capitalitza_(s) {
  s = (s || '').trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Extreu el dia del mes d'una data "27/08/2025" -> "27". */
function diaDelMes_(data) {
  var m = String(data || '').match(/\d+/);
  return m ? String(parseInt(m[0], 10)) : '';
}

function esProtegida_(nom) {
  return CONFIG.PESTANYES_PROTEGIDES.some(function (p) {
    return norm_(p) === norm_(nom);
  });
}

/** Omple una fitxa ja clonada amb les dades d'una barra. */
function omplePlantilla_(full, barra, informe, damm) {
  var values = full.getDataRange().getValues();

  // --- 1) Buidar cel·les amb dades d'exemple ABANS d'omplir, perquè el que no
  //        tingui dada quedi en blanc (no s'arrossega l'exemple de la plantilla).
  (CONFIG.PLANTILLA_BUIDAR || []).forEach(function (spec) {
    var pos = trobaEtiqueta_(values, spec.etiqueta);
    if (!pos) return;
    full.getRange(pos.row + 1, pos.col + 1 + spec.offsetCol).clearContent();
  });

  // --- 2) Camps solts (per etiqueta + offset) ---
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

  // --- 3) Taula Beguda: omplir columna Demanat ---
  ompleTaulaBeguda_(full, values, barra, informe);

  // --- 3) Gasos a la taula Material ---
  ompleGasos_(full, values, barra, informe);

  // --- 3b) Columnes de Material que vénen de DAMM: buidar de moment ---
  buidaColumnesMaterial_(full, values);

  // --- 4) Gel a la taula Material (columna "Gel (h)", fila Demanat) ---
  ompleGel_(full, values, barra);

  // --- 5) Material DAMM (mostradors/tiradors/neveres + hores) ---
  if (damm) ompleDamm_(full, values, barra, damm, informe);
}

/**
 * Omple, des del Planning DAMM, les columnes M/T/N de la taula Material i les
 * hores d'Arribada/Recollida material, emparellant per plaça + dia.
 */
function ompleDamm_(full, values, barra, damm, informe) {
  var diaNum = parseInt(diaDelMes_(barra.header.data), 10);
  var res = resolPlaceDamm_(barra.header.lloc, damm.placesNorm);
  if (res.estat !== 'ok') {
    var detall = res.estat === 'ambigu'
      ? 'coincideix amb ' + res.opcions.join(' / ') + ' (afegeix-la a DAMM_EQUIV)'
      : 'no s\'ha trobat al DAMM';
    informe.avisos.push('DAMM: la plaça "' + barra.header.lloc + '" ' + detall + '.');
    return;
  }

  var dades = damm.mapa[res.place + '|' + diaNum] || {};

  // Quantitats M/T/N a la fila Demanat de la taula Material.
  var capMaterial = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_MATERIAL);
  if (capMaterial) {
    var filaDemanat = filaDemanatMaterial_(values, capMaterial);
    if (filaDemanat !== -1) {
      var clau = { M: 'mostradors', T: 'tiradors', N: 'neveres' };
      Object.keys(CONFIG.DAMM_MATERIAL).forEach(function (mtn) {
        var header = CONFIG.DAMM_MATERIAL[mtn];
        var c = trobaColumnaEnFila_(values, capMaterial.row, header);
        if (c === -1) return;
        var val = dades[clau[mtn]];
        var cel = full.getRange(filaDemanat + 1, c + 1);
        if (val === null || val === undefined) cel.clearContent();
        else cel.setValue(val);
      });
    }
  }

  // Hores a Arribada / Recollida material (esquerra de la fitxa).
  escriuOBuida_(full, values, CONFIG.PLANTILLA_ARRIBADA_MATERIAL, dades.entrega);
  escriuOBuida_(full, values, CONFIG.PLANTILLA_RECOLLIDA_MATERIAL, dades.recollida);
}

/** Escriu un valor a la dreta d'una etiqueta, o la buida si no n'hi ha. */
function escriuOBuida_(full, values, etiqueta, valor) {
  var pos = trobaEtiqueta_(values, etiqueta);
  if (!pos) return;
  var cel = full.getRange(pos.row + 1, pos.col + 2);
  if (valor) cel.setValue(valor);
  else cel.clearContent();
}

/** Localitza la fila "Demanat" dins la taula Material. -1 si no hi és. */
function filaDemanatMaterial_(values, capMaterial) {
  for (var r = capMaterial.row + 1; r < values.length; r++) {
    if (etiquetaCoincideix_(values[r][capMaterial.col], CONFIG.PLANTILLA_COL_DEMANAT)) {
      return r;
    }
  }
  return -1;
}

/** Buida les columnes de Material que de moment no omplim (vénen de DAMM). */
function buidaColumnesMaterial_(full, values) {
  var cols = CONFIG.MATERIAL_DEMANAT_BUIDAR || [];
  if (!cols.length) return;
  var capMaterial = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_MATERIAL);
  if (!capMaterial) return;
  var filaDemanat = filaDemanatMaterial_(values, capMaterial);
  if (filaDemanat === -1) return;
  cols.forEach(function (h) {
    var c = trobaColumnaEnFila_(values, capMaterial.row, h);
    if (c !== -1) full.getRange(filaDemanat + 1, c + 1).clearContent();
  });
}

/** Un producte és "gel" si el seu nom conté el text configurat. */
function esGel_(nom) {
  if (!CONFIG.PLANTILLA_FILA_GEL) return false;
  var t = norm_(CONFIG.PRODUCTE_GEL_CONTE || '');
  return t !== '' && norm_(nom).indexOf(t) !== -1;
}

/**
 * Escriu el gel a la cel·la Demanat de la columna "Gel (h)" com a
 * "quantitat (hora gel)". Suma les quantitats de tots els productes de gel.
 * Si no n'hi ha, buida la cel·la (treu l'exemple de la plantilla).
 */
function ompleGel_(full, values, barra) {
  if (!CONFIG.PLANTILLA_FILA_GEL) return;
  var capMaterial = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_MATERIAL);
  if (!capMaterial) return;
  var colGel = trobaColumnaEnFila_(values, capMaterial.row, CONFIG.PLANTILLA_FILA_GEL);
  if (colGel === -1) return;
  var filaDemanat = filaDemanatMaterial_(values, capMaterial);
  if (filaDemanat === -1) return;

  var cel = full.getRange(filaDemanat + 1, colGel + 1);
  var gels = barra.productes.filter(function (p) { return esGel_(p.nom); });
  if (!gels.length) { cel.clearContent(); return; }
  var qty = gels.reduce(function (s, p) { return s + (Number(p.qty) || 0); }, 0);
  var hora = barra.header.horaGel;
  cel.setValue(hora ? (qty + ' (' + hora + ')') : qty);
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
  // De pas, BUIDEM la cel·la Demanat de cada fila: així, si un producte no
  // ve a la comanda (o no es mapeja), surt en blanc i no s'arrossega la
  // quantitat d'exemple de la plantilla.
  var filesPlantilla = {}; // normProducte -> rowIndex
  var ultimaFila = capBeguda.row;
  for (var r = capBeguda.row + 1; r < values.length; r++) {
    var nom = cellText_(values, r, colNoms);
    if (nom === '') continue;
    filesPlantilla[normProducte_(nom)] = r;
    ultimaFila = r;
    full.getRange(r + 1, colDemanat + 1).clearContent();
  }

  // Files extra (sota la taula) per a begudes de la comanda que no són a la
  // plantilla: s'hi afegeixen perquè no es perdi cap quantitat, copiant el
  // format de l'última fila de la taula.
  var filaExtra = ultimaFila + 1;
  // Amplada de la taula = des de la columna de noms fins a l'última capçalera
  // amb text (Beguda...Observacions), per copiar-ne l'estil sencer.
  var dretaTaula = colNoms;
  for (var hc = colNoms; hc < values[capBeguda.row].length; hc++) {
    if (cellText_(values, capBeguda.row, hc) !== '') dretaTaula = hc;
  }
  var ampladaTaula = dretaTaula - colNoms + 1;

  barra.productes.forEach(function (p) {
    if (esGel_(p.nom)) return; // el gel va a la taula Material, no aquí
    var key = clauProducte_(p.nom);
    var row = filesPlantilla[key];
    if (row === undefined) {
      // Intent extra: coincidència per inclusió (un conté l'altre).
      row = trobaPerInclusio_(filesPlantilla, key);
    }
    if (row === undefined) {
      // No és a la plantilla: l'afegim al final, amb el format de l'última fila.
      if (ultimaFila > capBeguda.row) {
        full.getRange(ultimaFila + 1, colNoms + 1, 1, ampladaTaula)
          .copyTo(full.getRange(filaExtra + 1, colNoms + 1, 1, ampladaTaula),
                  { formatOnly: true });
      }
      full.getRange(filaExtra + 1, colNoms + 1).setValue(p.nom);
      full.getRange(filaExtra + 1, colDemanat + 1).setValue(p.qty);
      filaExtra++;
      informe.productesAfegits[p.nom] = true;
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

/**
 * Escriu el gasos a la cel·la Demanat de la columna Gasos (taula Material).
 * Si la barra no en porta, BUIDA la cel·la (no deixa l'exemple de la plantilla).
 */
function ompleGasos_(full, values, barra, informe) {
  var capMaterial = trobaEtiqueta_(values, CONFIG.PLANTILLA_TAULA_MATERIAL);
  if (!capMaterial) return; // sense taula material, ho ignorem silenciosament

  var colGasos = trobaColumnaEnFila_(values, capMaterial.row, CONFIG.PLANTILLA_FILA_GASOS);
  if (colGasos === -1) return;

  var filaDemanat = filaDemanatMaterial_(values, capMaterial);
  if (filaDemanat === -1) return;

  var cel = full.getRange(filaDemanat + 1, colGasos + 1);
  if (barra.header.gasos === undefined || barra.header.gasos === '') {
    cel.clearContent();
  } else {
    cel.setValue(barra.header.gasos);
  }
}

/** Busca a la fila `row` la columna la capçalera de la qual coincideix amb `etiqueta`. */
function trobaColumnaEnFila_(values, row, etiqueta) {
  if (row < 0 || row >= values.length) return -1;
  for (var c = 0; c < values[row].length; c++) {
    if (etiquetaCoincideix_(values[row][c], etiqueta)) return c;
  }
  return -1;
}

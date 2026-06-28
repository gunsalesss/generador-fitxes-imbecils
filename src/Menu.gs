/**
 * Punt d'entrada i menú dins de Google Sheets.
 *
 * En obrir la Llibreta apareix un menú "🍺 Imbècils". En clicar el botó
 * principal s'obre un diàleg on l'usuari tria quines colles vol generar.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍺 Imbècils')
    .addItem('Generar fitxes', 'generarFitxes')
    .addSeparator()
    .addItem('🔧 Diagnòstic DAMM match (temporal)', 'diagnosticDammMatch')
    .addItem('Ajuda', 'mostraAjuda')
    .addToUi();
}

var PROP_CODIBA_URL_ = 'CODIBA_URL';
var PROP_DAMM_URL_ = 'DAMM_URL';

/** Obté el link de la comanda (del Config o demanant-lo). '' si es cancel·la. */
function obtenirUrlCodiba_(ui) {
  var url = linkRecordat();
  if (!url) {
    var resp = ui.prompt('Comanda CODIBA',
      'Enganxa el link de la comanda de CODIBA:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return '';
    url = resp.getResponseText().trim();
  }
  return url || '';
}

/** Botó principal: obre el diàleg (link + selecció de colles). */
function generarFitxes() {
  var html = HtmlService.createHtmlOutputFromFile('Dialog')
    .setWidth(380).setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, 'Generar fitxes');
}

/** Últim link de comanda usat en aquest document (o el del Config, o buit). */
function linkRecordat() {
  var p = PropertiesService.getDocumentProperties().getProperty(PROP_CODIBA_URL_);
  return p || CONFIG.CODIBA_URL || '';
}

/** Últim link del Planning DAMM usat en aquest document. */
function linkDammRecordat() {
  return PropertiesService.getDocumentProperties().getProperty(PROP_DAMM_URL_) || '';
}

/**
 * Cridada des del diàleg: valida el link, el recorda i retorna les colles
 * disponibles amb les marcades per defecte.
 */
function carregaColles(url) {
  url = (url || '').trim();
  if (!url) throw new Error('Cal enganxar el link de la comanda.');
  var colles = getCollesDisponibles_(url);
  if (!colles.length) throw new Error('No he trobat cap colla a la fila COLLA.');
  PropertiesService.getDocumentProperties().setProperty(PROP_CODIBA_URL_, url);

  var perDefecte = (CONFIG.COLLES_INCLOSES || []).map(norm_);
  return colles.map(function (c) {
    return { nom: c, checked: perDefecte.indexOf(norm_(c)) !== -1 };
  });
}

/**
 * Cridada des del diàleg (google.script.run). Parseja amb les colles triades,
 * genera les fitxes i retorna el text de l'informe per mostrar al diàleg.
 */
function executaGeneracio(url, dammUrl, collesSeleccionades) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty(PROP_CODIBA_URL_, (url || '').trim());
  var parsed = parseCodiba_(url, collesSeleccionades);

  // Seguretat: no escriure MAI dins de la pròpia comanda de CODIBA.
  if (parsed.origenId === SpreadsheetApp.getActiveSpreadsheet().getId()) {
    throw new Error('Aquest document és la pròpia comanda de CODIBA. L\'script '
      + 'ha d\'estar dins de la Llibreta, no de la comanda. No s\'ha tocat res.');
  }
  if (!parsed.barres.length) {
    return 'No hi ha cap barra per a les colles triades. No s\'ha generat res.';
  }

  // Planning DAMM (opcional).
  var damm = null;
  dammUrl = (dammUrl || '').trim();
  if (dammUrl) {
    props.setProperty(PROP_DAMM_URL_, dammUrl);
    damm = parseDamm_(dammUrl);
  }

  var informe = generaLlibreta_(parsed.barres, damm);
  return textInforme_(parsed, informe);
}

/** Construeix el text de l'informe (parseig + generació). */
function textInforme_(parsed, informe) {
  var linies = [];
  linies.push('✅ Fitxes generades: ' + informe.creades.length);
  if (informe.creades.length) linies.push('   ' + informe.creades.join(', '));

  var afegits = Object.keys(informe.productesAfegits);
  if (afegits.length) {
    linies.push('');
    linies.push('➕ Begudes afegides (no eren a la plantilla) (' + afegits.length + '):');
    afegits.forEach(function (n) { linies.push('   • ' + n); });
    linies.push('');
    linies.push('→ S\'han posat al final de la taula Beguda. Si vols que tinguin '
      + 'el format de la taula, afegeix-les a la plantilla o a SINONIMS_PRODUCTES.');
  }

  var avisos = (parsed.avisos || []).concat(informe.avisos || []);
  if (avisos.length) {
    linies.push('');
    linies.push('ℹ️ Avisos:');
    avisos.forEach(function (a) { linies.push('   • ' + a); });
  }

  if (!afegits.length && !avisos.length) {
    linies.push('');
    linies.push('Tot correcte, sense incidències. 🎉');
  }
  return linies.join('\n');
}

/**
 * Diagnòstic: mostra què llegeix de la comanda (responsable/telèfon) i com és
 * la zona "Resp. Imbecils" de la plantilla, amb referències de cel·la. Serveix
 * per ajustar els offsets sense endevinar.
 */
function diagnosticResp() {
  var ui = SpreadsheetApp.getUi();
  var url = obtenirUrlCodiba_(ui);
  if (!url) return;

  var linies = [];
  try {
    var totesColles = getCollesDisponibles_(url);
    var parsed = parseCodiba_(url, totesColles);
    var b = parsed.barres[0];
    linies.push('— COMANDA (primera barra) —');
    if (b) {
      linies.push('lloc: ' + b.header.lloc);
      linies.push('responsable: "' + b.header.responsable + '"');
      linies.push('telefon: "' + b.header.telefon + '"');
    } else {
      linies.push('(cap barra)');
    }
  } catch (e) {
    linies.push('Error llegint la comanda: ' + (e.message || e));
  }

  linies.push('');
  linies.push('— PLANTILLA (zona Resp. Imbecils) —');
  var plantilla = getSheetPerNom_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.PLANTILLA_SHEET);
  if (!plantilla) {
    linies.push('No trobo la plantilla "' + CONFIG.PLANTILLA_SHEET + '".');
  } else {
    var values = plantilla.getDataRange().getValues();
    var pos = trobaEtiqueta_(values, CONFIG.PLANTILLA_CAMPS.responsable.etiqueta);
    if (!pos) {
      linies.push('No trobo l\'etiqueta "' + CONFIG.PLANTILLA_CAMPS.responsable.etiqueta + '".');
    } else {
      linies.push('"' + CONFIG.PLANTILLA_CAMPS.responsable.etiqueta + '" a '
        + colLletra_(pos.col) + (pos.row + 1));
      // Mostra les cel·les d'aquesta fila i la següent (Satèl·lit), amb contingut.
      for (var dr = 0; dr <= 1; dr++) {
        var r = pos.row + dr;
        if (r >= values.length) continue;
        for (var c = 0; c < values[r].length; c++) {
          var v = values[r][c];
          if (v !== '' && v !== null && v !== undefined) {
            linies.push('  ' + colLletra_(c) + (r + 1) + ' = "' + v + '"');
          }
        }
      }
    }
  }

  ui.alert('Diagnòstic responsable', linies.join('\n'), ui.ButtonSet.OK);
}

/**
 * Diagnòstic temporal del Planning DAMM: obre el document, llista les pestanyes
 * i bolca el contingut (display values) de la pestanya triada a una pestanya
 * "_DIAG_DAMM" d'aquest document, amb les lletres de columna i números de fila
 * originals, per poder mapejar l'estructura.
 */
function diagnosticDamm() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Diagnòstic DAMM',
    'Enganxa el link del Planning DAMM:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var url = resp.getResponseText().trim();
  if (!url) return;

  var ss = obreSpreadsheet_(url);
  var sheets = ss.getSheets();
  var noms = sheets.map(function (s) { return s.getName(); });

  // Si hi ha més d'una pestanya, demana quina (per nom). Per defecte la primera.
  var sheet = sheets[0];
  if (sheets.length > 1) {
    var r2 = ui.prompt('Quina pestanya?',
      'Pestanyes: ' + noms.join(', ') + '\n\nEscriu el nom de la del planning:',
      ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() === ui.Button.OK && r2.getResponseText().trim()) {
      var triada = getSheetPerNom_(ss, r2.getResponseText().trim());
      if (triada) sheet = triada;
    }
  }

  var disp = sheet.getDataRange().getDisplayValues();
  var maxR = Math.min(disp.length, 50);
  var maxC = Math.min(disp.length ? disp[0].length : 0, 40);

  // Construir el bolcat amb capçaleres de columna (A,B,C...) i fila (1,2,3...).
  var data = [];
  var capcalera = ['fila\\col'];
  for (var c = 0; c < maxC; c++) capcalera.push(colLletra_(c));
  data.push(capcalera);
  for (var r = 0; r < maxR; r++) {
    var fila = [String(r + 1)];
    for (var c2 = 0; c2 < maxC; c2++) fila.push(disp[r][c2]);
    data.push(fila);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  var out = active.getSheetByName('_DIAG_DAMM');
  if (out) active.deleteSheet(out);
  out = active.insertSheet('_DIAG_DAMM');
  out.getRange(1, 1, data.length, maxC + 1).setValues(data);

  ui.alert('Diagnòstic DAMM',
    'Pestanyes del DAMM: ' + noms.join(', ') + '\n\n'
    + 'He bolcat "' + sheet.getName() + '" a la pestanya "_DIAG_DAMM" '
    + '(amb lletres de columna i números de fila originals).\n\n'
    + 'Fes-me una captura o passa-me-la per mapejar l\'estructura.',
    ui.ButtonSet.OK);
}

/**
 * Diagnòstic temporal: bolca la zona esquerra de la plantilla (files 1-30,
 * columnes A-K) amb les referències de cel·la, a una pestanya "_DIAG_PLANTILLA".
 * Serveix per veure on són exactament els valors de cada etiqueta i ajustar els
 * offsets.
 */
function diagnosticPlantilla() {
  var ui = SpreadsheetApp.getUi();
  var active = SpreadsheetApp.getActiveSpreadsheet();
  var plantilla = getSheetPerNom_(active, CONFIG.PLANTILLA_SHEET);
  if (!plantilla) {
    ui.alert('No trobo la plantilla "' + CONFIG.PLANTILLA_SHEET + '".');
    return;
  }
  var disp = plantilla.getDataRange().getDisplayValues();
  var maxR = Math.min(disp.length, 30);
  var maxC = Math.min(disp.length ? disp[0].length : 0, 11);

  var data = [];
  var cap = ['fila\\col'];
  for (var c = 0; c < maxC; c++) cap.push(colLletra_(c));
  data.push(cap);
  for (var r = 0; r < maxR; r++) {
    var fila = [String(r + 1)];
    for (var c2 = 0; c2 < maxC; c2++) fila.push(disp[r][c2]);
    data.push(fila);
  }

  var out = active.getSheetByName('_DIAG_PLANTILLA');
  if (out) active.deleteSheet(out);
  out = active.insertSheet('_DIAG_PLANTILLA');
  out.getRange(1, 1, data.length, maxC + 1).setValues(data);

  ui.alert('Diagnòstic plantilla',
    'He bolcat la zona esquerra de la plantilla a "_DIAG_PLANTILLA" amb les '
    + 'lletres de columna i números de fila. Passa-me\'n una captura.',
    ui.ButtonSet.OK);
}

/**
 * Diagnòstic temporal: mostra què extreu del DAMM i com casa cada barra
 * (plaça resolta + dia + dades trobades). Usa els links recordats.
 */
function diagnosticDammMatch() {
  var ui = SpreadsheetApp.getUi();
  var url = linkRecordat();
  var dammUrl = linkDammRecordat();
  if (!url || !dammUrl) {
    ui.alert('Falten links. Genera un cop amb CODIBA i DAMM perquè es recordin.');
    return;
  }
  var parsed = parseCodiba_(url, getCollesDisponibles_(url));
  var damm = parseDamm_(dammUrl);

  var linies = [];
  linies.push('DAMM places (' + damm.placesNorm.length + '): ' + damm.placesNorm.join(' | '));
  linies.push('DAMM dies: ' + damm.dies.join(', '));
  linies.push('');
  parsed.barres.slice(0, 8).forEach(function (b) {
    var diaNum = parseInt(diaDelMes_(b.header.data), 10);
    var res = resolPlaceDamm_(b.header.lloc, damm.placesNorm);
    var P = res.place ? damm.perPlaca[res.place] : null;
    var q = (P && P.q[diaNum]) || null;
    var ent = P ? entregaAplicable_(P, diaNum) : '';
    var rec = P ? recollidaAplicable_(P, diaNum) : '';
    linies.push('LLOC "' + b.header.lloc + '" (data ' + b.header.data + ' -> dia ' + diaNum + ')');
    linies.push('  resol: ' + res.estat + (res.place ? ' -> ' + res.place : '')
      + (res.opcions ? ' [' + res.opcions.join(', ') + ']' : ''));
    linies.push('  dades: ' + (q ? ('M=' + q.mostradors + ' T=' + q.tiradors + ' N=' + q.neveres) : 'sense quantitats')
      + ' | entrega=' + ent + ' recollida=' + rec);
  });

  ui.alert('Diagnòstic DAMM match', linies.join('\n'), ui.ButtonSet.OK);
}

function mostraAjuda() {
  SpreadsheetApp.getUi().alert('Generador de fitxes d\'imbècils',
    '1. Clica "Generar fitxes".\n'
    + '2. Tria al diàleg quines colles vols generar (Blancs, Blaus, Conjunta...).\n'
    + '3. Clica Generar. Es crearà una fitxa per barra clonant la plantilla.\n\n'
    + 'Què NO toca: format, checkboxes ni la columna "Arribat" (per omplir a mà).\n\n'
    + 'Si algun producte surt com a "no mapejat", afegeix-lo a la configuració '
    + '(fitxer Config) i torna a generar.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

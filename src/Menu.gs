/**
 * Punt d'entrada i menú dins de Google Sheets.
 *
 * En obrir la Llibreta apareix un menú "🍺 Imbècils". En clicar el botó
 * principal s'obre un diàleg on l'usuari tria quines colles vol generar.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍺 Imbècils')
    .addItem('Generar fitxes des de CODIBA', 'generarFitxes')
    .addSeparator()
    .addItem('Ajuda', 'mostraAjuda')
    .addToUi();
}

/** Obté el link de la comanda (del Config o demanant-lo). '' si es cancel·la. */
function obtenirUrlCodiba_(ui) {
  var url = CONFIG.CODIBA_URL;
  if (!url) {
    var resp = ui.prompt('Comanda CODIBA',
      'Enganxa el link de la comanda de CODIBA:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return '';
    url = resp.getResponseText().trim();
  }
  return url || '';
}

/** Botó principal: llegeix les colles disponibles i obre el diàleg de selecció. */
function generarFitxes() {
  var ui = SpreadsheetApp.getUi();
  var url = obtenirUrlCodiba_(ui);
  if (!url) { return; }

  var colles;
  try {
    colles = getCollesDisponibles_(url);
  } catch (e) {
    ui.alert('Error', String(e.message || e), ui.ButtonSet.OK);
    return;
  }
  if (!colles.length) {
    ui.alert('No he trobat cap colla a la fila COLLA de la comanda.');
    return;
  }

  // Marca per defecte les que estiguin a CONFIG.COLLES_INCLOSES.
  var perDefecte = (CONFIG.COLLES_INCLOSES || []).map(norm_);
  var items = colles.map(function (c) {
    return { nom: c, checked: perDefecte.indexOf(norm_(c)) !== -1 };
  });

  var t = HtmlService.createTemplateFromFile('Dialog');
  t.url = url;
  t.items = items;
  var html = t.evaluate().setWidth(340).setHeight(60 + items.length * 34 + 110);
  ui.showModalDialog(html, 'Generar fitxes');
}

/**
 * Cridada des del diàleg (google.script.run). Parseja amb les colles triades,
 * genera les fitxes i retorna el text de l'informe per mostrar al diàleg.
 */
function executaGeneracio(url, collesSeleccionades) {
  var parsed = parseCodiba_(url, collesSeleccionades);

  // Seguretat: no escriure MAI dins de la pròpia comanda de CODIBA.
  if (parsed.origenId === SpreadsheetApp.getActiveSpreadsheet().getId()) {
    throw new Error('Aquest document és la pròpia comanda de CODIBA. L\'script '
      + 'ha d\'estar dins de la Llibreta, no de la comanda. No s\'ha tocat res.');
  }
  if (!parsed.barres.length) {
    return 'No hi ha cap barra per a les colles triades. No s\'ha generat res.';
  }

  var informe = generaLlibreta_(parsed.barres);
  return textInforme_(parsed, informe);
}

/** Construeix el text de l'informe (parseig + generació). */
function textInforme_(parsed, informe) {
  var linies = [];
  linies.push('✅ Fitxes generades: ' + informe.creades.length);
  if (informe.creades.length) linies.push('   ' + informe.creades.join(', '));

  var noMap = Object.keys(informe.productesNoMapejats);
  if (noMap.length) {
    linies.push('');
    linies.push('⚠️ Productes NO mapejats (' + noMap.length + '):');
    noMap.forEach(function (n) { linies.push('   • ' + n); });
    linies.push('');
    linies.push('→ Afegeix-los a CONFIG.SINONIMS_PRODUCTES i torna a generar.');
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
  return linies.join('\n');
}

function mostraAjuda() {
  SpreadsheetApp.getUi().alert('Generador de fitxes d\'imbècils',
    '1. Clica "Generar fitxes des de CODIBA".\n'
    + '2. Tria al diàleg quines colles vols generar (Blancs, Blaus, Conjunta...).\n'
    + '3. Clica Generar. Es crearà una fitxa per barra clonant la plantilla.\n\n'
    + 'Què NO toca: format, checkboxes ni la columna "Arribat" (per omplir a mà).\n\n'
    + 'Si algun producte surt com a "no mapejat", afegeix-lo a la configuració '
    + '(fitxer Config) i torna a generar.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

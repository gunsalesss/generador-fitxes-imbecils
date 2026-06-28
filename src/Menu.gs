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

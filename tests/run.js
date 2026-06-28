/*
 * Banc de proves local (Node) per validar la LÒGICA del generador sense
 * desplegar a Apps Script. Stubeja els serveis de Google (SpreadsheetApp,
 * Utilities, Session) amb objectes falsos que registren escriptures.
 *
 *   node tests/run.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---- Stubs mínims dels serveis de Google ---- */
function makeSheet(name, values, displayValues) {
  return {
    _name: name,
    _values: values,
    _display: displayValues,
    _writes: [],
    _copies: [],
    getName() { return this._name; },
    setName(n) { this._name = n; return this; },
    showSheet() {},
    getDataRange() {
      const self = this;
      return {
        getValues: () => self._values,
        getDisplayValues: () => self._display || self._values
      };
    },
    getRange(r, c, nr, nc) {
      const self = this;
      if (typeof r === 'string') { // A1, p.ex. "S4"
        const m = r.match(/^([A-Z]+)(\d+)$/);
        let col = 0; for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
        c = col; r = parseInt(m[2], 10);
      }
      return {
        setValue(v) { self._writes.push({ r, c, v }); },
        clearContent() { self._writes.push({ r, c, v: '' }); },
        copyTo(dest, opts) { self._copies.push({ r, c, nr, nc, opts }); }
      };
    },
    copyTo() { return makeSheet(this._name + ' copia', deepCopy(this._values)); }
  };
}
function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

let ACTIVE_SS = null;
const SpreadsheetApp = {
  openByUrl: (u) => /damm/i.test(u) ? DAMM_SS : CODIBA_SS,
  openById: (u) => /damm/i.test(u) ? DAMM_SS : CODIBA_SS,
  getActiveSpreadsheet: () => ACTIVE_SS,
};
const Utilities = {
  formatDate: (d, tz, fmt) => {
    const p = (n) => String(n).padStart(2, '0');
    if (fmt === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  },
};
const Session = { getScriptTimeZone: () => 'Europe/Madrid' };

/* ---- Carregar el codi de src ---- */
const ctx = { SpreadsheetApp, Utilities, Session, console, JSON, Math, Number, String, Object, Date, isNaN };
vm.createContext(ctx);
['Config.gs', 'Util.gs', 'Codiba.gs', 'Damm.gs', 'Barres.gs', 'Llibreta.gs'].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
});

/* ---- Mock de la comanda CODIBA (extret dels pantallassos) ---- */
const CODIBA_VALUES = [
  ['DATA',        '23/08/2025', '24/08/2025', '25/08/2025'],
  ['DIA',         'DISSABTE',   'DIUMENGE',   'DILLUNS'],
  ['LLOC',        'PORXADA',    'FESTA INICI','MALUQUER'],
  ['ACTE',        'Concert',    'Conya',      'Proyecto X'],
  ['COLLA',       'BLANCS',     'CONJUNTA',   'BLAUS'],
  ['HORA ENTREGA','15:00',      '15:00',      '13:30'],
  ['RESPONSABLE', 'ADRIA',      'ORIOL',      'GORDILLO'],
  ['TELÈFON',     '627743675',  '608112356', '664419506'],
  ['GASOS',       12,           '',           6],
  ['Hora gel',    new Date(1899, 11, 30, 17, 0), '', new Date(1899, 11, 30, 13, 30)],
  ['HORA RECOLLIDA', '04:00', '', '03:00'],
  ['BARRIL ESTRELLA DAMM 30L', 45, 25, 14],
  ['CAIXA 35 AIGUA VERI 33CL', 15, 6,  4],
  ['PACK 6 COCA COLA 2L ZERO', 20, 12, 6],
  ['WHISKY JB 1L',             12, 8,  6],
  ['PRODUCTE INVENTAT XYZ',    3,  0,  0],
  ['GEL 20KG',                 8,  0,  5],
];
// Display values: el text TAL COM ES VEU. Les Dates de getValues sortirien mal
// (BADHORA); el parser ha d'agafar aquests valors exactes ("15:00", "13:30").
const CODIBA_DISPLAY = CODIBA_VALUES.map(row =>
  row.map(v => v instanceof Date ? 'BADHORA' : (v === '' ? '' : String(v))));
const hgDisplay = CODIBA_DISPLAY.find(r => r[0] === 'Hora gel');
hgDisplay[1] = '15:00'; hgDisplay[3] = '13:30';

const CODIBA_SS = {
  getId: () => 'CODIBA_ID',
  getSheetByName: (n) => n === 'COMANDA CODIBA'
    ? makeSheet('COMANDA CODIBA', CODIBA_VALUES, CODIBA_DISPLAY) : null,
  getSheets: () => [makeSheet('COMANDA CODIBA', CODIBA_VALUES, CODIBA_DISPLAY)],
};

/* ---- Mock del Planning DAMM ---- */
// Entrega (verd) i quantitats el DG23 (dia de la barra). Recollida (vermell) el
// DLL24 (un altre dia) -> NO ha de sortir a la fitxa del dia 23, sinó "No".
const DAMM_DISPLAY = [
  ['', 'DV21', '', '', 'DS22', '', '', 'DG23', '', '', 'DLL24', '', ''],
  ['', 'M', 'T', 'N', 'M', 'T', 'N', 'M', 'T', 'N', 'M', 'T', 'N'],
  ['PORXADA', '', '', '', '', '', '', '16h', '', '', '', '', ''],
  ['', '5', '2', '1', '', '', '', '12', '7', '10', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '4.00h', '', ''],
];
const DAMM_VALUES = [
  ['', 'DV21', '', '', 'DS22', '', '', 'DG23', '', '', 'DLL24', '', ''],
  ['', 'M', 'T', 'N', 'M', 'T', 'N', 'M', 'T', 'N', 'M', 'T', 'N'],
  ['PORXADA', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', 5, 2, 1, '', '', '', 12, 7, 10, '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
];
const DAMM_SS = {
  getSheets: () => [makeSheet('Planning', DAMM_VALUES, DAMM_DISPLAY)],
  getSheetByName: () => makeSheet('Planning', DAMM_VALUES, DAMM_DISPLAY),
};

/* ---- Mock de la pestanya "Barres 2026" ---- */
const BARRES_DISPLAY = [
  ['Relació Barres/Grups', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', ''],
  ['DIUMENGE 23 D\'AGOST', 'BARRES', 'TIPUS BARRA', 'GRUP/S', '', 'Nº PAX.', 'BOLO', 'Respo BM', 'Responsable', 'Satèl·lits', 'Durada'],
  ['', 'PORXADA', 'Fixa', 'Salsa Blanca', 'Junta', '7', 'Concert', '', 'Marina', 'Sergi', '23:00 - 03:00'],
  ['', 'PORXADA', 'Fixa', 'Other', '', '', 'Bingo', '', 'X', 'Y', '11:00 - 14:00'],
];

/* ---- Mock de la plantilla de la Llibreta ---- */
function plantillaValues() {
  return [
    ['', '', '', '', '', '', '', '', '', '', '', 'Material', 'Mostradors', 'Tiradors', 'Neveres', 'Gasos', 'Gel (h)', 'Tirador CST (h)'],
    ['', 'Bolo', '', 'Ubicació', '', '', '', '', '', '', '', 'Demanat', 12, 6, 9, '', '', '1 (15:00)'],
    ['', '', '', '', '', '', '', '', '', '', '', 'Arribat', '', '', '', ''],
    ['', 'Dia', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Arribada beguda', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Resp. Imbecils', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Satèl·lit', '', 'NOMSAT', '618275590', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'Beguda', 'Demanat', 'Arribat', 'Observacions', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'BARRIL ESTRELLA DAMM 30L', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'CAIXA 35 AIGUA VERI 33CL', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'PACK 6 COCA COLA 2L', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'WHISKY JB', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'FANTA TARONJA', 99, '', '', ''],
    ['', 'Arribada material', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Recollida material', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Recollida beguda', '', 'EXEMPLE', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Grup 1', '', 'Elefant blanc', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Grup 2', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Horari', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];
}

/* ---- Assertions ---- */
let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}

console.log('\n== Normalització ==');
check(ctx.norm_('TELÈFON') === 'TELEFON', 'norm_ treu accents');
check(ctx.normProducte_('WHISKY JB 1L') === ctx.normProducte_('WHISKY JB'), 'normProducte_ iguala mides');
check(ctx.normProducte_('PACK 6 COCA COLA 2L') === 'PACK 6 COCA COLA', 'normProducte_ treu 2L');
check(ctx.dispText_([['', '15:00']], 0, 1) === '15:00', 'dispText_ copia el text tal com es veu');

console.log('\n== Parseig CODIBA ==');
const parsed = ctx.parseCodiba_('https://fake');
check(parsed.barres.length === 2, 'filtra per colla: 2 barres (BLANCS+CONJUNTA), omet BLAUS');
check(parsed.barres.every(b => /BLANCS|CONJUNTA/i.test(b.header.colla)), 'cap barra BLAUS passa el filtre');
check((parsed.avisos || []).some(a => /omeses per colla/.test(a)), 'avisa de les barres omeses');
const b0 = parsed.barres[0];
check(b0.header.lloc === 'PORXADA', 'barra 0 lloc = PORXADA');
check(b0.header.responsable === 'ADRIA', 'barra 0 responsable = ADRIA');
check(String(b0.header.gasos) === '12', 'barra 0 gasos = 12');
check(b0.productes.length === 6, 'barra 0 té 6 productes amb quantitat (>0)');
const b1 = parsed.barres[1];
check(b1.header.lloc === 'FESTA INICI', 'barra 1 lloc = FESTA INICI');
check(b1.productes.find(p => /XYZ/.test(p.nom)) === undefined, 'producte amb qty 0 s\'omet');

console.log('\n== Selecció de colles ==');
const colles = ctx.getCollesDisponibles_('https://fake');
check(colles.length === 3, 'getCollesDisponibles_ retorna 3 colles');
check(colles.join(',') === 'BLANCS,CONJUNTA,BLAUS', 'colles en ordre i sense duplicats');
const nomesBlaus = ctx.parseCodiba_('https://fake', ['BLAUS']);
check(nomesBlaus.barres.length === 1 && nomesBlaus.barres[0].header.lloc === 'MALUQUER',
  'override colles=[BLAUS] -> només la barra MALUQUER');
const triades = ctx.parseCodiba_('https://fake', ['BLANCS', 'BLAUS']);
check(triades.barres.length === 2, 'override colles=[BLANCS,BLAUS] -> 2 barres');

console.log('\n== Parseig DAMM ==');
const dammP = ctx.parseDamm_('https://docs.google.com/spreadsheets/d/DAMM/edit');
check(dammP.placesNorm.indexOf('PORXADA') !== -1, 'detecta la plaça PORXADA');
check(dammP.dies.indexOf(23) !== -1, 'detecta el dia 23 (DG23)');
const P = dammP.perPlaca['PORXADA'];
check(P && P.q[23] && P.q[23].mostradors === 12 && P.q[23].tiradors === 7 && P.q[23].neveres === 10, 'PORXADA dia 23: M/T/N = 12/7/10');
check(P && P.ent[23] === '16h', 'PORXADA: entrega "16h" el dia 23 (DG23)');
check(P && P.rec[24] === '4.00h', 'PORXADA: recollida "4.00h" el dia 24 (DLL24)');
check(P && !P.rec[23], 'PORXADA: no hi ha recollida el dia 23');
const resOk = ctx.resolPlaceDamm_('PORXADA', dammP, 23);
check(resOk.estat === 'ok' && resOk.place === 'PORXADA', 'resol PORXADA -> ok');
const resNo = ctx.resolPlaceDamm_('LLOC INEXISTENT', dammP, 23);
check(resNo.estat === 'no-trobat', 'plaça inexistent -> no-trobat');
// Desempat per dia quan hi ha dues candidates (GRAN/OLIVERES).
const fakeDamm = {
  placesNorm: ['PORXADA (GRAN)', 'PORXADA (OLIVERES)'],
  perPlaca: {
    'PORXADA (GRAN)': { q: { 23: {}, 28: {} }, ent: {}, rec: {} },
    'PORXADA (OLIVERES)': { q: { 28: {} }, ent: {}, rec: {} }
  }
};
check(ctx.resolPlaceDamm_('PORXADA', fakeDamm, 23).place === 'PORXADA (GRAN)', 'PORXADA dia 23 -> GRAN (única amb dades)');
check(ctx.resolPlaceDamm_('PORXADA', fakeDamm, 28).estat === 'ambigu', 'PORXADA dia 28 -> ambigu (totes dues amb dades)');

console.log('\n== Generació + emparellament de begudes ==');
// Stub d'Active Spreadsheet amb plantilla i recollida de fulls creats.
const creats = [];
const plantilla = makeSheet('Plantilla Barra', plantillaValues());
const barresSheet = makeSheet('Barres 2026', BARRES_DISPLAY, BARRES_DISPLAY);
ACTIVE_SS = {
  getId: () => 'LLIBRETA_ID',
  _sheets: [plantilla, barresSheet],
  getSheetByName(n) { return this._sheets.find(s => s._name === n) || null; },
  getSheets() { return this._sheets; },
  getNumSheets() { return this._sheets.length; },
  setActiveSheet() {}, moveActiveSheet() {},
  deleteSheet(s) { this._sheets = this._sheets.filter(x => x !== s); },
};
// copyTo ha d'afegir el full nou a l'ss i retornar-lo:
plantilla.copyTo = function () {
  const nou = makeSheet('Plantilla Barra copia', deepCopy(plantillaValues()));
  ACTIVE_SS._sheets.push(nou);
  creats.push(nou);
  return nou;
};

const damm = ctx.parseDamm_('https://docs.google.com/spreadsheets/d/DAMM/edit');
const informe = ctx.generaLlibreta_(parsed.barres, damm);
check(informe.creades.length === 2, 'genera 2 fitxes');
check(informe.creades[0] === 'Dissabte 23 PORXADA', 'nom de pestanya: <dia> <dia_mes> <plaça> ("Dissabte 23 PORXADA")');
check(informe.creades[1] === 'Diumenge 24 FESTA INICI', 'segona fitxa: "Diumenge 24 FESTA INICI"');
check(!!informe.productesAfegits['PRODUCTE INVENTAT XYZ'], 'XYZ es marca com a afegit (no eren a la plantilla)');

// Comprovar escriptures a la primera fitxa creada.
const fitxa0 = creats[0];
const w = fitxa0._writes;
function escritA(nomProducte, qty) {
  // troba la fila del producte a la plantilla i mira que s'hi hagi escrit qty a Demanat (col 13, 1-based)
  return w.some(x => x.v === qty && x.c === 13);
}
check(escritA('BARRIL', 45), 'BARRIL ESTRELLA: Demanat=45 escrit');
check(escritA('COCA COLA', 20), 'PACK 6 COCA COLA 2L ZERO -> COCA COLA 2L (sinònim) Demanat=20');
check(escritA('WHISKY', 12), 'WHISKY JB 1L -> WHISKY JB (mida) Demanat=12');
check(w.some(x => String(x.v) === '12' && x.c === 16), 'Gasos=12 escrit a columna Gasos de Material');
check(w.some(x => x.v === 'ADRIA' && x.r === 6 && x.c === 4), 'responsable (nom) escrit a D16 (offset +2)');
check(w.some(x => String(x.v) === '627743675' && x.r === 6 && x.c === 5), 'telefon escrit a E16 (offset +3)');
check(w.some(x => x.v === '' && x.r === 7 && x.c === 5), 'telèfon Satèl·lit (E17) es buida');
check(w.some(x => x.v === '' && x.r === 7 && x.c === 4), 'nom Satèl·lit (D17) es buida');
check(w.some(x => x.v === '8 (15:00)' && x.r === 2 && x.c === 17), 'gel -> Demanat/Gel = "8 (15:00)" (quantitat + Hora gel, valor exacte del display)');
check(w.some(x => x.v === 12 && x.r === 2 && x.c === 13), 'DAMM: Mostradors=12 a PORXADA (dia 23)');
check(w.some(x => x.v === 7 && x.r === 2 && x.c === 14), 'DAMM: Tiradors=7 a PORXADA (dia 23)');
check(w.some(x => x.v === 10 && x.r === 2 && x.c === 15), 'DAMM: Neveres=10 a PORXADA (dia 23)');
check(w.some(x => x.v === '' && x.r === 2 && x.c === 18), 'Tirador CST (h) segueix buit (no ve de DAMM)');
check(w.some(x => x.v === '16h' && x.r === 14 && x.c === 4), 'DAMM: entrega del dia 23 "16h" a Arribada material (dia exacte)');
check(w.some(x => x.v === 'No' && x.r === 15 && x.c === 4), 'recollida d\'un altre dia (24) NO surt al dia 23 -> "No"');
check(!w.some(x => x.v === '4.00h' && x.r === 15 && x.c === 4), 'la recollida del dia 24 no s\'arrossega al dia 23');
check(w.some(x => x.v === '15:00' && x.r === 5 && x.c === 4), 'Arribada beguda = HORA ENTREGA "15:00" (col D)');
check(w.some(x => x.v === '04:00' && x.r === 16 && x.c === 4), 'Recollida beguda = HORA RECOLLIDA "04:00" (col D)');
check(w.some(x => x.v === '' && x.r === 17 && x.c === 4), 'Grup 1 buit per defecte (treu "Elefant blanc")');
check(!w.some(x => x.v === 'GEL 20KG'), 'el gel NO s\'afegeix a la taula Beguda');
check(w.some(x => x.v === '' && x.r === 13 && x.c === 13), 'producte d\'exemple no demanat (FANTA TARONJA=99) es buida');
check(w.some(x => x.v === 'PRODUCTE INVENTAT XYZ' && x.r === 14 && x.c === 12), 'beguda no a plantilla -> nom afegit al final de la taula');
check(w.some(x => x.v === 3 && x.r === 14 && x.c === 13), 'beguda no a plantilla -> quantitat afegida al final');
check(fitxa0._copies.some(c => c.opts && c.opts.formatOnly && c.r === 13 && c.c === 12),
  'fila afegida copia el format de l\'última fila de la taula');
const w1 = creats[1]._writes;
check(w1.some(x => x.v === '' && x.r === 2 && x.c === 16), 'gasos buit a la comanda -> cel·la Gasos buidada (FESTA INICI)');
check(w1.some(x => x.v === '' && x.r === 2 && x.c === 17), 'sense gel a la comanda -> cel·la Gel buidada (FESTA INICI)');
check(w1.some(x => x.v === '' && x.r === 2 && x.c === 13), 'plaça no trobada al DAMM -> Mostradors queda buit (FESTA INICI)');
check((informe.avisos || []).some(a => /DAMM.*FESTA INICI/.test(a)), 'avisa que la plaça FESTA INICI no és al DAMM');
check(w1.some(x => x.v === '' && x.r === 14 && x.c === 4), 'sense DAMM per la plaça -> Arribada material buida (FESTA INICI)');
check(!w1.some(x => x.v && x.r === 14 && x.c === 4), 'Arribada material no s\'omple si no hi ha dada DAMM (FESTA INICI)');

console.log('\n== Barres 2026 ==');
const barresP = ctx.parseBarres_();
check(barresP && barresP.length === 2, 'parseBarres_ llegeix 2 files');
const rb = ctx.resolBarres_(b0, barresP);
check(rb.estat === 'ok' && rb.row.durada === '23:00 - 03:00', 'resol PORXADA dia 23 acte Concert -> fila correcta (desempat per BOLO)');
check(rb.row.grup1 === 'Salsa Blanca' && rb.row.grup2 === 'Junta', 'grups correctes');
check(w.some(x => x.v === '23:00 - 03:00' && x.r === 19 && x.c === 3), 'Barres: Horari (Durada) a la fitxa');
check(w.some(x => x.v === 'Salsa Blanca' && x.r === 17 && x.c === 4), 'Barres: Grup 1 a la fitxa');
check(w.some(x => x.v === 'Junta' && x.r === 18 && x.c === 4), 'Barres: Grup 2 a la fitxa');
check(w.some(x => x.v === 'Sergi' && x.r === 7 && x.c === 4), 'Barres: Satèl·lit (col J) a la fitxa');
check(ctx.mateixResponsable_('ADRIA', 'Adri') === true, 'responsable: "ADRIA" ~ "Adri" (abreviatura) -> coincideix');
check(ctx.mateixResponsable_('Sergi', 'Marina') === false, 'responsable: "Sergi" vs "Marina" -> no coincideix');
check(ctx.mateixResponsable_('ADRIA', '') === true, 'responsable: si un és buit, no es compara');
check((informe.avisos || []).some(a => /Responsable diferent/.test(a)), 'avisa si el responsable de CODIBA i Barres 2026 difereixen');

console.log('\n== Actualització (mode actualitzar) ==');
const nFullsAbans = creats.length;
const informe2 = ctx.generaLlibreta_(parsed.barres, damm, 'actualitzar');
check(informe2.actualitzades.length === 2, 'actualitza 2 fitxes existents en el mateix full');
check(informe2.creades.length === 0, 'no crea fitxes noves (ja existien)');
check(creats.length === nFullsAbans, 'no s\'han clonat fulls nous en actualitzar');

console.log('\n----------------------------------------');
console.log(`Resultat: ${pass} OK, ${fail} KO`);
process.exit(fail ? 1 : 0);

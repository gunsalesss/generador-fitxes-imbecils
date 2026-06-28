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
function makeSheet(name, values) {
  return {
    _name: name,
    _values: values,
    _writes: [],
    getName() { return this._name; },
    setName(n) { this._name = n; return this; },
    showSheet() {},
    getDataRange() { return { getValues: () => this._values }; },
    getRange(r, c) {
      const self = this;
      return { setValue(v) { self._writes.push({ r, c, v }); } };
    },
    copyTo() { return makeSheet(this._name + ' copia', deepCopy(this._values)); }
  };
}
function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

let ACTIVE_SS = null;
const SpreadsheetApp = {
  openByUrl: () => CODIBA_SS,
  openById: () => CODIBA_SS,
  getActiveSpreadsheet: () => ACTIVE_SS,
};
const Utilities = {
  formatDate: (d) => '01/01/2025',
};
const Session = { getScriptTimeZone: () => 'Europe/Madrid' };

/* ---- Carregar el codi de src ---- */
const ctx = { SpreadsheetApp, Utilities, Session, console, JSON, Math, Number, String, Object, Date, isNaN };
vm.createContext(ctx);
['Config.gs', 'Util.gs', 'Codiba.gs', 'Llibreta.gs'].forEach(f => {
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
  ['BARRIL ESTRELLA DAMM 30L', 45, 25, 14],
  ['CAIXA 35 AIGUA VERI 33CL', 15, 6,  4],
  ['PACK 6 COCA COLA 2L ZERO', 20, 12, 6],
  ['WHISKY JB 1L',             12, 8,  6],
  ['PRODUCTE INVENTAT XYZ',    3,  0,  0],
];
const CODIBA_SS = {
  getId: () => 'CODIBA_ID',
  getSheetByName: (n) => n === 'COMANDA CODIBA' ? makeSheet('COMANDA CODIBA', CODIBA_VALUES) : null,
  getSheets: () => [makeSheet('COMANDA CODIBA', CODIBA_VALUES)],
};

/* ---- Mock de la plantilla de la Llibreta ---- */
function plantillaValues() {
  return [
    ['', '', '', '', '', '', '', '', '', '', '', 'Material', 'Mostradors', 'Tiradors', 'Neveres', 'Gasos'],
    ['', 'Bolo', '', 'Ubicació', '', '', '', '', '', '', '', 'Demanat', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'Arribat', '', '', '', ''],
    ['', 'Dia', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Arribada beguda', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Resp. Imbecils', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'Beguda', 'Demanat', 'Arribat', 'Observacions', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'BARRIL ESTRELLA DAMM 30L', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'CAIXA 35 AIGUA VERI 33CL', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'PACK 6 COCA COLA 2L', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', 'WHISKY JB', '', '', '', ''],
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

console.log('\n== Parseig CODIBA ==');
const parsed = ctx.parseCodiba_('https://fake');
check(parsed.barres.length === 2, 'filtra per colla: 2 barres (BLANCS+CONJUNTA), omet BLAUS');
check(parsed.barres.every(b => /BLANCS|CONJUNTA/i.test(b.header.colla)), 'cap barra BLAUS passa el filtre');
check((parsed.avisos || []).some(a => /omeses per colla/.test(a)), 'avisa de les barres omeses');
const b0 = parsed.barres[0];
check(b0.header.lloc === 'PORXADA', 'barra 0 lloc = PORXADA');
check(b0.header.responsable === 'ADRIA', 'barra 0 responsable = ADRIA');
check(String(b0.header.gasos) === '12', 'barra 0 gasos = 12');
check(b0.productes.length === 5, 'barra 0 té 5 productes amb quantitat (>0)');
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

console.log('\n== Generació + emparellament de begudes ==');
// Stub d'Active Spreadsheet amb plantilla i recollida de fulls creats.
const creats = [];
const plantilla = makeSheet('Plantilla Barra', plantillaValues());
ACTIVE_SS = {
  getId: () => 'LLIBRETA_ID',
  _sheets: [plantilla],
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

const informe = ctx.generaLlibreta_(parsed.barres);
check(informe.creades.length === 2, 'genera 2 fitxes');
check(!!informe.productesNoMapejats['PRODUCTE INVENTAT XYZ'], 'XYZ es reporta com a no-mapejat (no es descarta en silenci)');

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

console.log('\n----------------------------------------');
console.log(`Resultat: ${pass} OK, ${fail} KO`);
process.exit(fail ? 1 : 0);

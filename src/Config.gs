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
  CODIBA_URL: 'https://docs.google.com/spreadsheets/d/1dVZ0Ku8kf4-CuJQ7yQmL9kqjjCXegiVu4d918r2J-dw/edit?gid=1281594146#gid=1281594146',

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

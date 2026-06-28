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
  // Es deixa BUIT a propòsit: el diàleg demana el link cada cop (i recorda
  // l'últim que s'ha fet servir). Si vols un valor per defecte, posa'l aquí.
  CODIBA_URL: '',

  // Nom de la pestanya dins de CODIBA que conté la comanda principal.
  CODIBA_SHEET: 'COMANDA CODIBA',

  // --- Fase 2: Planning DAMM (mostradors, tiradors, neveres + hores) -------
  // Nom de la pestanya del planning ('' = la primera del document).
  DAMM_SHEET: '',
  // Equivalència entre la plaça de la comanda (LLOC) i la del DAMM. Clau = el
  // LLOC tal com surt a CODIBA; valor = el nom de la plaça al DAMM. Només cal
  // per als casos que no s'endevinen sols (p. ex. "PORXADA" -> quina de les
  // dues). La resta es resol per coincidència aproximada; el que no quadri
  // surt avisat a l'informe.
  DAMM_EQUIV: {
    // 'PORXADA': 'PORXADA (GRAN)',
  },
  // Quines columnes (M/T/N) del DAMM van a quina columna de la taula Material.
  DAMM_MATERIAL: { M: 'Mostradors', T: 'Tiradors', N: 'Neveres' },
  // Etiquetes de la fitxa on van les hores del DAMM (esquerra de la fitxa).
  PLANTILLA_ARRIBADA_MATERIAL:  'Arribada material',
  PLANTILLA_RECOLLIDA_MATERIAL: 'Recollida material',
  // Què posar a Arribada/Recollida material quan la plaça és al DAMM però no
  // hi ha hora d'entrega/recollida aplicable. Deixa '' per buidar-ho.
  MATERIAL_SENSE_HORA: 'No',

  // --- Pestanya "Barres 2026" (dins la Llibreta): horari i grups -----------
  BARRES_SHEET: 'Barres 2026',
  PLANTILLA_HORARI: 'Horari',     // a la fitxa, valor a +1 (fila de dalt)
  PLANTILLA_GRUP1:  'Grup 1',     // valor a +2 (caixa esquerra)
  PLANTILLA_GRUP2:  'Grup 2',     // valor a +2
  PLANTILLA_SATELLIT: 'Satèl·lit',// nom del satèl·lit (col J de Barres), valor a +2

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
    gasos:        'GASOS',
    horaGel:      'HORA GEL',
    horaRecollida: 'HORA RECOLLIDA'
  },

  // --- Filtre per COLLA ----------------------------------------------------
  // Només es generen fitxes de les barres la "COLLA" de les quals estigui en
  // aquesta llista (sense distingir accents ni majúscules). La resta s'ometen.
  // Deixa la llista buida [] per generar-les TOTES, sigui quina sigui la colla.
  COLLES_INCLOSES: ['BLANCS', 'CONJUNTA'],

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
    // Fila de dalt (Bolo/Ubicació/Dia): etiqueta i valor de costat -> offset 1.
    acte:        { etiqueta: 'Bolo',          offsetCol: 1 },
    lloc:        { etiqueta: 'Ubicació',      offsetCol: 1 },
    dia:         { etiqueta: 'Dia',           offsetCol: 1 },
    // Caixes de l'esquerra: etiqueta a col B (fusionada B:C), valor a col D -> +2.
    horaEntrega: { etiqueta: 'Arribada beguda', offsetCol: 2 },
    horaRecollida: { etiqueta: 'Recollida beguda', offsetCol: 2 },
    responsable: { etiqueta: 'Resp. Imbecils', offsetCol: 2 }, // nom (col D)
    telefon:     { etiqueta: 'Resp. Imbecils', offsetCol: 3 }  // telèfon (col E)
  },

  // Cel·les que s'han de BUIDAR a cada fitxa (dades d'exemple de la plantilla
  // que s'han d'omplir a mà). Es localitzen per etiqueta + offset, igual que
  // PLANTILLA_CAMPS. Ex.: el telèfon del Satèl·lit (E17) ve d'exemple.
  PLANTILLA_BUIDAR: [
    { etiqueta: 'Satèl·lit', offsetCol: 2 },          // nom satèl·lit (D17)
    { etiqueta: 'Satèl·lit', offsetCol: 3 },          // telèfon satèl·lit (E17)
    { etiqueta: 'Arribada material', offsetCol: 2 },  // s'omple del DAMM si n'hi ha
    { etiqueta: 'Recollida material', offsetCol: 2 }, // s'omple del DAMM si n'hi ha
    { etiqueta: 'Arribada beguda', offsetCol: 2 },    // s'omple de l'HORA ENTREGA
    { etiqueta: 'Recollida beguda', offsetCol: 2 },   // s'omple de l'HORA RECOLLIDA
    { etiqueta: 'Grup 1', offsetCol: 2 },             // s'omple de Barres 2026
    { etiqueta: 'Grup 2', offsetCol: 2 },             // s'omple de Barres 2026
    { etiqueta: 'Horari', offsetCol: 1 }              // s'omple de Barres 2026 (Durada)
  ],

  // --- Gel: va a la taula Material, no a la de begudes ---------------------
  // Els productes de la comanda que continguin aquest text es tracten com a
  // gel: la seva quantitat (sumada) va a la cel·la Demanat sota la columna
  // "Gel (h)" amb la hora del gel (fila "Hora gel" de la comanda) entre
  // parèntesis -> "8 (17:00)". I NO surten a la taula Beguda.
  // Deixa PLANTILLA_FILA_GEL buit ('') per desactivar el tractament especial.
  PRODUCTE_GEL_CONTE: 'GEL',
  PLANTILLA_FILA_GEL: 'Gel (h)',

  // Capçaleres de les taules dins la plantilla (per localitzar-les soles).
  PLANTILLA_TAULA_BEGUDA:  'Beguda',   // capçalera de la columna de noms
  PLANTILLA_TAULA_MATERIAL:'Material', // capçalera de la taula de material
  PLANTILLA_COL_DEMANAT:   'Demanat',  // nom de la columna a omplir
  PLANTILLA_FILA_GASOS:    'Gasos',    // dins la taula Material

  // Columnes de la taula Material que de moment es BUIDEN sempre, perquè la
  // seva info ve del Planning DAMM (encara no integrat). Quan es faci la
  // Fase 2, aquí s'hi ompliran les dades en lloc de buidar-les.
  MATERIAL_DEMANAT_BUIDAR: ['Mostradors', 'Tiradors', 'Neveres', 'Tirador CST (h)'],

  // --- Comportament --------------------------------------------------------
  // Si una fitxa ja existeix, què fem? 'replace' = la regenera de zero.
  // 'skip' = la deixa intacta.  (De moment només 'replace'.)
  SI_JA_EXISTEIX: 'replace'
};

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

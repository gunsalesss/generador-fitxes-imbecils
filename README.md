# Generador de fitxes d'imbècils

Eina per generar automàticament les fitxes de la **Llibreta d'imbècils** a
partir de la **comanda de CODIBA**, perquè deixi d'haver-hi dues fonts de
veritat i la llibreta no quedi mai desactualitzada.

Funciona com a **Google Apps Script** dins del propi Google Sheets: afegeix un
menú **🍺 Imbècils** amb **Generar fitxes** (crea de zero) i **Actualitzar
fitxes** (refà les dades de les existents sense esborrar-les, preservant el que
s'ha omplert a mà com la columna "Arribat"). Qualsevol col·laborador amb accés
al full hi pot clicar. No cal cap servidor ni cap web.

---

## Què fa (Fase 1)

1. Obre la comanda de CODIBA a partir del seu link.
2. Pregunta **quines colles** vols generar (Blancs, Blaus, Conjunta…) en un diàleg.
3. Detecta **una barra per columna** (data, lloc, responsable, telèfon, gasos…).
4. Per cada barra **clona la pestanya `Plantilla Barra`** i hi omple:
   - Dades de capçalera (acte, ubicació, dia, responsable + telèfon, hora d'arribada de beguda).
   - La taula **Beguda** → columna **Demanat**, emparellant productes pel nom.
   - El **Gasos** a la taula Material.
5. Mostra un **informe**: fitxes creades, productes no mapejats i avisos.

**El que NO toca** (es deixa per omplir a mà): format, colors, checkboxes, els
grups/responsables de junta i la columna **Arribat**.

### Robustesa

El parseig **no depèn de números de fila ni de columna**: busca les coses pel
text de les etiquetes (`DATA`, `LLOC`, `GASOS`, `Beguda`, `Demanat`…). Per això
pots afegir/treure/reordenar places i productes sense tocar el codi. Si alguna
cosa no es reconeix, l'informe t'ho diu explícitament en lloc de generar dades
dolentes en silenci. Els ajustos (sinònims de productes, etiquetes) es fan al
fitxer [`src/Config.gs`](src/Config.gs), sense saber programar.

---

## Instal·lació

### Opció A — Còpia manual (ràpida, recomanada per començar)

1. Obre la **Llibreta d'imbècils** a Google Sheets.
2. Menú **Extensions → Apps Script**.
3. Esborra el contingut per defecte i **crea un fitxer per cada `.gs`** de la
   carpeta [`src/`](src/) (Config, Util, Codiba, Llibreta, Menu, Damm),
   enganxant-hi el contingut.
4. Desa i **recarrega** la Llibreta. Apareixerà el menú **🍺 Imbècils**.
5. El primer cop, Google demanarà **autoritzar** el script (és normal: cal
   permís per llegir/escriure els teus fulls).

### Opció B — Desplegament amb `clasp` (versionat des d'aquest repo)

Recomanat si vols mantenir el codi sincronitzat amb git.

```bash
npm install -g @google/clasp
clasp login

# Si la Llibreta encara no té script associat:
#   obre la Llibreta → Extensions → Apps Script i copia el "ID de secuencia
#   de comandos" des de Configuració del projecte.
cp .clasp.json.example .clasp.json
# enganxa el scriptId a .clasp.json

clasp push
```

> `.clasp.json` està al `.gitignore` perquè conté l'ID del teu projecte.

---

## Configuració

Tot el que es pot necessitar tocar és a [`src/Config.gs`](src/Config.gs):

| Clau | Per a què serveix |
|---|---|
| `CODIBA_URL` | Link fix de la comanda (si es deixa buit, el botó el demana cada cop). |
| `CODIBA_SHEET` | Nom de la pestanya de la comanda dins de CODIBA. |
| `PLANTILLA_SHEET` | Nom de la pestanya plantilla que es clona. |
| `PESTANYES_PROTEGIDES` | Pestanyes que el generador no tocarà mai. |
| `CODIBA_CAMPS` | Etiquetes de les files de capçalera (admet sinònims amb `|`). |
| `SINONIMS_PRODUCTES` | Equivalències quan el nom a CODIBA i a la Llibreta no coincideixen. |
| `PLANTILLA_CAMPS` | On va cada camp dins la plantilla (per etiqueta + offset). |

---

## Estat

- ✅ **Fase 1** — CODIBA → fitxes de la Llibreta (begudes, gasos, gel, dades de barra).
- ✅ **Fase 2** — Planning DAMM: omple **mostradors/tiradors/neveres** a la taula
  Material i les **hores d'entrega/recollida** (Arribada/Recollida material),
  emparellant per plaça (taula d'equivalències `DAMM_EQUIV`) i dia (número del
  dia). El link del DAMM s'introdueix al diàleg (opcional). Veure [`src/Damm.gs`](src/Damm.gs).

---

## Estructura

```
generador-fitxes-imbecils/
  .clasp.json.example    # plantilla de config de clasp (rootDir: src)
  src/                   # arrel que puja clasp (fitxers sense prefix)
    appsscript.json      # manifest del projecte Apps Script (scopes, timezone)
    Config.gs            # ⚙️ configuració editable (l'únic que cal tocar)
    Util.gs              # normalització de text i cerca per etiquetes
    Codiba.gs            # parser de la comanda de CODIBA
    Llibreta.gs          # generador de fitxes des de la plantilla
    Menu.gs              # menú, botó, diàleg i informe
    Dialog.html          # diàleg de selecció de colles
    Damm.gs              # Fase 2 (pendent)
```

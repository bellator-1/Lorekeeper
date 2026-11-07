# Lorekeeper — Documentazione del progetto

Versione del codice: 0.14.x · Lingua dell'interfaccia: italiano · ~2.400 righe di TypeScript/TSX

> **Stato di verifica (leggere prima).** Tutto il codice è stato scritto senza poterlo eseguire. È stata controllata solo la
> sintassi con `tsc`. I tipi non sono stati verificati e nessuna funzione è stata provata in un browser. Questa
> documentazione descrive come il codice è *progettato* per funzionare: dove nel §10 si indicano punti a rischio, sono quelli
> da controllare per primi.

## Indice

1. [Panoramica](#1-panoramica)
2. [Avvio e comandi](#2-avvio-e-comandi)
3. [Mappa dei file](#3-mappa-dei-file)
4. [Architettura](#4-architettura)
5. [Formato dei dati su disco](#5-formato-dei-dati-su-disco)
6. [Moduli in dettaglio](#6-moduli-in-dettaglio)
7. [Riferimento delle API interne](#7-riferimento-delle-api-interne)
8. [Ricette: come estendere il progetto](#8-ricette-come-estendere-il-progetto)
9. [Dove guardare: sintomo → file](#9-dove-guardare-sintomo--file)
10. [Stato di verifica, limiti e rischi noti](#10-stato-di-verifica-limiti-e-rischi-noti)
11. [Roadmap](#11-roadmap)
12. [Novità della 0.7](#12-novità-della-07)
13. [Novità della 0.8](#13-novità-della-08)
14. [Novità della 0.9](#14-novità-della-09)
15. [Novità della 0.10](#15-novità-della-010)
16. [Novità della 0.11](#16-novità-della-011)
17. [Novità della 0.12](#17-novità-della-012)
18. [Novità della 0.13](#18-novità-della-013)
19. [Novità della 0.14](#19-novità-della-014)

---

## 1. Panoramica

Principi di progetto:

- **Local-first, senza backend.** Il browser legge e scrive direttamente una cartella scelta dall'utente (File System Access API).
- **Un mondo = una cartella.** I contenuti sono file di testo leggibili (markdown con frontmatter, JSON) e quindi versionabili con git.
- **Un solo stato in memoria**, caricato all'apertura; ogni modifica aggiorna prima la memoria, poi scrive su disco con ritardo (*debounce*).
- **I link tra pagine usano ID stabili**, non titoli: rinominare non rompe i collegamenti.

Funzioni: pagine (editor ricco, wikilink, backlink, immagini con posizionamento, tabelle, attività), cartelle annidabili con colore,
mappe (sfondi multipli, livelli, elementi colorati, collegamento a pagine, modalità ciclica est-ovest), timeline (calendario
e ere personalizzati, filtri, panoramica), grafo dei collegamenti con direzione, lettore musicale, cestino, note per pagina,
esportazione in PDF (via stampa), temi chiaro/scuro e impostazioni dell'editor.

### Stack

| Pacchetto | Ruolo |
|---|---|
| `react`, `react-dom`, `react-router-dom` | UI e routing (`HashRouter`: funziona su hosting statico) |
| `zustand` (+ middleware `persist`) | Stato globale e impostazioni persistite in `localStorage` |
| `idb-keyval` | Salva in IndexedDB l'elenco dei mondi recenti (gli handle delle cartelle) |
| `@tiptap/*` (core, react, pm, starter-kit, link, image, placeholder, suggestion, table, task-list/item) | Editor di testo (ProseMirror) |
| `tiptap-markdown` | Conversione documento ⇄ markdown |
| `leaflet`, `@geoman-io/leaflet-geoman-free` | Mappe su immagine e strumenti di disegno |
| `d3-force` | Calcolo del layout del grafo (il disegno è SVG scritto a mano) |
| `tailwindcss` v4 + `@tailwindcss/vite` | Stili (token di colore come variabili CSS) |
| `@fontsource-variable/fraunces` | Font dei titoli, incluso nel bundle |
| `vite`, `@vitejs/plugin-react`, `typescript` | Build |

TypeScript è in modalità **non stretta** (`strict: false`); handle del filesystem, Leaflet e Geoman sono tipizzati `any` in molti punti.

---

## 2. Avvio e comandi

    npm install
    npm run dev        # sviluppo, http://localhost:5173
    npm run build      # build in dist/
    npm run preview    # serve la build

Requisiti: Node 18+, Chrome/Edge/Brave. Firefox e Safari non supportano `showDirectoryPicker`: l'app lo segnala nella home.
Servire da `localhost` o HTTPS, **non** da `file://`.

Primo utilizzo: «Apri cartella del mondo» → scegliere una cartella (se vuota diventa un mondo nuovo; al primo apertura vengono
create le sottocartelle `pages/`, `assets/`, `maps/`, `music/`). A ogni nuova sessione il browser richiede di riconfermare
il permesso sulla cartella (click sul mondo recente).

---

## 3. Mappa dei file

```
index.html, vite.config.ts, tsconfig.json, package.json
src/
├─ main.tsx          Punto d'ingresso: importa il font, monta <App/> dentro <ErrorBoundary/>
├─ App.tsx           Route + shell del mondo (barra a sinistra, header, pannelli, area principale) + selettore rapido Ctrl+K
├─ Home.tsx          Schermata iniziale: apri cartella, mondi recenti
├─ Sidebar.tsx       Pannello sinistro della sezione Pagine: ricerca, albero cartelle, drag&drop, menu contestuale, cestino
├─ PageView.tsx      Pagina aperta (titolo, popover proprietà, esportazione) + PageSide (note, backlink, link in uscita)
├─ Editor.tsx        Editor TipTap, barra di formattazione, controlli immagine e tabella
├─ ImageNode.ts      Nodo immagine personalizzato (posizione/larghezza codificate nel "title" markdown)
├─ wikilink.ts       Estensione TipTap: digitando "[[" propone pagine e permette di crearle
├─ spell.ts          Estensione TipTap: correttore dei refusi nei nomi inventati (vocabolario = titoli, tag, dizionario del mondo)
├─ indent.ts         Rientranza a blocco dei paragrafi: attributo `indent` (px), markup <<testo>> nel file, Tab / Maiusc+Tab
├─ Tags.tsx          Combo (suggerimenti per il campo Tipo) e TagEditor (tag a dizionario «Categoria:valore»)
├─ Dictionary.tsx    Finestra del dizionario del mondo (parole inventate)
├─ kinds.ts          Specializzazione per tipo: schede (campi), preset, relazioni, famiglia
├─ Fields.tsx        Editor dei campi della scheda e blocco «Famiglia» nel pannello della pagina
├─ TypesModal.tsx    Finestra «Tipi»: schede dei tipi di pagina
├─ Characters.tsx    Sezione Personaggi: elenco e albero della famiglia
├─ MapsHome.tsx      Sezione Mappe: pannello sinistro (elenco) e galleria
├─ MapView.tsx       Editor di mappa: sfondi, livelli, strumenti di disegno, modalità ciclica
├─ Timeline.tsx      Timeline (vista), pannello filtri, editor del calendario; store dei filtri (useTL)
├─ DateField.tsx     Campo data (giorno / mese / anno) legato al calendario del mondo
├─ calendar.ts       Calendario: conversione data ⇄ numero di giorni, ere
├─ Graph.tsx         Grafo dei collegamenti (d3-force + SVG, direzione e reciprocità)
├─ MusicPlayer.tsx   Lettore musicale nell'header (libreria nel mondo)
├─ Trash.tsx         Finestra del cestino
├─ Appearance.tsx    Popover "Aa": tema, carattere, dimensione, interlinea, larghezza; componente Seg
├─ Help.tsx          Guida utente (modale «?») — testi in SECTIONS
├─ ErrorBoundary.tsx Schermata di errore al posto della pagina bianca
├─ store.ts          Stato globale del mondo (pagine, cartelle, calendario, mappe, musica) e azioni
├─ storage.ts        Accesso al disco (classe Vault), parsing/serializzazione pagine, mondi recenti
├─ settings.ts       Impostazioni persistite (tema, larghezze pannelli, volume…) e loro applicazione al documento
├─ types.ts          Tipi (Page, Folder, MapDoc…), palette COLORS, newId, folderPath, folderColor
├─ ui.tsx            Componenti base: Icon, IconBtn, Section, Popover, Modal, ContextMenu, MenuItem, Resizer, `field`
└─ styles.css        Token di colore, stile dell'editor, immagini, mappe, tabelle, scrollbar
docs/DOCUMENTAZIONE.md   Questo file
```

---

## 4. Architettura

### 4.1 Livelli

```
   Componenti React (App, Sidebar, PageView, MapView, Timeline, …)
              │ leggono/scrivono
              ▼
   useStore (store.ts)  ── stato in memoria + azioni + debounce
              │ chiama
              ▼
   Vault (storage.ts)   ── unico punto che tocca il filesystem
              │
              ▼
   File System Access API  →  cartella del mondo sul disco
```

Regola: **i componenti non toccano mai il filesystem**; passano da `useStore`, che passa da `Vault`. Per cambiare il
supporto di memorizzazione (es. IndexedDB, Tauri) basta riscrivere `Vault`.

### 4.2 Flusso dei dati e salvataggi

| Dato | Memoria | Scrittura su disco | Ritardo |
|---|---|---|---|
| Pagina | `useStore.pages[id]` aggiornato subito da `upsert` | `pages/<id>.md` | 500 ms dopo l'ultima modifica della pagina |
| Cartelle, calendario, brani | `folders`, `calendar`, `music` | `world.json` (un solo file) | 400 ms |
| Mappa | `maps[id]` aggiornato da `patchMap` | `maps/<id>.json` | 600 ms |
| Rinomina pagina → testo dei link | — | pagine che contengono il link | 900 ms di quiete sul titolo |
| Immagini, brani audio | — | subito (`assets/`, `music/`) | nessuno |
| Impostazioni UI | zustand `persist` | `localStorage` chiave `lorekeeper-settings` | immediato |
| Mondi recenti | — | IndexedDB chiave `recents` (idb-keyval) | immediato |

Le scritture in attesa del ritardo vengono salvate subito da `flushSaves()` (`store.ts`) quando la scheda si nasconde o si chiude (`visibilitychange`, `pagehide`) e prima di aprire un altro mondo; è un best effort, perché il browser può interrompere una scrittura asincrona durante la chiusura.

All'apertura (`useStore.open`) si leggono in parallelo tutte le pagine, `world.json` e tutte le mappe. Non esiste indice su disco:
backlink, ricerca e grafo sono calcolati in memoria dal testo delle pagine.

### 4.3 Routing e layout

Router: `HashRouter` (gli URL sono `#/…`).

| Rotta | Componente | Contenuto area principale | Pannello sinistro |
|---|---|---|---|
| `/` | `Home` | Mondi recenti, apri cartella | — |
| `/w` | `World` | Messaggio «Scegli una pagina» | `Sidebar` |
| `/w/:id` | `World` | `PageView` (+ `PageSide` a destra) | `Sidebar` |
| `/maps` | `World view="maps"` | `MapsGallery` | `MapsPanel` |
| `/map/:id` | `World view="map"` | `MapView` | `MapsPanel` |
| `/timeline` | `World view="timeline"` | `Timeline` | `TimelinePanel` |
| `/graph` | `World view="graph"` | `Graph` | `Sidebar` |

Se si apre `/w/...` senza aver aperto un mondo (`vault` nullo, es. dopo un ricaricamento) si viene riportati a `/`.

Shell (`World` in `App.tsx`): barra di navigazione verticale (Pagine, Mappe, Timeline, Grafo) · header (pannello sinistro, nome mondo e
percorso, Ctrl+K, musica, Aa, guida, pannello destro) · pannello sinistro ridimensionabile · area principale · pannello destro
(solo con una pagina aperta). Le larghezze dei pannelli sono in `useSettings` (`leftW`, `rightW`, limiti 200–560 px).

### 4.4 Stato

- **`useStore`** (`store.ts`): `vault`, `name`, `pages`, `folders`, `calendar`, `maps`, `music` + azioni (§7.1). Non persistito: si ricostruisce da disco.
- **`useSettings`** (`settings.ts`): preferenze dell'utente, persistite nel browser (non nel mondo). `useApplySettings()` (chiamato in `App`) riporta
  tema e variabili CSS dell'editor sul documento.
- **`useTL`** (`Timeline.tsx`): filtri della timeline (ricerca, cartelle, tipi, tag), condivisi tra `TimelinePanel` e `Timeline`. Non persistito.
- Stato locale (`useState`) per tutto il resto (modali, strumento attivo della mappa, zoom della timeline…).

### 4.5 Stili e tema

- Tailwind v4: nessun file di configurazione; i colori sono **variabili CSS** in `styles.css` (`:root` per il chiaro, `.dark` per lo scuro)
  e vengono esposti a Tailwind con `@theme inline`. Classi disponibili: `bg-canvas`, `bg-panel`, `bg-paper`, `text-ink`, `text-muted`,
  `border-line`, `bg-accent`, `text-on-accent`, `text-gold`, `text-danger`.
- Gerarchia delle superfici: `canvas` (sfondo) < `panel` (barre, pannelli) < `paper` (superficie di scrittura, schede).
- Il tema è la classe `dark` su `<html>`; `theme: 'auto'` segue `prefers-color-scheme`.
- Variabili dell'editor: `--editor-font`, `--editor-size`, `--editor-lh`, `--editor-width` (impostate da `useApplySettings`).
- Stile del testo dell'editor: classe `.lore` in `styles.css` (Tailwind azzera titoli e liste, qui vengono ripristinati).
- Font: `--display` (Fraunces) per titoli e logotipo; UI in font di sistema.

---

## 5. Formato dei dati su disco

```
<cartella del mondo>/
├─ world.json              cartelle, calendario, libreria musicale
├─ pages/<id>.md           una pagina per file
├─ assets/<hash>.<ext>     immagini (nome = primi 12 caratteri esadecimali dello SHA-256 del contenuto)
├─ maps/<id>.json          una mappa per file
├─ music/<tempo>-<nome>    file audio
└─ .trash/<id>.md          pagine eliminate (ripristinabili dal Cestino)
```

Gli `id` sono generati da `newId()`: `Date.now()` in base 36 + 4 caratteri casuali (es. `lq3k9a1fxz2b`).

### 5.1 Pagina — `pages/<id>.md`

```markdown
---
id: lq3k9a1fxz2b
title: "Regno di Arvan"
type: luogo
tags: ["regno", "Cultura:Europea"]
folder: lq3k8zzzab12
parent: lq3k9madre001
links: ["lq3k9altra002"]
date: 124350
dateEnd: 131400
notes: "da ricontrollare i confini\naggiungere il porto"
---

Corpo in markdown. Un link: [Casa Vael](wiki:lq3k9bbbcd34).

![](asset:a3f9c1d2e4b6.png "align=left;w=40")

| Titolo | Valore |
| --- | --- |
| Capitale | Arvhold |

- [ ] attività da fare
```

| Chiave | Tipo | Note |
|---|---|---|
| `id` | stringa | Se manca, si usa il nome del file |
| `title` | stringa JSON (con virgolette) | |
| `type` | testo libero | Vuoto se assente; il vecchio valore `generico` viene letto come vuoto |
| `tags` | array JSON | |
| `folder` | id di cartella | Omessa se la pagina è alla radice; un id inesistente equivale alla radice |
| `parent` | id di pagina | Pagina madre: questa pagina è un periodo, un governo o un mandato di quella. Omesso se non c'è; un id inesistente (madre nel cestino) equivale a nessuna madre e il legame torna se la madre viene ripristinata |
| `links` | array JSON di id | Collegamenti scritti nei metadati (sezione «Note e collegamenti»), senza `[[…]]` nel testo; contano come i collegamenti del testo per «Collegata da» e per il grafo. Si leggono anche scritti a mano («id1, id2») |
| `star` | `true` | Pagina principale (stella). Omesso se non c'è |
| `fields` | oggetto JSON su una riga | Valori dei campi della scheda del tipo della pagina: `{"padre":"<id>","coniugi":["<id>"],"titolo":"Regina"}`. Chiave = `id` del campo; testo = stringa, data = giorno intero, scelta = stringa, pagina = id, pagine = array di id. Un valore illeggibile equivale a nessun valore |
| `date`, `dateEnd` | intero | Giorni dall'anno 0 secondo il calendario (§6.5). Omessi se vuoti |
| `notes` | stringa JSON | Note private della pagina; i ritorni a capo sono `\n` |

Il frontmatter è letto riga per riga (`chiave: valore`, split sul primo `:`), **non** è YAML completo: valori su più righe non sono supportati.

Convenzioni nel corpo:

- **Link a pagina**: `[Testo](wiki:<id>)`. Il testo è il titolo al momento dell'inserimento; viene riallineato alla rinomina (§6.1).
- **Immagine**: `![](asset:<file> "<opzioni>")`. Le opzioni sono coppie `chiave=valore;…`: `align` = `left|center|right|full`, `w` = larghezza 10–100 (%).
  Chiavi sconosciute sono conservate a ogni salvataggio. Il vecchio formato `left,40` è ancora letto e viene migrato al primo salvataggio.
- Tabelle e liste di attività: sintassi GFM.

### 5.2 `world.json`

```json
{
  "folders": [ { "id": "lq3k8zzzab12", "name": "Regni", "parent": "", "color": "#c2574b" } ],
  "calendar": {
    "era": "E.C.",
    "months": [ { "name": "Brumaio", "days": 30 }, { "name": "Fiorile", "days": 31 } ],
    "eras": [ { "name": "Età Antica", "start": -3000 }, { "name": "Età dei Regni", "start": 0 } ]
  },
  "music": [
    { "id": "…", "name": "Tema della taverna", "kind": "file", "src": "lq3k-tema.mp3" },
    { "id": "…", "name": "radio.example.com/stream", "kind": "url", "src": "https://radio.example.com/stream" }
  ]
}
```

- `folders[].parent`: id della cartella madre, `""` = radice. Il colore: `""` = eredita dalla cartella madre, `"none"` = nessun colore (interrompe l'ereditarietà), altro = colore proprio; vale per le sottocartelle (`folderColor`).
- `calendar.era` è un *suffisso* mostrato dopo l'anno; `calendar.eras` sono le *ere* (fasce della timeline): ognuna inizia all'anno `start`
  e dura fino all'inizio della successiva.
- `music[].kind`: `file` (in `music/`) oppure `url` (link diretto o streaming).
- `dictionary`: elenco di parole inventate (stringhe) del dizionario del mondo.
- `schemas`: schede dei tipi di pagina, chiave = tipo in minuscolo; `{ "preset"?: "personaggio"|"entita", "dates"?: ["Nascita","Morte"], "fields": [ { "id", "label", "kind": "text|date|choice|page|pages", "options"?, "inverse"?, "role"?: "parent|spouse" } ] }`. Un tipo senza voce usa la scheda predefinita del suo nome (se esiste); una voce con `fields: []` e senza `preset` è «nessuna scheda».

### 5.3 Mappa — `maps/<id>.json`

```json
{
  "id": "lq3kmap0001",
  "title": "Continente di Arvan",
  "image": "asset:a3f9c1d2e4b6.png",
  "w": 4000, "h": 2000,
  "loop": true,
  "backgrounds": [
    { "id": "…", "name": "Base", "image": "asset:a3f9….png", "visible": true, "opacity": 1 }
  ],
  "layers": [ { "id": "…", "name": "Confini", "color": "#c2574b", "visible": true } ],
  "features": [
    { "type": "Feature",
      "properties": { "id": "…", "layer": "<id livello>", "name": "Regno di Arvan", "page": "<id pagina>", "color": "#4a7bc2" },
      "geometry": { "type": "Polygon", "coordinates": [[[x, y], …]] } }
  ]
}
```

- **Coordinate**: spazio piano dell'immagine, origine in basso a sinistra: **x = ascissa (0…w), y = altezza (0…h)**. In GeoJSON l'ordine è `[x, y]`;
  in Leaflet `[lat = y, lng = x]`.
- `w`, `h` sono le dimensioni della **prima** immagine caricata e definiscono il riquadro di tutte le altre.
- `image` è l'immagine originale (usata per l'anteprima e per mappe vecchie); l'elenco vero è `backgrounds` (ordine = dal fondo verso l'alto).
  Mappe senza `backgrounds` sono lette come se avessero un solo sfondo `image`.
- `features[].properties.group` (opzionale): id comune a più elementi che formano **un'unica area non confinante**; assente = elemento a sé (il suo `id` fa da chiave). Nome, colore, livello e pagina sono ripetuti su ogni parte e modificati insieme.
- `features[].properties.color` vuoto → vale il colore del livello. Tipi di geometria usati: `Point` (segnaposto), `LineString` (rotta), `Polygon` (confine).
- `loop: true` attiva la modalità ciclica (§6.4).

### 5.4 Dati fuori dal mondo (nel browser)

| Dove | Chiave | Contenuto |
|---|---|---|
| `localStorage` | `lorekeeper-settings` | tema, carattere, dimensione, interlinea, larghezza pagina, pannelli aperti/larghezze, cartelle chiuse, volume |
| IndexedDB (idb-keyval) | `recents` | fino a 10 mondi recenti: `{ name, handle }` |

---

## 6. Moduli in dettaglio

### 6.1 Pagine, editor e collegamenti

- **`PageView`**: titolo (input), popover con proprietà (cartella, tipo con suggerimenti `<datalist>`, tag, data e fine, esporta, cestino).
  Ogni modifica chiama `useStore.upsert`.
- **`Editor`**: `useEditor` ricreato a ogni cambio di pagina (`deps: [page.id]`). Estensioni: StarterKit, Link (protocollo `wiki` abilitato, `openOnClick: false`),
  `AssetImage`, Placeholder, Table (+Row, Header, Cell), TaskList/TaskItem, Markdown (`html: false`, `linkify: false`), `WikiSuggest`.
  `onUpdate` serializza in markdown (`editor.storage.markdown.getMarkdown()`) e chiama `upsert`. Un clic su un link `wiki:` naviga a `/w/<id>`.
  Incolla/trascina di immagini → `Vault.addAsset` → inserisce nodo immagine più un paragrafo vuoto (per poter scrivere dopo).
- **Barra di formattazione** (in `Editor`): ha tre modalità nella stessa riga (altezza fissa, niente spostamenti del contenuto):
  formattazione normale · controlli immagine (se un'immagine è selezionata) · comandi di tabella (se il cursore è in una tabella).
- **`wikilink.ts`**: plugin Suggestion con carattere `[[`. Elenco = pagine il cui titolo contiene la query; se non esiste una corrispondenza esatta
  propone «Crea "…"», che chiama `useStore.create`. Inserisce testo con marchio link `href="wiki:<id>"`.
- **Rinomina e testo dei link** (`useStore.upsert`): se il titolo cambia, dopo 900 ms di quiete sostituisce nelle altre pagine la stringa esatta
  `[vecchio](wiki:<id>)` con `[nuovo](wiki:<id>)`. Se il titolo contiene caratteri che il markdown *escapa* (es. `_`, `*`) la corrispondenza può non scattare:
  il link funziona comunque, ma mostra il vecchio testo.
- **Backlink / link in uscita** (`PageSide`): calcolati cercando `wiki:<id>` nel testo delle altre pagine / le occorrenze `](wiki:…)` nella pagina.
- **Note** (`PageSide`): textarea legata a `page.notes`.

### 6.2 Immagini nel testo (`ImageNode.ts`)

Il nodo `image` di TipTap è esteso con una *node view* DOM: un `div.img-wrap` con `data-align` e larghezza percentuale, che contiene l'`<img>`.
`src` con prefisso `asset:` viene risolto in un *object URL* leggendo il file da `assets/` (`Vault.assetUrl`). Posizione e larghezza stanno nel
`title` dell'immagine (§5.1) e sono lette/scritte da `parseImg`/`stringifyImg`.
I controlli appaiono nella barra dell'editor (non sull'immagine); `updateAttributes('image', { title })` aggiorna le opzioni.
Sinistra/destra = `float` (il testo scorre intorno); trascinando l'immagine si sposta tra i paragrafi.

### 6.3 Cartelle (`Sidebar.tsx`)

- Albero ricorsivo (`level(parent, depth)`): prima le sottocartelle (ordine alfabetico), poi le pagine della cartella.
- **Nuova cartella**: `addFolder('Nuova cartella')` e il nome si scrive subito nell'elenco (campo inline; Invio/blur conferma, Esc annulla).
  Rinomina: doppio clic o menu contestuale. Colore, nuova sottocartella, nuova pagina, elimina: menu contestuale (clic destro).
- **Drag & drop** (HTML5): il payload è `text/plain` = `page:<id>` o `folder:<id>`; si può rilasciare su una cartella o sullo sfondo (= radice).
  `moveFolder` impedisce i cicli.
- Eliminare una cartella **non** cancella il contenuto: pagine e sottocartelle salgono di un livello.
- Con il filtro attivo l'albero è sostituito da un elenco piatto di risultati (titolo, testo, tag, tipo). Lo stesso elenco piatto (le pagine in vista, in ordine alfabetico) si ottiene con `useSettings.folderView = false`; la ricerca ignora sempre le cartelle nascoste.
- **Vista per gruppo**: `useSettings.hiddenFolders` (id) e `hideRoot` (pagine senza cartella) decidono cosa si vede nella Sidebar. Una cartella nascosta nasconde il proprio sottoalbero (cartelle e pagine); `isHidden`/`shownPage` in `Sidebar.tsx`. Si gestisce dal menu contestuale della cartella («Nascondi dalla vista», «Mostra solo questa cartella») e dalla finestra «Vista dell'elenco» (ingranaggio sopra l'elenco: una casella per cartella, Tutte/Nessuna, contatori, elenco unico). Sono preferenze del browser, non del mondo: i file non cambiano.
- Il contatore di una cartella somma le pagine proprie e quelle di tutte le sottocartelle (`folderTree`); si nasconde con `useSettings.counts`. Conta solo ciò che è in vista: le sottocartelle nascoste non entrano nel totale.
- Tasto destro su una **pagina**: Apri, Duplica, Sposta in… (finestra con l'elenco delle cartelle), Sposta nel cestino. Tasto destro su una **cartella**: vedi `colorFolder` (§7.1) per i colori.
- Stato aperto/chiuso delle cartelle: `useSettings.closed` (elenco di id chiusi).
- **Cestino**: `useStore.remove` → `Vault.trash(page)` scrive la pagina in `.trash/` e toglie il file da `pages/`. La finestra `Trash.tsx` elenca,
  ripristina (`upsert` + `purge`) o elimina in via definitiva.

### 6.4 Mappe (`MapView.tsx`, `MapsHome.tsx`)

**Creazione**: «Nuova mappa» chiede un'immagine → `useStore.createMap` la salva in `assets/`, ne legge le dimensioni (`createImageBitmap`), crea tre livelli
(Luoghi, Confini, Rotte) e uno sfondo «Base».

**Mappa Leaflet**: `L.map` con `crs: L.CRS.Simple`, controllo di zoom in basso a destra, senza controlli Geoman (la barra strumenti è propria).

**Sfondi** (`syncBgs`): ogni sfondo è un `L.imageOverlay` nel riquadro `[[0,0],[h,w]]` in un pane dedicato `bg` (z-index 150, sotto i disegni).
Visibilità, opacità e ordine (`setZIndex`) vengono applicati a ogni cambio di `doc.backgrounds`. Gli URL sono *object URL* tenuti in `urls` e revocati
quando lo sfondo è rimosso o la vista chiusa. Tutti gli sfondi sono **stirati** sul riquadro della prima immagine: devono avere le stesse proporzioni.
Flusso di ricalco: sfondo con linee → disegno → aggiunta della mappa pulita → riferimento nascosto/rimosso. I disegni non cambiano.

**Livelli** (`groups`): un `L.FeatureGroup` per livello. Ogni elemento ha `feature.properties = { id, layer, name, page, color }`.
Colore effettivo = `properties.color` se presente, altrimenti colore del livello. Un livello come «Confini» può quindi contenere regni di colori diversi.
Il pannello a destra elenca gli elementi di ogni livello (clic → `focus` li raggiunge e apre la scheda).

**Strumenti** (`TOOLS`, `setTool`): selezione, segnaposto (inserimento continuo), rotta, confine, modifica forma, sposta, elimina. Usano le API di Geoman
(`enableDraw`, `enableGlobalEditMode`, `…DragMode`, `…RemovalMode`); lo strumento attivo è in `toolRef` (letto dai gestori di clic).
Esc torna alla selezione. Il clic su un elemento apre la scheda (popup DOM: nome, colore, livello, pagina collegata) **solo** con lo strumento Seleziona.

**Salvataggio** (`save`): scorre tutti i gruppi, serializza ogni layer con `toGeoJSON()` e chiama `patchMap` (che salva con ritardo di 600 ms).
La fonte di verità degli elementi è Leaflet; `doc.features` è lo specchio salvato (e ciò che il pannello dei livelli legge).

**Modalità ciclica** (`doc.loop`, interruttore «Mondo ciclico» accanto al titolo). Solo orizzontale.

| Aspetto | Come funziona |
|---|---|
| Sfondi | Ogni sfondo è replicato 5 volte (offset −2…+2 larghezze) → passaggio senza interruzioni |
| Elementi | Copie «fantasma» non modificabili a ±1 larghezza (`rebuildGhosts`, Geoman le ignora con `pmIgnore`). Cliccandole si apre la scheda dell'originale |
| Vista | Su `moveend`, se il centro esce da `[0, w)` la vista viene riportata dentro senza animazione (non mentre si disegna) |
| Zoom minimo | `log2(larghezza_vista / (3·w))`: non si vedono mai più di ~3 copie |
| Limiti verticali | Da −25 % a +125 % dell'altezza |
| Elementi oltre il bordo | Alla creazione e al trascinamento (`normalize`) vengono traslati di multipli di `w` perché il loro centro cada in `[0, w)`. Un elemento a cavallo del bordo resta intero e le sue copie compaiono dall'altra parte |

### 6.5 Timeline (`Timeline.tsx`, `calendar.ts`, `DateField.tsx`)

**Modello del tempo.** Le date sono **interi** = giorni dall'anno 0, giorno 1 (non si usa `Date`: i calendari fantasy hanno mesi e durate propri).

```
lunghezzaAnno = Σ giorni dei mesi
toDay(cal, anno, mese0, giorno) = anno·lunghezzaAnno + Σ giorni dei mesi precedenti + (giorno − 1)
fromDay(cal, n) → { y: floor(n / lunghezzaAnno), m, d }      // anni negativi supportati
```

Modificare mesi o durate **sposta** le date già inserite (cambia `lunghezzaAnno`); l'editor del calendario lo segnala.

**Vista.**

- Scala orizzontale `z` in pixel per anno, logaritmica: `z = 0.05 · 400000^(slider/100)`, limitata a `2,5e7 / durata` per non superare la dimensione massima degli elementi del browser.
- **Zoom**: slider, Ctrl/⌘ + rotella (ancorato al cursore, `pend` + `useLayoutEffect`), «Tutto», pulsante di ogni era (`fit`).
- **Ere**: fasce colorate (`bands`) nell'intestazione e nello sfondo; il nome resta visibile durante lo scorrimento (`position: sticky`).
- **Tacche**: passo scelto da `STEPS` in modo che distino ≥ 80 px; tacche dei mesi se un mese è largo ≥ 70 px. Si generano **solo** quelle visibili.
- **Eventi**: pagine con `date`, ordinate; assegnazione alla prima corsia libera (`ends[]`) per evitare sovrapposizioni; si disegnano solo le schede in vista.
  Con `dateEnd` la scheda si estende sull'intervallo.
- **Panoramica**: striscia in alto con tutto l'arco, fasce, punti e finestra visibile; clic/trascinamento per spostarsi.
- **Filtri** (`useTL`, `useMatcher`): ricerca (titolo, tipo, tag), cartelle (una cartella include le sottocartelle; «Senza cartella»), tipi, tag. Cambiando i filtri la vista si adatta di nuovo (`fit`).

### 6.6 Grafo (`Graph.tsx`)

Un nodo per pagina, un arco per **coppia** di pagine collegate. L'arco va da chi ha scritto il link per primo; se esiste anche il link inverso, `back = true`:
freccia a entrambe le estremità e colore accento (collegamento reciproco), altrimenti freccia a una sola. Layout calcolato una volta con `d3-force`
(300 passi, nessuna animazione) e ricalcolato quando cambia `pages`. Zoom con la rotella o il pinch (listener nativo non passivo, quindi il browser non ingrandisce la pagina; ancorato al cursore; fattore 0,05–8) e pulsanti −, +, «Tutto» (`fit`: inquadra tutti i nodi, eseguito anche all'apertura); trascinamento dello sfondo, passaggio del mouse evidenzia i vicini,
clic apre la pagina. Colore dei nodi = colore della cartella (`folderColor`). Dimensione = numero di collegamenti.

### 6.7 Musica (`MusicPlayer.tsx`)

Un solo elemento `<audio>` sempre montato nell'header: la riproduzione continua cambiando sezione. La libreria è `useStore.music` (in `world.json`).
File: copiati in `music/` (`Vault.addMusic`) e riprodotti tramite object URL (in cache in `urls`). Link: usati direttamente come `src`
(dipendono dal server di origine: devono consentire la riproduzione incorporata). Modalità di ripetizione: tutto / brano / nessuna. Volume in `useSettings.volume`.

### 6.8 Altro

- **Selettore rapido** (`Jump`, Ctrl/⌘+K): ricerca per titolo, frecce e Invio.
- **Home**: mondi recenti da IndexedDB. Riaprire un mondo = `requestPermission` sull'handle salvato (richiede un gesto dell'utente).
- **Esportazione PDF** (`printPage` in `PageView.tsx`): apre una finestra con l'HTML della pagina (`.ProseMirror.innerHTML`) e uno stile minimale, poi `window.print()`.
- **Guida** (`Help.tsx`): testi in `SECTIONS`; è l'unico posto con istruzioni d'uso (l'interfaccia non ne contiene altre).
- **ErrorBoundary**: mostra l'errore e un pulsante «Ricarica».

---

## 7. Riferimento delle API interne

### 7.1 `useStore` (`store.ts`)

Stato: `vault`, `name`, `pages: Record<id, Page>`, `folders: Folder[]`, `calendar`, `maps: Record<id, MapDoc>`, `music: Track[]`.

| Azione | Effetto |
|---|---|
| `open(handle)` | Crea il `Vault`, legge pagine, `world.json` e mappe, popola lo stato |
| `upsert(page)` | Aggiorna la memoria subito; scrive `pages/<id>.md` dopo 500 ms; se il titolo è cambiato avvia la sincronizzazione dei link (900 ms) |
| `create(title?, folder?)` | Nuova pagina (tipo vuoto), chiama `upsert`, restituisce la pagina |
| `remove(id)` | Sposta la pagina nel cestino e la toglie dallo stato |
| `addFolder(name, parent?)` | Crea cartella (colore vuoto), salva `world.json` |
| `patchFolder(id, patch)` | Modifica nome/colore/madre |
| `colorFolder(id, color, cascade?)` | Imposta il colore; con `cascade` le sottocartelle perdono il colore proprio (`""`) e seguono quello della cartella |
| `removeFolder(id)` | Elimina la cartella; pagine e sottocartelle salgono al livello superiore |
| `movePage(id, folder)` | Cambia la cartella di una pagina |
| `moveFolder(id, parent)` | Sposta una cartella (ignora la mossa se creerebbe un ciclo) |
| `setCalendar(cal)` | Sostituisce il calendario, salva `world.json` |
| `addTrack(t)`, `removeTrack(id)` | Libreria musicale (rimuove anche il file in `music/`) |
| `createMap(file)` | Salva l'immagine, crea la mappa con tre livelli e uno sfondo; restituisce il `MapDoc` |
| `patchMap(doc)` | Sostituisce la mappa in memoria; scrive dopo 600 ms |
| `removeMap(id)` | Elimina il file della mappa (definitivo; gli asset restano) |

### 7.2 `Vault` (`storage.ts`)

| Metodo | Descrizione |
|---|---|
| `static open(root)` | Crea `pages/`, `assets/`, `maps/`, `music/` se mancano |
| `list()` / `save(page)` / `remove(id)` | Pagine (`remove` è definitivo e non è usato dall'interfaccia: il cestino usa `trash`) |
| `trash(page)` / `listTrash()` / `purge(id)` | Cestino in `.trash/` |
| `addAsset(file)` / `assetUrl(name)` | Salva un'immagine con nome da hash / restituisce un object URL |
| `listMaps()` / `saveMap(doc)` / `removeMap(id)` | Mappe |
| `readMeta()` / `saveMeta(obj)` | `world.json` |
| `addMusic(file)` / `musicUrl(name)` / `removeMusic(name)` | Musica |

Funzioni del modulo: `parsePage(testo, idDiRiserva)`, `getRecents()`, `pickWorld()` (apre il selettore di cartelle e salva il recente),
`reopen(recente)` (chiede il permesso), `removeRecent(nome)`.

### 7.3 `calendar.ts`

`DEFAULT_CAL` (12 mesi da 30 giorni) · `yearLen(cal)` · `toDay(cal, y, m0, d)` · `fromDay(cal, n)` · `fmt(cal, n)` → «12 Brumaio 1204 E.C.» · `eraList(cal)` (ere ordinate per inizio).

### 7.4 `settings.ts`

Campi: `theme` (`auto|light|dark`), `font` (`serif|display|sans|mono`), `size`, `lh`, `width`, `left`, `right`, `closed`, `leftW`, `rightW`, `volume`, `folderView` (albero o elenco unico), `counts` (contatori delle cartelle), `hiddenFolders` (cartelle nascoste dalla Sidebar), `hideRoot` (nasconde le pagine senza cartella).
Azioni: `set(partial)`, `resize('leftW'|'rightW', dx)`. `FONTS` mappa i nomi dei caratteri sulle famiglie CSS.

### 7.5 `ui.tsx`

`Icon` (`n` = nome in `PATHS`, tracciati 24×24 a contorno) · `IconBtn` · `Section` (sezione a scomparsa) · `Popover` (`button(open, toggle)`, chiude con clic fuori/Esc) ·
`Modal` · `useConfirm()` (finestra di conferma al posto di `window.confirm`: `const { ask, dialog, open } = useConfirm()`, `ask({ title, text, label, danger }, azione)`, poi `{dialog}` nel JSX) · `ContextMenu` + `MenuItem` · `Resizer` (maniglia di trascinamento) · `field` (classe CSS dei campi di testo).

### 7.6 `types.ts`

Tipi: `Page`, `Folder`, `MapLayer`, `MapBg`, `MapDoc`, `Track`. Utility: `COLORS` (palette di 8 colori), `newId()`, `folderPath(folders, id)` («Regni / Nord»),
`folderColor(folders, id)` (colore ereditato dagli antenati; `"none"` interrompe la catena; altrimenti `var(--muted)`) · `folderTree(folders, id)` (id della cartella e di tutte le sue sottocartelle).

---

## 8. Ricette: come estendere il progetto

**Aggiungere un campo alla pagina (es. «luogo di nascita»)**
1. `types.ts`: aggiungere il campo a `Page`.
2. `storage.ts`: in `parsePage` leggerlo da `meta`; in `toMd` scriverlo nel frontmatter (solo se valorizzato).
3. `PageView.tsx`: aggiungere il campo nel popover (`upsert({ ...page, campo: valore })`).
4. Se deve essere filtrabile: `Sidebar.tsx` (ricerca) e/o `Timeline.tsx` (`useMatcher`).

**Aggiungere un'opzione alle immagini (es. bordo)**
`ImageNode.ts`: aggiungere il default in `parseImg` e applicarla in `apply()` della node view; in `Editor.tsx` aggiungere il controllo in `imageControls`
(`setImg({ bordo: 1 })`); regola CSS in `styles.css` (`.img-wrap`). Le vecchie immagini continuano a funzionare perché le chiavi mancanti prendono il default.

**Aggiungere una sezione (es. «Personaggi»)**
`App.tsx`: voce in `NAV`, nuovo valore in `type View`, `<Route>` in `App`, ramo nell'area principale di `World` e (opzionale) un pannello sinistro in `panel`.
Icona nuova: `PATHS` in `ui.tsx`.

**Aggiungere uno strumento alla mappa**
`MapView.tsx`: voce in `TOOLS`; ramo in `setTool` (API Geoman); gestione dell'evento in `useEffect` di inizializzazione; se crea elementi, impostare
`feature.properties` come in `pm:create`. Icona in `PATHS`.

**Aggiungere un'estensione all'editor**
`Editor.tsx`: importarla e aggiungerla a `extensions`; aggiungere il pulsante nella barra; stile in `.lore` (`styles.css`).
**Verificare sempre** che `tiptap-markdown` sappia serializzarla, altrimenti il contenuto non sopravvive a chiusura e riapertura.

**Salvare un nuovo dato a livello di mondo** (come fanno cartelle, calendario, musica)
`store.ts`: campo nello stato, valore iniziale, lettura in `open()` da `meta`, inclusione nell'oggetto passato a `saveMeta` (funzione `saveMeta` interna), azione che chiama `saveMeta()`.

**Cambiare colori o tema**
Token in `styles.css`: blocco `:root` (chiaro) e `.dark` (scuro). Le classi Tailwind (`bg-panel`, …) seguono automaticamente.

**Aggiungere un carattere per il testo**
`settings.ts` (`FONTS`) e `Appearance.tsx` (opzioni di `Seg`). Per un font incluso nel bundle: pacchetto `@fontsource-variable/…` e `import` in `main.tsx`.

**Cambiare dove vivono i dati** (es. IndexedDB, Tauri)
Riscrivere `Vault` mantenendone la firma; nient'altro dovrebbe cambiare. Resta da gestire `pickWorld`/`reopen`/recenti in `Home.tsx`.

**Aggiornare la guida utente**
`Help.tsx` → `SECTIONS` (coppie titolo / elenco di frasi).

Convenzioni: testi dell'interfaccia in italiano · nessuna istruzione d'uso fuori dalla guida · colori solo tramite token · i dati del mondo mai in `localStorage`
(solo preferenze) · accesso al disco solo da `Vault` · **nessun file in `src/` il cui nome differisca da un altro solo per le maiuscole o per l'estensione** (su Windows e macOS `import './Types'` troverebbe `types.ts` prima di `Types.tsx`: è l'errore che ha rotto l'avvio della 0.12.0).

---

## 9. Dove guardare: sintomo → file

| Sintomo | Dove guardare |
|---|---|
| Schermata bianca con errore | `ErrorBoundary` mostra lo stack; console del browser |
| Si perde il mondo ricaricando la pagina | Comportamento previsto: `vault` non sopravvive al ricarico; riaprire dai recenti |
| Pagina non si salva / ricomparsa vecchia versione | `useStore.upsert` (timer 500 ms) e `Vault.save`; permessi della cartella |
| I link `[[…]]` non si creano o non sopravvivono al riavvio | `wikilink.ts`; `Link.configure({ protocols: ['wiki'] })` in `Editor.tsx`; serializzazione di `tiptap-markdown` |
| Il testo di un link non segue la rinomina | Sincronizzazione in `useStore.upsert` (corrispondenza esatta; titoli con caratteri speciali) |
| Immagine non appare dopo il riavvio | `ImageNode.ts` (`assetUrl`), file in `assets/`, prefisso `asset:` nel markdown |
| Controlli immagine assenti o posizione non salvata | `imageControls` in `Editor.tsx`, `updateAttributes`, `parseImg`/`stringifyImg` |
| Tabelle/attività perse alla riapertura | Serializzatore markdown di `tiptap-markdown`; estensioni in `Editor.tsx` |
| Cartelle non si trascinano / nome non si modifica | `Sidebar.tsx` (`drag`, `drop`, `editing`) |
| Mappa vuota | `syncBgs` in `MapView.tsx`, file in `assets/`, `doc.backgrounds` |
| Strumenti di disegno non rispondono | `setTool`, `toolRef`, versione di `@geoman-io/leaflet-geoman-free` |
| Elementi non persistono o finiscono sul livello sbagliato | `save`, `pm:create` (livello = `activeRef`), `register` |
| Mappa ciclica: salti o vuoti | `applyBounds`, gestore `moveend`, `syncBgs` (copie ±2), `rebuildGhosts` |
| Timeline lenta o vuota | `placed`/`visible`, calcolo di `z` e `W`, `fit` |
| Date sbagliate dopo aver cambiato il calendario | Atteso: le date sono giorni assoluti (vedi §6.5) |
| Grafo senza frecce o con nodi sovrapposti | `edge()` e parametri di `forceSimulation` in `Graph.tsx` |
| Musica non parte | `MusicPlayer.tsx` (`play`); per i link, il server di origine |
| Pannelli che non scorrono | Catena di altezze: `h-full` + `min-h-0` nei contenitori flex di `App.tsx`, `Sidebar.tsx`, `PageView.tsx` |
| Colori/tema sbagliati | `styles.css` (token), classe `dark` su `<html>`, `useApplySettings` |
| Popup/menu coperti dalla mappa | `.leaflet-container { isolation: isolate }` in `styles.css` |

**Prova rapida (smoke test) consigliata dopo ogni modifica importante**

1. Aprire un mondo vuoto → creare 3 pagine in 2 cartelle → collegarle con `[[`.
2. Chiudere il browser, riaprire dai recenti: pagine, cartelle e link presenti.
3. Incollare un'immagine, spostarla a sinistra, ridurla; ricaricare: posizione e larghezza mantenute.
4. Inserire una tabella e una lista di attività; ricaricare: contenuto invariato.
5. Rinominare una pagina: dopo ~1 s il testo dei link in un'altra pagina cambia.
6. Eliminare una pagina → ripristinarla dal cestino.
7. Impostare date su 3 pagine; timeline: zoom con Ctrl+rotella, «Tutto», filtro per cartella.
8. Creare una mappa; disegnare un confine su «Confini» e dargli un colore proprio; ricaricare.
9. Aggiungere un secondo sfondo, nasconderlo, riattivarlo; attivare «Mondo ciclico» e trascinare oltre il bordo.
10. Grafo: due pagine che si citano a vicenda mostrano la freccia doppia.
11. Musica: aggiungere un file, riprodurlo, cambiare sezione: continua.
12. Cartelle annidate su 3 livelli: il contatore del livello 1 somma tutto; «Applica alle sottocartelle» uniforma i colori; «Nessun colore» su una sottocartella la rende grigia anche se la madre è colorata.
13. Ingranaggio sopra l'elenco → «Vista dell'elenco»: togli la spunta a una cartella radice e a due sottocartelle di un'altra: spariscono con le loro pagine e i contatori si aggiornano; «Mostra solo questa cartella» dal tasto destro; «Tutte» ripristina; «Mostra le cartelle» spento → elenco unico (senza le cartelle nascoste); la ricerca trova comunque anche le pagine nascoste.
14. Tasto destro su una pagina: Apri, Duplica, Sposta in…, Sposta nel cestino (con la finestra di conferma, non quella del browser).
15. Collegare una pagina a un elemento di mappa (scheda dell'elemento → Pagina) e dare una data alla pagina: nella timeline compare l'icona di mappa sulla scheda; un clic apre la mappa e l'elemento. Nel pannello destro della pagina, «Sulle mappe» elenca gli stessi elementi.
16. Tag: aggiungere `Cultura:Europea`, `Moneta:fiorino` e `Animale` a pagine con data; in timeline compaiono raggruppati; cliccare «Cultura» seleziona tutti i suoi valori; rinominare un tag in una pagina mentre il filtro è attivo non deve lasciare la timeline vuota.
17. Tipo: i suggerimenti compaiono sotto il campo con il numero di pagine, frecce e Invio.
18. Rientranza: Tab su un paragrafo → rientra; salvare, ricaricare il mondo: la rientranza resta (il file contiene `&emsp;&emsp;`); Maiusc+Tab la toglie; in un elenco Tab fa il suo lavoro di sempre.
19. Dizionario: aggiungere «Zorvath»; scrivere «Zorvat» a metà frase → sottolineato in giallo; tasto destro → «Correggi in…» e «Aggiungi al dizionario».
20. Spegnere «Correttore del browser» nel Dizionario: le sottolineature rosse spariscono.
21. Madre e periodi: creare «Polonia» (senza data), dal pannello destro «+ Nuovo periodo» due volte; dare date 1025–1795 e 1918–1939; in timeline stanno sulla stessa corsia con il tratteggio nel mezzo e una pagina con date 1800–1900 va su un'altra corsia; la madre mostra «Esistenza» e «interruzione di …».
22. Sovrani: «+ Nuovo sovrano» sotto un periodo, con date; la madre mostra la cronologia con durata, interregno e co-reggenza; mettere come madre una pagina discendente è impossibile (non compare tra le scelte).
23. Grafo: i periodi sono legati alla madre da un tratteggio dorato; il clic sui nodi funziona come prima.
24. Spostare la madre nel cestino e ripristinarla: i periodi perdono il percorso e lo ritrovano.
25. Rientranza a blocco: Tab su un paragrafo lo sposta di 24 px, di nuovo Tab di altri 24; Maiusc+Tab e Backspace a inizio paragrafo tolgono un passo; scrivere `<<` e spazio a inizio paragrafo lo rientra; salvare e riaprire: la rientranza resta e nel `.md` il paragrafo è `<<testo>>` o `<<48|testo>>`. **Da verificare per primo**: che il lettore markdown restituisca il testo senza le parentesi e con la rientranza.
26. Correttore: nessuna sottolineatura rossa del browser; scrivere due volte una parola inventata → mai segnalata; un refuso di un nome noto → sottolineato in giallo; tasto destro → correggi / aggiungi al dizionario. Aprire un mondo con `public/dizionario-it.txt`: il Dizionario mostra il numero di parole e le parole sconosciute vengono segnalate.
27. Barra laterale: una pagina con sottopagine ha la freccia e i numeri; aprire/chiudere nasconde le sottopagine; aprire una sottopagina da altrove apre le madri chiuse; trascinare una pagina su un'altra la rende sottopagina; trascinarla su una cartella la stacca; tasto destro → «Nuova sottopagina» e «Rendi indipendente»; i contatori delle cartelle contano anche le sottopagine.
28. Proprietà della pagina: con molti tag il pannello scorre e i tag hanno un'area che scorre; i suggerimenti si vedono.
29. Grafo: la legenda a destra mostra i quattro tipi di linea; a sinistra le cartelle con il loro colore (anche ereditato).
30. Collegamenti nei metadati: da «Note e collegamenti» collegare due pagine; compaiono in «Collegata da» e come freccia punteggiata nel grafo; toglierlo con ×.
31. Sovrano: creare «Re X» nella cartella «Personaggi», dalla madre «Collega una pagina esistente»: il re compare sotto il regno e anche in «Personaggi»; «Sposta in…» un'altra cartella lo sposta e resta sotto la madre; «Rendi indipendente» lo stacca.
32. Mappe: disegnare un confine con nome, «＋ Aggiungi un'altra parte» e disegnare una parte lontana: stesso nome e colore, nome una volta sola; l'elenco a destra ha una riga «2 parti»; cambiare colore dalla scheda cambia entrambe; la casella «Nomi» li nasconde; un nome con < > si legge per intero.
33. Tipi: aprire «Tipi» (barra laterale): compaiono i tipi usati; «Personaggio» e «Regno» mostrano «scheda: … (predefinita)»; aggiungere il tipo «Luogo» con un campo «Alleato di» (più pagine, inverso «Alleati»); su una pagina Luogo il campo compare nel pannello destro; sul regno scelto compare «Alleati».
34. Personaggio: creare tre pagine di tipo Personaggio; sulla seconda indicare Padre = prima; sulla terza Padre = prima: la prima mostra «Figli» (due), le altre due «Fratelli e sorelle»; le date della scheda si chiamano Nascita e Morte.
35. Sezione Personaggi: l'albero mostra genitori sopra, fratelli e coniugi accanto, figli sotto; clic sul nome ricentra, «pagina» apre la pagina; «+ Figlio (padre)» crea un personaggio con il legame e il nome si può digitare subito.
36. Sezioni a tipo: una pagina senza tipo non mostra «Periodi»; con tipo «Regno» sì; una pagina che ha già sottopagine la mostra comunque.
37. Grafo: padre/madre/coniugi e i campi pagina compaiono come frecce punteggiate; nessun doppione con i collegamenti nel testo.
38. Duplica mappa: «Duplica» crea «… (copia)» con gli stessi livelli, elementi (anche le aree con più parti) e sfondi; modificare la copia non cambia l'originale.
39. Albero dei personaggi: il personaggio centrale appare come card evidenziata (non come testo `card(p, true)`).
40. Grafo: «Filtri e vista» apre il pannello; togliere «Collegamenti nel testo» cambia disposizione e conteggio; «Raggruppa per cartella» forma gruppi; con molti collegamenti le linee sono più tenui e i nomi compaiono ingrandendo.
41. Vicinato: scegliere una pagina nel campo (o Maiusc + clic su un nodo): restano solo lei e le pagine a 1, 2 o 3 passi; svuotando il campo torna tutto; i filtri restano dopo aver cambiato sezione e tornato.
42. Icona: la scheda del browser mostra il libro con la stella (anche dopo un aggiornamento forzato con Ctrl+F5); la schermata iniziale mostra il logo accanto al titolo.
43. Stelle: la ★ accanto al titolo la accende e la spegne; la pagina compare in «★ Principali» in cima all'elenco (che si comprime), con la ★ nella riga; nel grafo ha l'anello dorato e il nome sempre visibile; «Solo le pagine con la stella» da «Vista dell'elenco» mostra solo quelle.
44. Nascondere una pagina: tasto destro → «Nascondi dalla vista»: sparisce con le sue sottopagine, il contatore della cartella scende, la ricerca la trova ancora; «Vista dell'elenco» la elenca con × per mostrarla; «Nascondi le sottopagine» nasconde solo i figli; «Mostra tutte» ripristina tutto.
45. Sottopagina in una cartella propria: nascondere la madre → la sottopagina resta visibile nella sua cartella.
46. Casato: dalla scheda di un personaggio «+ Crea una pagina Casato»: si apre la nuova pagina (tipo Casato) e il campo Casato del personaggio la indica; scrivere la storia nel testo; la sezione «Membri» elenca il personaggio con gli anni di vita.
47. Casato: «Aggiungi un personaggio…» e «+ Nuovo personaggio del casato» aggiungono membri; × toglie dal casato; nella sezione Personaggi il filtro «Tutti i casati» seleziona i membri e «Senza casato» gli altri.
48. Albero con casato: sul capostipite «+ Casato» (o il casato esistente) e poi «Estendi ai discendenti (N)»: figli e nipoti senza casato lo ricevono; le card mostrano il nome del casato.

---

## 10. Stato di verifica, limiti e rischi noti

**Verifica.** Nessuna esecuzione reale. Punti a maggior rischio (da controllare per primi):

1. Link `wiki:` in TipTap/`tiptap-markdown` (protocollo personalizzato, round-trip).
2. Immagini: node view, selezione e `updateAttributes`; round-trip del `title` nel markdown.
3. Tabelle e liste di attività: round-trip markdown.
4. Mappe: integrazione Geoman (strumenti, `pm:create`, `pm:remove`, `pmIgnore` sulle copie), `syncBgs`, modalità ciclica.
5. Timeline: ancoraggio dello zoom, `fit`, prestazioni con molti eventi.
6. Altezze dei pannelli (catena flex) e scorrimento.
7. Versioni dei pacchetti in `package.json` scritte a memoria: possibili incompatibilità.

**Limiti di progetto.**

- Browser: solo Chrome/Edge/Brave. Nessun ripiego su IndexedDB.
- Un solo utente e una sola scheda: due schede sullo stesso mondo si sovrascrivono; modifiche ai file fatte fuori dall'app non vengono rilevate finché non si riapre il mondo.
- Pagine, mappe e musica: il cestino copre solo le **pagine**. Eliminare mappa, sfondo o brano è definitivo; i file in `assets/` non vengono mai cancellati (restano come orfani).
- Mappe: tutti gli sfondi sono stirati sul riquadro della prima immagine; in modalità ciclica compare una linea sottile alla giunzione delle copie
  (arrotondamento dei pixel) e le copie degli elementi si aggiornano al salvataggio, non durante il trascinamento. Le copie sono solo a ±1 larghezza.
- Frontmatter non YAML completo (una riga per chiave).
- Il testo dei link non segue la rinomina se il titolo contiene caratteri che il markdown escapa.
- Ricerca: confronto di sottostringhe, non indicizzata (può rallentare con migliaia di pagine).
- Pagine e mappe sono caricate tutte in memoria all'apertura.
- Nessun test automatico; TypeScript non stretto.
- `window.open` nativo per l'esportazione (il browser può bloccare la finestra di stampa).

---

## 11. Roadmap

**Pagine madre e periodi** (0.9): fatti i passi 1 (campo `parent`, pannello «Periodi»), 2 (timeline e grafo) e 3 (cronologia dei sovrani); vedi §14. Resta **da valutare**: le mappe nel tempo. Un elemento di mappa è già collegato a una pagina e la pagina ha già delle date, quindi un cursore temporale potrebbe mostrare solo gli elementi la cui pagina è valida in quella data (una sola fonte di verità), con sfondi che hanno a loro volta un periodo di validità. Altre idee: mandato «in corso» senza fine esplicita, madre che mostra nel grafo i periodi raccolti in un solo nodo.

Da fare, per area:

- **Editor**: link con testo alternativo, modelli di pagina, ridimensionamento delle immagini a trascinamento, didascalie, tasto destro sulla barra di formattazione.
- **Dati**: ordinamento manuale di pagine e cartelle, rilevamento di modifiche esterne, protezione da due schede, backup/esportazione dell'intero mondo,
  cestino per mappe e brani, pulizia degli asset orfani, ricerca indicizzata.
- **Mappe**: sfondi con proporzioni diverse (adattamento senza stiramento), copie ±2 degli elementi, aggiornamento live delle copie durante il trascinamento.
- **Qualità**: test automatici, TypeScript in modalità stretta, navigazione da tastiera nell'albero.

---

## 12. Novità della 0.7

Anche queste modifiche sono state scritte senza poterle eseguire (stessa condizione descritta all'inizio): sono da provare con i punti 12–15 della prova rapida (§9).

- **Conferme**: tutti i `confirm()` nativi sono sostituiti da `useConfirm()` (`ui.tsx`): pagina nel cestino, cartella, eliminazione definitiva dal Cestino, sfondo, livello e mappa.
- **Cartelle**: contatori ricorsivi; vista dell'elenco per gruppo (cartelle singole nascoste o in vista, «Mostra solo questa», pagine senza cartella, contatori, elenco unico: tutto in `useSettings`); menu contestuale anche sulle pagine; colori con tre stati (eredita / nessuno / proprio) e «Applica alle sottocartelle». Sidebar, Timeline e Grafo usano ora tutti `folderColor`, quindi mostrano lo stesso colore ereditato.
- **Mappe ⇄ pagine**: icona di mappa sulle schede della timeline, sezione «Sulle mappe» nel pannello della pagina, e `/map/:id?f=<elemento>` che apre la mappa centrata su un elemento (`focusRef` in `MapView.tsx`).
- **Grafo**: lo zoom con rotella/pinch non ingrandisce più la pagina del browser (prima il listener React era passivo e non poteva fermarla), è ancorato al cursore, scende fino a 0,05 e ci sono i pulsanti −, +, «Tutto».
- **Dati**: `flushSaves()` alla chiusura/nascondimento della scheda; il ripristino dal Cestino scrive il file in `pages/` prima di toglierlo da `.trash/`; `readMeta` distingue `world.json` assente (mondo nuovo) da illeggibile (l'apertura fallisce con un messaggio e il file non viene toccato); i tag scritti a mano (`[a, b]`, `a, b`) sono letti come array invece di far cadere l'app (`tagsOf`).

---

## 13. Novità della 0.8

Come per la 0.7, scritte senza poterle eseguire: da provare con i punti 16–20 della prova rapida (§9).

- **Tag a dizionario**: un tag è una stringa `Categoria:valore` (prima `:` = separatore) oppure semplice; `tagKey`, `tagVal`, `normTag` in `types.ts`. Nessuna migrazione: i tag esistenti restano validi. L'editor dei tag (`TagEditor`, `Tags.tsx`) è a etichette con suggerimenti (categorie, tag già usati) e salva subito, senza aspettare di uscire dal campo. Nella timeline sono raggruppati per categoria; la selezione `Categoria:*` prende tutti i valori.
- **Tipo della pagina**: `Combo` (`Tags.tsx`) al posto del `<datalist>` del browser; mostra quante pagine usano ciascun tipo, frecce + Invio.
- **Timeline, filtri**: una selezione di un tag/tipo/cartella che non esiste più (cambiato o tolto da una pagina, cartella eliminata) restava attiva senza il pulsante per toglierla e svuotava la timeline. Ora `useEffectiveFilters` la ignora e il pannello la rimuove dalla selezione.
- **Rientranza** (sostituita dalla versione a blocco nella 0.10, §15; i `&emsp;` già scritti restano validi): `indent.ts`. Una rientranza = due spazi lunghi (U+2003) a inizio paragrafo, salvati nel `.md` come `&emsp;&emsp;` (`toFile` in `Editor.tsx`) perché il lettore markdown elimina gli spazi Unicode a inizio paragrafo ma non le entità. Tab e Maiusc+Tab, più due pulsanti nella barra; non agiscono in elenchi, tabelle e codice. **Da verificare per primo**: che il lettore decodifichi `&emsp;` a inizio paragrafo e la rientranza sopravviva al riavvio.
- **Dizionario e correttore**: `spell.ts` + `Dictionary.tsx`. Il dizionario (`dictionary` in `world.json`, `addWords`/`removeWord` nello store) contiene le parole inventate; il vocabolario del correttore somma dizionario, titoli e valori dei tag. Si segnalano i refusi (distanza 1, 2 oltre le 9 lettere), non le parole sconosciute: nomi in maiuscolo solo a metà frase, parole minuscole solo contro il dizionario scritto a mano. Falso allarme noto: un nome comune scritto in maiuscolo come titolo («Regno») segnala varianti come «Regni»; si risolve con «Aggiungi al dizionario». Impostazioni `spell` e `nativeSpell` (spegne il correttore del browser, che sottolinea in rosso le parole inventate).

---

## 14. Novità della 0.9

Come per le versioni precedenti, scritte senza poterle eseguire: da provare con i punti 21–24 della prova rapida (§9).

**Modello.** Una pagina può avere una **madre** (`parent` nel frontmatter): è un periodo, un governo, una rifondazione o un mandato della stessa entità («Polonia» → «Seconda Repubblica» → «Presidente X»). La figlia ha data, fine, testo, tag e link propri. Le cartelle organizzano, la madre indica la stessa entità nel tempo: sono due gerarchie distinte e la figlia resta nella sua cartella. Helper in `types.ts`: `parentOf`, `childrenOf`, `descendantsOf`, `ancestorsOf`, `rootOf`, `isRuler`, `byDate`; tutti a prova di cicli scritti a mano nei file.

- **Pagina**: «Periodo di (pagina madre)» nell'ingranaggio (`PagePick`, con ricerca; non propone la pagina stessa né le sue discendenti); percorso «Polonia › Regno ›» sopra il titolo.
- **Pannello destro**: «Parte di» (madre e altri periodi), «Periodi» (con l'esistenza complessiva, le interruzioni tra un periodo e l'altro e i pulsanti «+ Nuovo periodo» e «+ Nuovo sovrano») e «Sovrani».
- **Sovrani**: sono i discendenti con tipo `Sovrano`, `Sovrana`, `Monarca`, `Re`, `Regina`, `Imperatore`, `Imperatrice`, `Reggente` oppure tag `Ruolo:<uno di questi>` (elenco `RULERS` in `types.ts`). La cronologia dà la durata di ogni mandato (`durLabel` in `calendar.ts`) e segnala interregni (vuoto tra la fine di uno e l'inizio del successivo; un giorno di distanza conta come continuità) e co-reggenze (sovrapposizione). Un mandato senza data di fine non genera segnalazioni.
- **Timeline**: la famiglia di una pagina (madre e periodi con data) resta sulla stessa corsia, che nessun'altra pagina occupa nei vuoti; un tratteggio mostra l'interruzione. Se due periodi si sovrappongono il secondo passa a un'altra corsia. Le schede mostrano «Madre · Periodo». La madre senza data non compare: la rappresentano i periodi.
- **Grafo**: arco tratteggiato dorato, senza freccia, tra madre e periodo (più corto degli altri nella simulazione); conta per la dimensione dei nodi.
- **Non incluso**: mappe nel tempo (§11), i periodi non compaiono annidati nella barra laterale (restano nelle loro cartelle).

---

## 15. Novità della 0.10

Scritte senza poterle eseguire: da provare con i punti 25–27 della prova rapida (§9).

- **Rientranza a blocco** (`indent.ts`): l'intero paragrafo si sposta a destra di un certo numero di pixel (attributo `indent` del paragrafo, a passi di 24 px, massimo 480; `IndentParagraph` sostituisce il paragrafo di StarterKit). Nel file il paragrafo è racchiuso tra `<<` e `>>`: `<<testo>>` (24 px) oppure `<<48|testo>>`. Si scrive con `storage.markdown.serialize`; in lettura markdown-it (con `html: false`) restituisce `<<` e `>>` codificati come `&lt;` e `&gt;` e `parse.updateDOM` li riconosce, li toglie e imposta `data-indent`. Altri programmi mostrano le parentesi. Comandi: Tab / Maiusc+Tab, pulsanti ⇥ ⇤, Backspace a inizio paragrafo, regola di digitazione `<<` + spazio (o `<<48` + spazio). Non agisce in elenchi e tabelle. Il vecchio `&emsp;` (prima riga) non si genera più, ma `toFile` in `Editor.tsx` continua a proteggere quelli già presenti.
- **Correttore interno al posto di quello del browser**: `nativeSpell` è spento per default (la versione 2 delle impostazioni lo spegne anche a chi lo aveva acceso). Il vocabolario ora comprende anche il testo di tutte le pagine (conteggio per pagina in cache, ricalcolato con 600 ms di ritardo): una parola usata almeno due volte è una scelta dell'autore e non viene segnalata; si segnalano parole quasi uguali a una usata spesso (≥ 3 volte) o all'elenco di base, con la differenza fuori dall'ultima lettera (altrimenti plurali e coniugazioni: gatto/gatti). Elenco di base opzionale: `public/dizionario-it.txt` (una parola per riga, vanno bene le righe `parola/flag` di hunspell; **non incluso**, perché non c'era nessun dizionario di lingua utilizzabile e ha una sua licenza); con l'elenco si segnalano anche le parole sconosciute senza parole vicine, senza l'elenco il correttore impara dal testo del mondo ed è quindi prudente nei mondi piccoli. La finestra del Dizionario mostra se l'elenco è stato trovato.
- **Pagine madri come cartelle** (`Sidebar.tsx`): una pagina con sottopagine ha la freccia e il contatore; le sottopagine stanno sotto di lei in ordine di data e non nella propria cartella (`hasParent`, `df`). Il contatore delle cartelle e la vista per gruppo usano la cartella della pagina più in alto della famiglia. Aprire una sottopagina apre le madri chiuse. Trascinare una pagina su un'altra la rende sua sottopagina (`dropOnPage`, niente cicli); trascinarla su una cartella o scegliere «Sposta in…» la stacca (`moveTo`). Menu della pagina: «Nuova sottopagina», «Rendi indipendente». La visione piatta (ricerca o cartelle spente) non annida.

---

## 16. Novità della 0.11

Scritte senza poterle eseguire: da provare con i punti 28–32 della prova rapida (§9).

- **Proprietà della pagina**: il pannello ha altezza massima (70% della finestra) e scorre; i tag sono in un contenitore che scorre per conto suo (`Popover` in `ui.tsx`, `TagEditor` in `Tags.tsx`).
- **Legenda del grafo**: a sinistra «Colore = cartella» (le cartelle con pagine, con il colore effettivo anche ereditato; quelle grigie si omettono, scorre se lunga); a destra «Collegamenti» con un campione disegnato per ogni tipo (a senso unico, reciproco, dagli appunti punteggiato, madre → sottopagina tratteggiato dorato) e la regola della dimensione dei nodi.
- **Collegamenti nei metadati**: campo `links` (id) della pagina, `PagePick` nella sezione «Note e collegamenti» del pannello destro. Entrano in «Collegata da», in «Collegamenti in uscita» e nel grafo (`kind: 'meta'`, punteggiato; con il collegamento inverso diventano reciproci come quelli del testo). Non c'è sincronizzazione dei titoli: sono id.
- **Pagina in una cartella e sottopagina insieme**: una pagina con madre sta sempre sotto la madre e, se ha una cartella propria diversa da quella in cui compare la madre, anche in quella cartella (`pagesIn`, `place` in `Sidebar.tsx`); «Sposta in…» e il trascinamento su una cartella ora cambiano solo la cartella e non staccano più dalla madre («Rendi indipendente» la stacca). Nel pannello della madre, «Collega una pagina esistente» imposta `parent` su una pagina qualsiasi (non su se stessa né sulle sue madri). I contatori contano ogni pagina una volta, nella sua cartella o altrimenti sotto la madre.
- **Mappe, aree non confinanti**: più elementi con lo stesso `properties.group` formano un'area (`gk`, `parts`, `mainOf`, `setAll` in `MapView.tsx`). «＋ Aggiungi un'altra parte» nella scheda di un confine avvia il disegno di un poligono che eredita nome, colore, livello e pagina (`joinRef`); la scheda mostra il numero di parti e permette di staccarne una o eliminarle tutte; l'elenco a destra ha una riga per area; il focus inquadra tutte le parti; «Timeline» e «Sulle mappe» contano l'area una volta.
- **Mappe, nomi**: il nome è testo (`tip`/`label`, nessun HTML), al centro nei poligoni e a destra nei segnaposto; compare una volta per area, sulla parte più grande; la dimensione segue lo zoom (`--label-size`, 9–18 px); la casella «Nomi» li nasconde. I segnaposto sono costruiti come nodi DOM.

---

## 17. Novità della 0.12

Scritte senza poterle eseguire: da provare con i punti 33–38 della prova rapida (§9).

**Specializzazione per tipo.** Finora le funzioni speciali (periodi, sovrani, date) erano sempre visibili su ogni pagina. Ora il **tipo** della pagina sceglie una **scheda** (`kinds.ts`):
- una scheda è un elenco di campi (`text`, `date`, `choice`, `page`, `pages`), i nomi delle due date della timeline e un eventuale *preset* che accende sezioni (`personaggio` → «Famiglia» e la sezione Personaggi; `entita` → «Periodi» e «Sovrani»);
- le schede si definiscono per mondo in `world.json` → `schemas` dalla finestra **Tipi** (`TypesModal.tsx`); finché un tipo non ha una voce valgono i preset per i nomi più comuni (`BY_TYPE`: Personaggio, Persona, Sovrano, Re, Regina, Imperatore… → personaggio; Regno, Stato, Impero, Repubblica, Nazione, Ducato, Principato → entità; Casato, Casata, Dinastia, Famiglia, Clan, Stirpe → casato). Il confronto non distingue maiuscole e minuscole;
- i valori stanno nella pagina, in `fields` (§5.1): cambiare la scheda non cancella i valori già scritti, che tornano visibili se il campo ricompare;
- i campi `page`/`pages` sono collegamenti nei metadati (`refsOf`): contano per «Collegata da», «Collegamenti in uscita» e per il grafo (punteggiato). Con un nome in `inverse` e senza `role`, l'altra pagina mostra una sezione con quel nome (`inverseRows`): «Alleato di» su un luogo → «Alleati» sul regno;
- con `role` (`parent`, `spouse`) il campo alimenta la famiglia (`famOf`): genitori e coniugi si scrivono una volta; **figli, fratelli e il coniuge reciproco si ricavano** dalle altre pagine, quindi la parentela non si trasforma in una ragnatela di collegamenti scritti a mano;
- le sezioni «Periodi» e «Sovrani» compaiono per le entità politiche e per le pagine che già hanno periodi o sovrani (cambio di comportamento: prima compariva su ogni pagina; per cominciare su una pagina qualsiasi basta «Nuova sottopagina» dal menu della barra laterale).

**Sezione Personaggi** (`Characters.tsx`, rotte `/characters` e `/characters/:id`): elenco dei personaggi a sinistra; a destra l'albero della famiglia del selezionato, fino a tre generazioni sopra (genitori, nonni, bisnonni) e sotto (figli, nipoti, pronipoti), con fratelli e coniugi accanto. Le generazioni si calcolano con `famOf` e sono a prova di cicli. I pulsanti «+ Padre», «+ Madre», «+ Coniuge», «+ Figlio (padre)», «+ Figlio (madre)» creano la pagina (stesso tipo e cartella) e scrivono il legame nel campo giusto; il nome si digita sulla scheda appena creata.

**Duplicare una mappa** (`duplicateMap` nello store, pulsante «Duplica» accanto al titolo): copia profonda del documento (livelli, elementi, aree con più parti, sfondi, ciclica) con titolo «… (copia)»; gli sfondi condividono i file in `assets/`.

**Non incluso / da valutare**: campi che dipendono dal tipo di un altro campo, modelli di pagina (testo iniziale per tipo), viste tabellari dei campi (una tabella di tutti i luoghi con i loro campi), generi dei personaggi (oggi «+ Figlio» chiede se il genitore è padre o madre), parentele non binarie o adottive oltre ai campi con ruolo personalizzati.

---

## 18. Novità della 0.13

La 0.12 è stata la prima eseguita davvero: ha mostrato un errore (§ convenzioni: file `Types.tsx` e `types.ts` in conflitto su Windows, ora `TypesModal.tsx`). Le novità qui sotto sono di nuovo scritte senza poterle eseguire: da provare con i punti 39–42 della prova rapida (§9).

- **Albero dei personaggi, correzione**: la card del personaggio centrale compariva come testo letterale `card(p, true)` (mancavano le graffe in `<Row>{card(p, true)}</Row>`).
- **Grafo meno intricato** (`Graph.tsx`):
  - *Disposizione*: repulsione e lunghezza dei legami crescono con il numero di collegamenti della pagina (i nodi-snodo si aprono), due leggere forze verso il centro (`forceX`, `forceY`) tengono vicini anche i gruppi separati, collisione più ampia, 400 passi di simulazione; con «Raggruppa per cartella» ogni cartella ha un punto di attrazione su una circonferenza.
  - *Filtri* (pannello «Filtri e vista», salvati in `useSettings.graph`): collegamenti nel testo, da appunti e schede, madre → sottopagina; pagine senza collegamenti; raggruppamento. Il layout si ricalcola e il grafo si reinquadra a ogni cambio.
  - *Vicinato*: solo le pagine entro 1–3 passi da una pagina scelta (campo con ricerca, oppure Maiusc + clic su un nodo); stato locale, non salvato.
  - *Resa*: con molti collegamenti le linee si fanno più tenui (>50 e >120), le frecce compaiono da 0,6× di zoom in su o su un nodo evidenziato, i nomi si mostrano per soglie di collegamenti legate allo zoom (da lontano solo gli snodi), con dimensione che segue lo zoom; con i filtri che nascondono tutto compare un messaggio.
- **Icona del sito**: `public/favicon.svg` (libro aperto con stella dorata), `favicon.ico` (16–64 px), `apple-touch-icon.png` (180 px), `icon-512.png`; collegate in `index.html` con il colore del tema. La stessa grafica è il componente `Logo` (`ui.tsx`), mostrato nella schermata iniziale. I PNG e l'ICO sono stati disegnati con PIL a partire dalla stessa geometria dell'SVG, perché nell'ambiente non c'era un convertitore SVG.
- **Cartella `public/`**: creata; ospita anche l'eventuale `dizionario-it.txt` (§15).

---

## 19. Novità della 0.14

Scritte senza poterle eseguire: da provare con i punti 43–48 della prova rapida (§9).

- **Stelle** (`star` nel frontmatter, `Page.star`): pulsante ★/☆ accanto al titolo della pagina e voce nel menu della pagina; ★ nelle righe della barra laterale, elenco «★ Principali» in cima (`useSettings.starsTop`, comprimibile come una cartella con la chiave `__stars` in `closed`), opzione «Solo le pagine con la stella» (`onlyStars`: elenco piatto), anello dorato e nome sempre visibile nel grafo (con riga in legenda), ★ davanti al nome nella timeline, ★ nell'elenco dei personaggi. Una pagina con la stella resta nell'elenco «Principali» anche se la sua cartella è nascosta; solo nasconderla lei stessa la toglie.
- **Nascondere pagine e sottopagine** (`useSettings.hiddenPages`, in `Sidebar.tsx`): come per le cartelle, una pagina nascosta sparisce dall'elenco con le sottopagine annidate sotto di lei (`pageHidden`, `underHidden`); se una sottopagina compare anche in una sua cartella (§16) lì resta visibile, a meno che non sia nascosta lei stessa (`ownPlace`). «Nascondi le sottopagine» nasconde i figli diretti senza nascondere la madre. Si gestiscono da «Vista dell'elenco» (casella di ricerca per nascondere una pagina, etichette con × per mostrarla di nuovo); i contatori e l'elenco piatto ne tengono conto; la ricerca no; «Mostra tutte» (e il suggerimento in fondo alla barra) ripristina cartelle e pagine.
- **Casato** (scheda `casato` in `kinds.ts`): il personaggio ha il campo `casato` (una pagina, ruolo `house`); la pagina Casato (tipo Casato, Casata, Dinastia, Famiglia, Clan, Stirpe) ha Motto, Sede, i nomi di date Fondazione/Estinzione e la sezione **Membri** (`MembersBlock` in `Fields.tsx`): chi la indica nella propria scheda, con anni di vita, con aggiunta di un personaggio esistente, rimozione e «+ Nuovo personaggio del casato». Dalla scheda di un personaggio «+ Crea una pagina Casato» crea e collega la pagina e la apre per dargli nome e storia; nella sezione Personaggi: pulsante «+ Casato», «Estendi ai discendenti» (assegna il casato a chi non ne ha uno, fino a 12 generazioni, `houseFieldOf`/`houseOf`/`membersOf`), filtro per casato nell'elenco, nome del casato nelle card dell'albero e nel blocco «Famiglia». Il collegamento personaggio → casato è un collegamento nei metadati (grafo, «Collegata da»). Una scheda «Personaggio» già modificata e salvata in `world.json` non riceve da sola il nuovo campo: si aggiunge da «Tipi» (campo pagina) o con «Ripristina».


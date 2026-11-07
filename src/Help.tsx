import { useState } from 'react'
import { IconBtn, Icon, Modal } from './ui'

const SECTIONS: [string, string[]][] = [
  ['Mondi e file', [
    'Un mondo è una cartella sul tuo disco. Dentro: pages/ (un file .md per pagina) e assets/ (immagini).',
    'Puoi fare backup o versionare la cartella con git. A ogni sessione il browser chiede di riconfermare il permesso di accesso.',
    'Funziona su Chrome, Edge e Brave.',
  ]],
  ['Collegamenti', [
    'Digita [[ nell\'editor (o usa il pulsante [[ nella barra) e scegli una pagina. Se il titolo non esiste, puoi crearla al volo.',
    'Clicca un link per aprire la pagina. I link usano l\'ID: rinominare una pagina non li rompe.',
    'Il pannello Collegamenti mostra chi punta alla pagina e verso cosa punta.',
    "«Sulle mappe» elenca gli elementi di mappa collegati alla pagina: un clic apre la mappa e li raggiunge.",
  ]],
  ['Immagini', [
    'Incolla o trascina un\'immagine nell\'editor: viene copiata in assets/.',
    'Cliccala: nella barra in alto compaiono posizione (sinistra, centro, destra, larga) e larghezza; il testo le scorre intorno. Clicca nel testo per tornare alla formattazione. Trascinala per spostarla tra i paragrafi.',
  ]],
  ['Cartelle', [
    'Il pulsante con la cartella ne crea una e la nomini direttamente nell\'elenco (Invio conferma, Esc annulla). Doppio clic su una cartella per rinominarla. Trascina pagine e cartelle per spostarle (anche sulla zona vuota per riportarle alla radice).',
    "Tasto destro su una cartella: nuova pagina o sottocartella, rinomina, colore, elimina. Il colore si eredita nelle sottocartelle: «Eredita dalla cartella madre» è la scelta normale, «Nessun colore» interrompe l'ereditarietà, «Applica alle sottocartelle» fa seguire a tutte quelle sotto il colore della cartella.",
    "Tasto destro su una pagina: apri, duplica, sposta in una cartella, sposta nel cestino.",
    "Il numero accanto a una cartella conta le pagine in vista, comprese quelle delle sottocartelle.",
    "Per liberare spazio nell'elenco: tasto destro su una cartella → «Nascondi dalla vista» (nasconde anche le sue sottocartelle e le sue pagine) oppure «Mostra solo questa cartella». L'ingranaggio in alto nel pannello Pagine apre «Vista dell'elenco»: spunta o togli le cartelle una per una, o usa Tutte / Nessuna; da lì puoi anche nascondere le pagine senza cartella, i contatori o tutte le cartelle insieme (un unico elenco alfabetico). Le pagine non vengono toccate: cambia solo cosa vedi. La ricerca cerca sempre in tutte le pagine.",
  ]],
  ['Grafo', ['Il pulsante grafo mostra tutte le pagine e i loro collegamenti, colorati per cartella. Una freccia indica la direzione del link; frecce da entrambi i lati (in colore accento) indicano un collegamento reciproco. Rotella (o pinch sul trackpad) per lo zoom sul punto del cursore, senza ingrandire la pagina; in alto a destra ci sono − e + e «Tutto» per inquadrare tutte le pagine. Trascina lo sfondo per spostarti, clic su un nodo per aprire la pagina. «Filtri e vista» (in alto a sinistra) riordina un grafo intricato: si possono nascondere i collegamenti nel testo, quelli da appunti e schede e quelli madre → sottopagina, nascondere le pagine senza collegamenti, raggruppare le pagine per cartella, oppure mostrare solo il vicinato di una pagina (da 1 a 3 passi; anche con Maiusc + clic su un nodo). Da lontano compaiono solo i nomi delle pagine più collegate e le frecce si vedono ingrandendo; passando il mouse su un nodo si evidenziano i suoi collegamenti.']],
  ['Pagine', [
    'L\'ingranaggio accanto al titolo apre le proprietà: cartella, tipo, tag, eliminazione. Il tipo è testo libero: i suggerimenti mostrano quelli già usati (con quante pagine li hanno), si scorrono con le frecce e Invio sceglie, ma puoi scriverne di nuovi. I tag sono etichette: scrivi «Categoria:valore» (Cultura:Europea, Moneta:fiorino) oppure un tag semplice (Animale), poi Invio o virgola; i tag già usati e le categorie si suggeriscono mentre scrivi. Nella timeline i tag sono raggruppati per categoria e cliccando il nome della categoria selezioni tutti i suoi valori.',
  ]],
  ['Aspetto', ['Il pulsante Aa nella barra regola tema, carattere, dimensione, interlinea e larghezza della pagina.']],
  ['Scorciatoie', [
    "Pagine madre e periodi: dall'ingranaggio di una pagina scegli «Periodo di» per dire che appartiene a un'altra (la Seconda Repubblica a «Polonia»). Nel pannello a destra la madre mostra i suoi periodi con l'esistenza complessiva e le interruzioni, e i pulsanti «+ Nuovo periodo» e «+ Nuovo sovrano». I sovrani (tipo Sovrano, Re, Regina, Imperatore, Monarca, Reggente, oppure tag Ruolo:Sovrano) compaiono in una cronologia con la durata del mandato, gli interregni e le co-reggenze. Nella timeline una famiglia di pagine sta sulla stessa corsia con un tratteggio per le interruzioni; nel grafo i periodi sono collegati alla madre da un tratteggio dorato. Nella barra laterale una pagina con sottopagine si apre come una cartella (freccia): le sottopagine stanno sotto di lei in ordine di data. Trascina una pagina su un'altra per renderla sua sottopagina; tasto destro: «Nuova sottopagina» e «Rendi indipendente».",
    "Collegamenti nei metadati: nel pannello a destra, sezione «Note e collegamenti», scegli una pagina da collegare senza scrivere [[…]] nel testo. Contano come i collegamenti del testo (pannelli «Collegata da» e «Collegamenti in uscita») e nel grafo compaiono come frecce punteggiate. Una pagina esistente, anche di un'altra cartella (per esempio un sovrano in «Personaggi»), può diventare periodo o sovrano di un'altra: nel pannello della madre, «Collega una pagina esistente»; resta nella sua cartella e compare anche sotto la madre.",
    "Stelle: la stella accanto al titolo (o «Segna come principale» dal tasto destro) segna le pagine principali. Compaiono in cima all'elenco, in «★ Principali», e con un anello dorato nel grafo e una stella nella timeline; da «Vista dell'elenco» puoi nascondere quell'elenco o mostrare solo le pagine con la stella.",
    "Nascondere pagine: tasto destro su una pagina → «Nascondi dalla vista» (nasconde con lei le sue sottopagine) oppure «Nascondi le sottopagine». Le pagine nascoste si gestiscono da «Vista dell'elenco», dove si può anche cercarne una da nascondere; la ricerca le trova comunque. Una sottopagina che sta anche in una sua cartella resta visibile lì.",
    'Ctrl/⌘ + K: cerca e apri una pagina.',
    'Ctrl/⌘ + B / I: grassetto / corsivo.',
    "Rientranza: Tab / Maiusc + Tab (o i pulsanti ⇥ ⇤ della barra) spostano a destra l'intero paragrafo di 24 px alla volta (fino a 480). Si può anche scrivere «<<» seguito da spazio a inizio paragrafo, oppure «<<48» e spazio per 48 px. Nel file il paragrafo diventa <<testo>> oppure <<48|testo>>. Dentro elenchi e tabelle Tab mantiene il suo significato abituale; Backspace a inizio paragrafo toglie un passo.",
    "Dizionario (in basso nel pannello Pagine): sostituisce il correttore del browser, che ora è spento perché non conosce le parole inventate. Sono corrette le parole che aggiungi, i titoli delle pagine, i valori dei tag e le parole usate almeno due volte nel mondo. In giallo compaiono i probabili refusi (Arvenorr al posto di Arvenor): tasto destro per correggere o per aggiungere la parola. Per segnalare anche le parole sconosciute della lingua, metti un elenco di parole italiane (una per riga) in public/dizionario-it.txt.",
    'Markdown mentre scrivi: "# " titolo, "## " sottotitolo, "- " elenco, "1. " elenco numerato, "> " citazione, "---" linea.',
  ]],
  ["Personaggi e tipi di pagina", [
    "Il tipo di una pagina decide la scheda che offre. In «Tipi» (in basso nel pannello Pagine) vedi i tipi del mondo e per ognuno scegli una scheda predefinita (Personaggio, Entità politica) oppure definisci campi propri: testo, data, scelta, una pagina o più pagine (con il nome della relazione inversa, per esempio «Alleato di» e «Alleati»). Le pagine con quel tipo mostrano i campi nel pannello a destra e usano i nomi delle date della scheda (Nascita e Morte per i personaggi).",
    "Personaggio: la scheda ha Padre, Madre, Coniugi o partner e Titolo. Figli, fratelli e sorelle non si scrivono: si ricavano dai genitori delle altre pagine, quindi la parentela si dichiara una volta sola e non diventa una ragnatela di collegamenti. Sono personaggi anche le pagine di tipo Re, Regina, Sovrano, Imperatore e simili.",
    "La sezione Personaggi (barra a sinistra) elenca i personaggi e mostra l'albero della famiglia del selezionato: fino a tre generazioni sopra e sotto, con fratelli e coniugi. Clic sul nome per centrare l'albero su di lui, «pagina» per aprire la sua pagina. I pulsanti in alto creano subito un padre, una madre, un coniuge o un figlio e ne scrivono il legame; il nome si digita sulla scheda appena comparsa.",
    "Casato: una pagina di tipo Casato (anche Dinastia, Famiglia, Clan, Stirpe) dà un nome e una storia a un gruppo di personaggi. Dalla scheda di un personaggio, «+ Crea una pagina Casato» ne crea una e la collega; nella sezione Personaggi il pulsante «+ Casato» fa lo stesso, e «Estendi ai discendenti» assegna il casato a figli e nipoti che non ne hanno uno. La pagina del casato elenca i membri (con anni di vita), permette di aggiungerne o toglierne e di creare un nuovo personaggio del casato; l'elenco dei personaggi si può filtrare per casato e ogni card dell'albero mostra il suo.",
    "Entità politica: le pagine di tipo Regno, Stato, Impero, Repubblica, Nazione, Ducato, Principato offrono i periodi e la cronologia dei sovrani. Le altre pagine mostrano quelle sezioni solo se ne hanno già.",
  ]],
  ["Mappe", [
    "Dalla sezione Mappe crei una mappa partendo da un'immagine. La barra sopra la mappa ha gli strumenti: segnaposto, rotta (clic su ogni punto, clic sull'ultimo per terminare), confine (clic sul primo punto per chiudere), modifica forma, sposta, elimina. Esc torna alla selezione.",
    "Con lo strumento Seleziona clicca un elemento: nome, colore, livello e pagina collegata. Il colore dell'elemento ha la precedenza su quello del livello, così un livello (es. Confini) può contenere tanti regni di colori diversi.",
    "Nel pannello a destra ogni livello elenca i suoi elementi: clicca per raggiungerli sulla mappa. Il pannello si allarga trascinandone il bordo.",
    "Gli Sfondi sono immagini sovrapposte (visibilità, opacità e ordine propri), separate dai disegni. Per ricalcare: carica l'immagine con le linee, disegna, poi aggiungi la mappa pulita e nascondi o rimuovi quella di riferimento. Le immagini vengono adattate allo stesso riquadro della prima, quindi devono avere le stesse proporzioni.",
    "Duplica (accanto al titolo della mappa): crea una copia con livelli, elementi, aree con più parti, sfondi e impostazioni, e la apre. Gli sfondi usano gli stessi file.",
    "Aree non confinanti: un regno con possedimenti lontani dalla regione principale è un'unica area fatta di più parti. Disegna il confine principale, clic sull'area e «＋ Aggiungi un'altra parte», poi disegna la parte separata. Nome, colore, livello e pagina valgono per tutte le parti, il nome compare una sola volta (sulla parte più grande) e nell'elenco a destra l'area è una riga sola con «N parti». Dalla scheda puoi anche rendere indipendente una parte o eliminare l'area intera.",
    "I nomi sulla mappa si leggono come testo (anche con simboli come < e >), seguono lo zoom (più piccoli da lontano) e si nascondono con la casella «Nomi» accanto al titolo.",
    "Con \"Mondo ciclico\" (accanto al titolo) la mappa si ripete in orizzontale: scorrendo verso est si torna al punto di partenza. Gli elementi disegnati oltre il bordo vengono riportati nel riquadro principale e se ne vedono copie a est e a ovest.",
  ]],
  ["Timeline", [
    "Dall'ingranaggio di una pagina imposti una data (e una fine opzionale). Ctrl/⌘ + rotella o lo slider cambiano lo zoom; \"Tutto\" e le etichette delle ere adattano la vista. La striscia in alto è una panoramica cliccabile.",
    "Le pagine collegate a un elemento di mappa mostrano una piccola icona di mappa: un clic apre la mappa su quell'elemento.",
    "Cerca e filtra per cartella, tipo e tag dal pannello a sinistra. Ere, mesi e nome dell'era si definiscono dal pulsante Calendario.",
  ]],
  ["Musica", [
    "Il pulsante con la nota apre il lettore. Aggiungi file audio (copiati nella cartella music/ del mondo) oppure link diretti a un file o a una radio in streaming. La musica continua mentre cambi pagina.",
  ]],
  ["Editor", ["Dalla barra: tabelle (con comandi per righe e colonne quando il cursore è dentro) e liste di attività con caselle da spuntare."]],
  ["Cestino ed esportazione", [
    "Le pagine eliminate vanno nel Cestino (in basso nel pannello Pagine) e si possono ripristinare. Mappe e brani musicali, invece, si eliminano definitivamente.",
    "Dall'ingranaggio di una pagina, \"Esporta in PDF\" apre la stampa: scegli \"Salva come PDF\".",
  ]],
  ["Pannelli", ["Trascina il bordo dei pannelli laterali per cambiarne la larghezza; i pulsanti in alto li nascondono."]],
  ['Note', ['Il campo Note nel pannello di destra è un blocco appunti privato di ogni pagina, separato dal testo.']],
  ['Salvataggio', ['Automatico, circa mezzo secondo dopo l\'ultima modifica.']],
]

export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconBtn n="help" label="Guida" onClick={() => setOpen(true)} />
      {open && (
        <Modal onClose={() => setOpen(false)} wide>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-semibold">Guida</h2>
            <button onClick={() => setOpen(false)} aria-label="Chiudi" className="text-muted hover:text-ink"><Icon n="x" /></button>
          </div>
          <div className="grid gap-5 p-5">
            {SECTIONS.map(([t, items]) => (
              <section key={t}>
                <h3 className="mb-1.5 text-sm font-semibold">{t}</h3>
                <ul className="grid gap-1 text-sm text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

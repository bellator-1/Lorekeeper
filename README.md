# Lorekeeper

Gestionale locale per lore e worldbuilding: pagine collegate, mappe a livelli, timeline con calendario personalizzato,
grafo dei collegamenti, musica. Nessun server: ogni mondo è una cartella sul tuo disco (file markdown e JSON).

## Avvio

Requisiti: Node 18+, browser Chrome / Edge / Brave (servono le API di accesso alle cartelle).

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # build statica in dist/ (servibile da qualsiasi hosting HTTPS o da localhost)

`file://` non funziona (le API delle cartelle richiedono un contesto sicuro): usa `localhost` o HTTPS.

## Documentazione

Tutto è in [`docs/DOCUMENTAZIONE.md`](docs/DOCUMENTAZIONE.md): architettura, formato dei file, descrizione di ogni modulo,
riferimento delle API interne, ricette per estendere il progetto, tabella sintomo → file, stato di verifica e roadmap.
Le istruzioni d'uso per l'utente finale sono nell'app, pulsante «?».

import { useEffect, useState } from 'react'
import { useStore } from './store'
import { useSettings } from './settings'
import { Modal, field } from './ui'
import { loadBase } from './spell'

// Dizionario del mondo: le parole inventate (nomi, lingue) che il correttore deve conoscere. Si salva in world.json.
export default function DictionaryModal({ onClose }: { onClose: () => void }) {
  const { dictionary, addWords, removeWord } = useStore()
  const { spell, nativeSpell, set } = useSettings()
  const [text, setText] = useState(''), [q, setQ] = useState('')
  const [baseN, setBaseN] = useState<number | null>(null)
  useEffect(() => { loadBase().then((b) => setBaseN(b ? b.set.size : 0)) }, [])
  const add = () => { const ws = text.split(/[\s,;]+/).filter(Boolean); if (ws.length) addWords(ws); setText('') }
  const shown = dictionary.filter((w) => w.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Modal onClose={onClose}>
      <div className="grid gap-4 p-5">
        <h2 className="font-display text-xl">Dizionario del mondo</h2>
        <p className="text-sm text-muted">
          Questo dizionario sostituisce il correttore del browser, che non conosce le parole inventate. Contano come corrette le parole che aggiungi qui, i titoli delle pagine,
          i valori dei tag e ogni parola usata almeno due volte nel testo del mondo. Lorekeeper sottolinea in giallo i probabili refusi (per esempio «Arvenorr» al posto di
          «Arvenor», o una parola quasi uguale a una usata spesso): tasto destro sulla parola per correggerla o per aggiungerla al dizionario.
        </p>
        <p className="text-xs text-muted">
          Elenco di base della lingua: {baseN === null ? '…' : baseN > 0 ? `caricato (${baseN.toLocaleString('it')} parole)` : 'non presente'}.
          {baseN === 0 && ' Per segnalare anche le parole sconosciute della lingua, metti un elenco di parole italiane (una per riga) nel file public/dizionario-it.txt e riapri l\'app.'}
        </p>
        <div className="grid gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="accent-accent" checked={spell} onChange={() => set({ spell: !spell })} />Segnala i refusi dei nomi inventati</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="accent-accent" checked={nativeSpell} onChange={() => set({ nativeSpell: !nativeSpell })} />Correttore del browser (spento: sottolinea in rosso anche le parole inventate)</label>
        </div>
        <div className="flex gap-2">
          <input className={field} placeholder="Aggiungi parole (separate da spazio o virgola)…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={add} disabled={!text.trim()} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-40">Aggiungi</button>
        </div>
        {dictionary.length > 8 && <input className={field} placeholder="Filtra…" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="scroll-pretty flex max-h-56 flex-wrap content-start gap-1.5 overflow-auto rounded-lg border border-line p-2">
          {shown.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-0.5 text-sm">
              {w}<button aria-label={`Rimuovi ${w}`} onClick={() => removeWord(w)} className="text-muted hover:text-danger">×</button>
            </span>
          ))}
          {!shown.length && <p className="px-1 text-sm text-muted">{dictionary.length ? 'Nessun risultato.' : 'Ancora nessuna parola aggiunta.'}</p>}
        </div>
      </div>
    </Modal>
  )
}

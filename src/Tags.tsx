import { ReactNode, useState } from 'react'
import { normTag, tagKey, tagVal } from './types'

export type Opt = { value: string; hint?: string; id?: string }

const hl = (text: string, q: string): ReactNode => {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  return i < 0 ? text : <>{text.slice(0, i)}<mark className="bg-transparent font-semibold text-accent">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

// Elenco dei suggerimenti: si apre sotto il campo, si scorre con le frecce, Invio sceglie, il mouse non toglie il fuoco al campo.
function List({ items, sel, q, onPick, onHover }: { items: Opt[]; sel: number; q: string; onPick: (o: Opt) => void; onHover: (i: number) => void }) {
  if (!items.length) return null
  return (
    <ul role="listbox" className="scroll-pretty absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-lg border border-line bg-panel p-1 shadow-lg">
      {items.map((o, i) => (
        <li key={o.id ?? o.value} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); onPick(o) }} onMouseEnter={() => onHover(i)}
          className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm ${i === sel ? 'bg-accent/15' : ''}`}>
          <span className="truncate">{hl(o.value, q)}</span>
          {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
        </li>
      ))}
    </ul>
  )
}

// Campo di testo libero con suggerimenti (usato per il «Tipo» della pagina).
export function Combo({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false), [sel, setSel] = useState(-1)
  const q = value.trim().toLowerCase()
  const items = options.filter((o) => o.value.toLowerCase().includes(q)).slice(0, 30)
  const list = open && !(items.length === 1 && items[0].value.toLowerCase() === q) ? items : []
  const pick = (o: Opt) => { onChange(o.value); setOpen(false); setSel(-1) }
  return (
    <div className="relative">
      <input value={value} placeholder={placeholder} className={className} role="combobox" aria-expanded={list.length > 0} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setSel(-1) }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((s) => Math.min(list.length - 1, s + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)) }
          else if (e.key === 'Enter' && sel >= 0 && list[sel]) { e.preventDefault(); pick(list[sel]) }
          else if (e.key === 'Escape' && open) setOpen(false)
        }} />
      <List items={list} sel={sel} q={q} onPick={pick} onHover={setSel} />
    </div>
  )
}

// Tag come etichette. «Categoria:valore» (Cultura:Europea) oppure semplice (Animale). Le modifiche si applicano subito.
export function TagEditor({ tags, onChange, all }: { tags: string[]; onChange: (t: string[]) => void; all: string[] }) {
  const [text, setText] = useState(''), [open, setOpen] = useState(false), [sel, setSel] = useState(-1)
  const q = text.trim().toLowerCase()
  const have = new Set(tags)
  const keys = [...new Set(all.map(tagKey).filter(Boolean))].sort()
  const cand: Opt[] = [...keys.map((k) => ({ value: k + ':', hint: 'categoria' })), ...all.filter((t) => !have.has(t)).map((t) => ({ value: t }))]
  const items = open ? cand.filter((o) => (!q.includes(':') || !o.value.endsWith(':')) && (!q || (o.value.toLowerCase().includes(q) && o.value.toLowerCase() !== q))).slice(0, 30) : []
  const commit = (raw: string) => { const t = normTag(raw); if (t && !tags.includes(t)) onChange([...tags, t]); setText(''); setSel(-1) }
  const pick = (o: Opt) => { if (o.value.endsWith(':')) { setText(o.value); setSel(-1) } else commit(o.value) }
  return (
    <div className="relative">
      <div className="scroll-pretty flex max-h-28 flex-wrap items-center gap-1.5 overflow-y-auto rounded-md border border-line bg-paper p-1.5 focus-within:border-accent">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-xs text-ink">
            {tagKey(t) && <span className="text-muted">{tagKey(t)}:</span>}<span>{tagVal(t)}</span>
            <button type="button" aria-label={`Rimuovi ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted hover:text-danger">×</button>
          </span>
        ))}
        <input value={text} placeholder={tags.length ? '' : 'Cultura:Europea, Animale…'} autoComplete="off" className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          onChange={(e) => { setText(e.target.value); setOpen(true); setSel(-1) }} onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); if (text.trim()) commit(text) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)) }
            else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (e.key === 'Enter' && sel >= 0 && items[sel]) pick(items[sel]); else commit(text) }
            else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
            else if (e.key === 'Escape') setOpen(false)
          }} />
      </div>
      <List items={items} sel={sel} q={q} onPick={pick} onHover={setSel} />
    </div>
  )
}

// Scelta di una pagina per id, con ricerca per titolo (pagina madre). Il pulsante × toglie il legame.
export function PagePick({ value, onChange, options, className, placeholder }: { value: string; onChange: (id: string) => void; options: { id: string; title: string; hint?: string }[]; className?: string; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null), [sel, setSel] = useState(-1)
  const cur = options.find((o) => o.id === value)
  const q = (text ?? '').trim().toLowerCase()
  const items: Opt[] = text === null ? [] : options.filter((o) => !q || o.title.toLowerCase().includes(q)).slice(0, 30).map((o) => ({ id: o.id, value: o.title || 'Senza titolo', hint: o.hint }))
  const pick = (o: Opt) => { onChange(o.id!); setText(null); setSel(-1) }
  return (
    <div className="relative">
      <input value={text ?? cur?.title ?? ''} placeholder={cur ? cur.title : placeholder ?? 'Nessuna'} autoComplete="off" className={className}
        onChange={(e) => { setText(e.target.value); setSel(-1) }} onFocus={() => setText('')} onBlur={() => setText(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)) }
          else if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); pick(items[sel]) }
          else if (e.key === 'Escape') setText(null)
        }} />
      {cur && text === null && <button type="button" aria-label="Togli la pagina madre" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-danger">×</button>}
      <List items={items} sel={sel} q={q} onPick={pick} onHover={setSel} />
    </div>
  )
}


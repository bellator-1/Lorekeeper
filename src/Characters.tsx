import { ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Page, byDate } from './types'
import { famOf, houseFieldOf, houseOf, idsOf, schemaFor } from './kinds'
import { lifeOf } from './Fields'
import { Icon, field } from './ui'

const isChar = (schemas: any, p: Page) => schemaFor(schemas, p.type)?.preset === 'personaggio'

// Pannello sinistro: elenco dei personaggi (pagine il cui tipo ha la scheda «Personaggio»)
export function CharactersPanel({ activeId }: { activeId?: string }) {
  const nav = useNavigate()
  const { pages, schemas, calendar: cal, create, upsert } = useStore()
  const [q, setQ] = useState('')
  const [house, setHouse] = useState('')
  const houses = Object.values(pages).filter((p) => schemaFor(schemas, p.type)?.preset === 'casato').sort((a, b) => a.title.localeCompare(b.title))
  const inHouse = (p: Page) => !house || (house === '_none' ? !houseOf(pages, schemas, p) : houseOf(pages, schemas, p)?.id === house)
  const list = Object.values(pages).filter((p) => isChar(schemas, p) && inHouse(p) && p.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title))
  const add = () => { const c = create('Nuovo personaggio'); upsert({ ...c, type: 'Personaggio' }); nav('/characters/' + c.id) }
  return (
    <aside className="flex h-full flex-col gap-2 overflow-hidden p-3">
      <input className={field} placeholder="Filtra personaggi…" value={q} onChange={(e) => setQ(e.target.value)} />
      {houses.length > 0 && (
        <select className={field} value={house} onChange={(e) => setHouse(e.target.value)} aria-label="Filtra per casato">
          <option value="">Tutti i casati</option>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.title || 'Senza titolo'}</option>)}
          <option value="_none">Senza casato</option>
        </select>
      )}
      <button onClick={add} className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90"><Icon n="plus" size={16} /> Nuovo personaggio</button>
      <nav className="scroll-pretty -mx-1 mt-1 min-h-0 flex-1 overflow-auto px-1">
        {list.map((p) => (
          <Link key={p.id} to={'/characters/' + p.id} className={`flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${p.id === activeId ? 'bg-accent text-on-accent' : 'hover:bg-line/60'}`}>
            <span className="truncate">{p.title || 'Senza titolo'}{p.star && <span className="ml-1.5 text-gold">★</span>}</span><span className="shrink-0 text-xs opacity-70">{lifeOf(cal, p)}</span>
          </Link>
        ))}
        {!list.length && <p className="px-2 text-sm text-muted">{q ? 'Nessun risultato.' : 'Ancora nessun personaggio. Una pagina con tipo «Personaggio» (o Re, Regina, Sovrano…) compare qui.'}</p>}
      </nav>
    </aside>
  )
}

const Row = ({ label, children }: { label?: string; children: ReactNode }) => (
  <section className="grid justify-items-center gap-1.5">
    {label && <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{label}</h3>}
    <div className="flex flex-wrap justify-center gap-2">{children}</div>
  </section>
)
const Line = () => <div className="mx-auto h-4 w-px bg-line" />

// Albero della famiglia di un personaggio: fino a tre generazioni sopra e sotto; i legami si ricavano dalla scheda
export function CharactersView({ id }: { id?: string }) {
  const nav = useNavigate()
  const { pages, schemas, calendar: cal, create, upsert } = useStore()
  const [renaming, setRenaming] = useState<string | null>(null)
  const p = id ? pages[id] : undefined
  if (!id) return (
    <div className="mx-auto mt-[16vh] grid max-w-md justify-items-center gap-3 text-center">
      <p className="font-display text-2xl">Personaggi</p>
      <p className="text-sm text-muted">Scegli un personaggio dall'elenco per vedere la sua famiglia. I legami (genitori, coniugi) si scrivono nella scheda del personaggio; figli, fratelli e albero si ricavano da soli.</p>
    </div>
  )
  if (!p) return <p className="mt-[18vh] text-center text-muted">Personaggio non trovato.</p>
  const sc = schemaFor(schemas, p.type)
  if (sc?.preset !== 'personaggio') return (
    <div className="mx-auto mt-[16vh] grid max-w-md justify-items-center gap-3 text-center">
      <p className="font-display text-2xl">{p.title || 'Senza titolo'}</p>
      <p className="text-sm text-muted">Questa pagina non ha la scheda da personaggio (il suo tipo è «{p.type || 'nessuno'}»).</p>
      <button onClick={() => upsert({ ...p, type: 'Personaggio' })} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90">Usa il tipo «Personaggio»</button>
    </div>
  )

  const uniq = (l: Page[]) => [...new Map(l.map((x) => [x.id, x])).values()].sort(byDate)
  const climb = (key: 'parents' | 'children') => {
    const seen = new Set([p.id]), rows: Page[][] = []
    let cur = [p]
    for (let g = 0; g < 3; g++) {
      const next = uniq(cur.flatMap((x) => famOf(pages, schemas, x)[key])).filter((x) => !seen.has(x.id))
      if (!next.length) break
      next.forEach((x) => seen.add(x.id)); rows.push(next); cur = next
    }
    return rows
  }
  const up = climb('parents'), down = climb('children'), fam = famOf(pages, schemas, p)
  const UP = ['Genitori', 'Nonni', 'Bisnonni'], DOWN = ['Figli', 'Nipoti', 'Pronipoti']

  // Casato: la pagina che dà un nome e una storia al gruppo; «Estendi» lo assegna ai discendenti che non ne hanno uno
  const hf = sc.fields.find((f) => f.role === 'house' && f.kind === 'page')
  const house = hf ? pages[idsOf(p, hf)[0]] : undefined
  const lineage = (() => {
    const out: Page[] = [], seen = new Set([p.id])
    let cur = [p]
    for (let g = 0; g < 12 && cur.length; g++) { const next = uniq(cur.flatMap((x) => famOf(pages, schemas, x).children)).filter((x) => !seen.has(x.id)); next.forEach((x) => seen.add(x.id)); out.push(...next); cur = next }
    return out
  })()
  const lacking = house ? lineage.filter((x) => { const f2 = houseFieldOf(schemas, x); return !!f2 && !idsOf(x, f2).length }) : []
  const spread = () => lacking.forEach((x) => { const f2 = houseFieldOf(schemas, x)!; upsert({ ...x, fields: { ...(x.fields || {}), [f2.id]: house!.id } }) })
  const newHouse = () => { if (!hf) return; const h = create('Nuovo casato', p.folder || ''); upsert({ ...h, type: 'Casato' }); upsert({ ...p, fields: { ...(p.fields || {}), [hf.id]: h.id } }); nav('/w/' + h.id) }

  // Aggiunte rapide: si crea la pagina del parente e si scrive il legame nella scheda giusta
  const has = (fid: string) => sc.fields.some((f) => f.id === fid)
  const spouseF = sc.fields.find((f) => f.role === 'spouse')
  const fresh = (fields?: Record<string, any>) => { const c = create('Nuovo personaggio', p.folder || ''); upsert({ ...c, type: p.type, fields: fields ?? {} }); setRenaming(c.id); return c }
  const addParent = (fid: string) => { const c = fresh(); upsert({ ...p, fields: { ...(p.fields || {}), [fid]: c.id } }) }
  const addSpouse = () => { if (!spouseF) return; const c = fresh(); upsert({ ...p, fields: { ...(p.fields || {}), [spouseF.id]: [...idsOf(p, spouseF), c.id] } }) }
  const btn = 'rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-ink'

  const card = (x: Page, center = false) => (
    <div key={x.id} className={`grid min-w-36 max-w-52 gap-0.5 rounded-xl border px-3 py-2 ${center ? 'border-accent bg-accent/10' : 'border-line bg-paper'}`}>
      {renaming === x.id ? (
        <input autoFocus defaultValue={x.title} className={field} onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) upsert({ ...x, title: v }); setRenaming(null) }} />
      ) : (
        <button onClick={() => nav('/characters/' + x.id)} className="truncate text-left font-medium hover:text-accent">{x.title || 'Senza titolo'}</button>
      )}
      {houseOf(pages, schemas, x) && <span className="truncate text-[11px] text-muted">{houseOf(pages, schemas, x)!.title}</span>}
      <span className="flex items-center justify-between gap-2 text-xs text-muted"><span>{lifeOf(cal, x) || 'senza date'}</span><Link to={'/w/' + x.id} className="text-accent hover:underline">pagina</Link></span>
    </div>
  )

  return (
    <div className="scroll-pretty min-h-0 flex-1 overflow-auto">
      <div className="mx-auto grid max-w-4xl gap-2 pb-10">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-display mr-2 text-2xl">{p.title || 'Senza titolo'}{p.star && <span className="ml-2 text-gold" title="Pagina principale">★</span>}</h2>
          {hf && (house ? (
            <>
              <Link to={'/w/' + house.id} className={btn} title="Apri la pagina del casato">Casato: {house.title || 'Senza titolo'}</Link>
              {lacking.length > 0 && <button onClick={spread} className={btn} title="Assegna questo casato ai discendenti che non ne hanno uno">Estendi ai discendenti ({lacking.length})</button>}
            </>
          ) : <button onClick={newHouse} className={btn}>+ Casato</button>)}
          {has('padre') && !p.fields?.padre && <button onClick={() => addParent('padre')} className={btn}>+ Padre</button>}
          {has('madre') && !p.fields?.madre && <button onClick={() => addParent('madre')} className={btn}>+ Madre</button>}
          {spouseF && <button onClick={addSpouse} className={btn}>+ Coniuge</button>}
          {has('padre') && <button onClick={() => fresh({ padre: p.id })} className={btn}>+ Figlio (padre)</button>}
          {has('madre') && <button onClick={() => fresh({ madre: p.id })} className={btn}>+ Figlio (madre)</button>}
        </header>
        {up.slice().reverse().map((row, i) => (
          <div key={'u' + i} className="grid gap-2"><Row label={UP[up.length - 1 - i]}>{row.map((x) => card(x))}</Row><Line /></div>
        ))}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {fam.siblings.length > 0 && <Row label="Fratelli e sorelle">{fam.siblings.map((x) => card(x))}</Row>}
          <Row>{card(p, true)}</Row>
          {fam.spouses.length > 0 && <Row label="Coniugi o partner">{fam.spouses.map((x) => card(x))}</Row>}
        </div>
        {down.map((row, i) => (
          <div key={'d' + i} className="grid gap-2"><Line /><Row label={DOWN[i]}>{row.map((x) => card(x))}</Row></div>
        ))}
        {!up.length && !down.length && !fam.siblings.length && !fam.spouses.length && (
          <p className="mt-4 text-center text-sm text-muted">Nessun legame di parentela. Usa i pulsanti in alto o indica genitori e coniugi nella scheda della pagina.</p>
        )}
      </div>
    </div>
  )
}

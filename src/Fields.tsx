import { Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { fromDay } from './calendar'
import { DateField } from './DateField'
import { PagePick } from './Tags'
import { Page, byDate } from './types'
import { Schema, famOf, houseFieldOf, houseOf, idsOf, membersOf } from './kinds'
import { field } from './ui'

// Anni di vita o di esistenza, per le liste
export const lifeOf = (cal: any, p: Page) => (p.date == null ? '' : fromDay(cal, p.date).y + (p.dateEnd != null ? '–' + fromDay(cal, p.dateEnd).y : ''))

// Campi della scheda di un tipo: ogni valore si salva in `fields` della pagina (frontmatter)
export function FieldsEditor({ page, schema }: { page: Page; schema: Schema }) {
  const { pages, create, upsert } = useStore()
  const nav = useNavigate()
  const set = (id: string, v: any) => {
    const f = { ...(page.fields || {}) }
    if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete f[id]; else f[id] = v
    upsert({ ...page, fields: f })
  }
  const opts = Object.values(pages).filter((p) => p.id !== page.id).sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))
  return (
    <div className="grid gap-3">
      {schema.fields.map((f) => {
        const val = page.fields?.[f.id]
        const ids = idsOf(page, f)
        return (
          <div key={f.id} className="grid gap-1 text-xs text-muted">
            {f.kind === 'date' ? <DateField label={f.label} value={typeof val === 'number' ? val : null} onChange={(v) => set(f.id, v)} /> : <span>{f.label}</span>}
            {f.kind === 'text' && <input className={field} value={typeof val === 'string' ? val : ''} onChange={(e) => set(f.id, e.target.value)} />}
            {f.kind === 'choice' && (
              <select className={field} value={typeof val === 'string' ? val : ''} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">—</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.kind === 'page' && <PagePick className={field} value={ids[0] || ''} placeholder="Nessuno" options={opts} onChange={(id) => set(f.id, id)} />}
            {f.role === 'house' && !ids.length && (
              <button className="justify-self-start text-sm text-accent hover:underline" onClick={() => {
                const h = create('Nuovo casato', page.folder || ''); upsert({ ...h, type: 'Casato' }); set(f.id, h.id); nav('/w/' + h.id)
              }}>+ Crea una pagina Casato</button>
            )}
            {f.kind === 'pages' && (
              <div className="grid gap-1">
                {ids.map((i) => pages[i] && (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm text-ink">
                    <Link to={'/w/' + i} className="min-w-0 truncate hover:text-accent">{pages[i].title || 'Senza titolo'}</Link>
                    <button aria-label={`Togli ${pages[i].title}`} onClick={() => set(f.id, ids.filter((x) => x !== i))} className="text-muted hover:text-danger">×</button>
                  </div>
                ))}
                <PagePick className={field} value="" placeholder="Aggiungi…" options={opts.filter((o) => !ids.includes(o.id))} onChange={(id) => id && set(f.id, [...ids, id])} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Famiglia ricavata dai campi con ruolo (genitore, coniuge): non si scrive due volte, figli e fratelli si deducono
export function FamilyBlock({ page }: { page: Page }) {
  const { pages, schemas, calendar: cal } = useStore()
  const fam = famOf(pages, schemas, page)
  const house = houseOf(pages, schemas, page)
  const group = (label: string, l: Page[]) => l.length > 0 && (
    <div key={label} className="grid gap-0.5">
      <p className="text-xs text-muted">{label}</p>
      {l.sort(byDate).map((p) => (
        <Link key={p.id} to={'/w/' + p.id} className="flex items-baseline justify-between gap-2 rounded-md px-2 py-0.5 text-sm hover:bg-line/60">
          <span className="truncate">{p.title || 'Senza titolo'}</span><span className="shrink-0 text-xs text-muted">{lifeOf(cal, p)}</span>
        </Link>
      ))}
    </div>
  )
  const any = fam.parents.length + fam.siblings.length + fam.spouses.length + fam.children.length > 0
  return (
    <div className="grid gap-2">
      {house && <p className="text-sm"><span className="text-xs text-muted">Casato </span><Link to={'/w/' + house.id} className="hover:text-accent">{house.title || 'Senza titolo'}</Link></p>}
      {group('Genitori', fam.parents)}{group('Fratelli e sorelle', fam.siblings)}{group('Coniugi o partner', fam.spouses)}{group('Figli', fam.children)}
      {!any && <p className="text-sm text-muted">Nessun legame di parentela. Indica genitori e coniugi nella scheda: figli e fratelli compaiono da soli.</p>}
      <Link to={'/characters/' + page.id} className="text-sm text-accent hover:underline">Vedi l'albero →</Link>
    </div>
  )
}

// Membri di un casato: i personaggi che lo indicano nel campo «Casato» della loro scheda
export function MembersBlock({ page }: { page: Page }) {
  const nav = useNavigate()
  const { pages, schemas, calendar: cal, create, upsert } = useStore()
  const members = membersOf(pages, schemas, page)
  const cand = Object.values(pages).filter((q) => q.id !== page.id && houseFieldOf(schemas, q) && !members.includes(q)).sort((a, b) => a.title.localeCompare(b.title))
  const join = (id: string) => { const q = pages[id], f = q && houseFieldOf(schemas, q); if (q && f) upsert({ ...q, fields: { ...(q.fields || {}), [f.id]: page.id } }) }
  const leave = (q: Page) => { const f = houseFieldOf(schemas, q); if (!f) return; const fl = { ...(q.fields || {}) }; delete fl[f.id]; upsert({ ...q, fields: fl }) }
  const fresh = () => {
    const c = create('Nuovo personaggio', page.folder || '')
    const fid = houseFieldOf(schemas, { type: 'Personaggio' } as Page)?.id ?? 'casato'
    upsert({ ...c, type: 'Personaggio', fields: { [fid]: page.id } })
    nav('/w/' + c.id)
  }
  return (
    <div className="grid gap-1.5">
      {members.map((q) => (
        <div key={q.id} className="flex items-baseline justify-between gap-2 text-sm">
          <Link to={'/w/' + q.id} className="min-w-0 flex-1 truncate hover:text-accent">{q.title || 'Senza titolo'}</Link>
          <span className="shrink-0 text-xs text-muted">{lifeOf(cal, q)}</span>
          <button aria-label={`Togli ${q.title} dal casato`} title="Togli dal casato" onClick={() => leave(q)} className="text-muted hover:text-danger">×</button>
        </div>
      ))}
      {!members.length && <p className="text-sm text-muted">Nessun membro. Un personaggio ne fa parte quando indica questo casato nella sua scheda.</p>}
      <PagePick className={field} value="" placeholder="Aggiungi un personaggio…" options={cand.map((q) => ({ id: q.id, title: q.title, hint: q.type }))} onChange={(id) => id && join(id)} />
      <button onClick={fresh} className="justify-self-start text-sm text-accent hover:underline">+ Nuovo personaggio del casato</button>
    </div>
  )
}


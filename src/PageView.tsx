import { Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Page, ancestorsOf, byDate, childrenOf, descendantsOf, folderPath, isRuler, parentOf } from './types'
import { durLabel, fmt } from './calendar'
import { Icon, IconBtn, Popover, Section, field, useConfirm } from './ui'
import { DateField } from './DateField'
import { Combo, PagePick, TagEditor } from './Tags'
import { FamilyBlock, FieldsEditor, MembersBlock } from './Fields'
import { PRESETS, inverseRows, refsOf, schemaFor } from './kinds'
import Editor from './Editor'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Apre una versione pulita della pagina in una nuova finestra e avvia la stampa (da lì: "Salva come PDF").
function printPage(page: Page) {
  const el = document.querySelector('.lore .ProseMirror')
  const w = el && window.open('', '_blank')
  if (!el || !w) return
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(page.title)}</title><style>
    body{font:17px/1.7 Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}h1,h2,h3{line-height:1.25}img{max-width:100%;border-radius:4px}
    .img-wrap[data-align=left]{float:left;margin:0 1.2em .5em 0}.img-wrap[data-align=right]{float:right;margin:0 0 .5em 1.2em}.img-wrap[data-align=center]{margin:1em auto}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}th{background:#eee}
    blockquote{border-left:3px solid #b8892b;padding-left:1em;color:#555}a{color:#111}ul[data-type=taskList]{list-style:none;padding-left:0}
  </style><h1>${esc(page.title)}</h1>${el.innerHTML}`)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

export function PageView({ page }: { page: Page }) {
  const nav = useNavigate()
  const { pages, folders, schemas, upsert, remove } = useStore()
  const { ask, dialog } = useConfirm()
  const sc = schemaFor(schemas, page.type)
  const paths = folders.map((f) => ({ id: f.id, label: folderPath(folders, f.id) })).sort((a, b) => a.label.localeCompare(b.label))
  const typeCount: Record<string, number> = {}
  Object.values(pages).forEach((p) => { if (p.type) typeCount[p.type] = (typeCount[p.type] || 0) + 1 })
  const typeOpts = Object.keys(typeCount).sort((a, b) => typeCount[b] - typeCount[a] || a.localeCompare(b)).map((t) => ({ value: t, hint: typeCount[t] === 1 ? '1 pagina' : `${typeCount[t]} pagine` }))
  const allTags = [...new Set(Object.values(pages).flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b))
  // Pagina madre: si può scegliere qualsiasi pagina tranne questa e le sue discendenti (niente cicli)
  const ancestors = ancestorsOf(pages, page)
  const below = new Set(descendantsOf(pages, page.id).map((p) => p.id))
  const parentOpts = Object.values(pages).filter((p) => p.id !== page.id && !below.has(p.id)).sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))
  return (
    <article className="mx-auto flex min-h-0 w-full flex-1 flex-col rounded-2xl border border-line bg-paper shadow-sm transition-shadow focus-within:border-accent/50 focus-within:shadow-lg" style={{ maxWidth: 'var(--editor-width)' }}>
      {ancestors.length > 0 && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1 px-8 pt-5 text-sm text-muted" aria-label="Percorso">
          {ancestors.map((a) => (
            <span key={a.id} className="flex items-center gap-1"><Link to={'/w/' + a.id} className="hover:text-accent hover:underline">{a.title || 'Senza titolo'}</Link><span>›</span></span>
          ))}
        </nav>
      )}
      <div className={`flex shrink-0 items-center gap-2 px-8 pb-4 ${ancestors.length ? 'pt-2' : 'pt-7'}`}>
        <input className="font-display w-full min-w-0 bg-transparent text-4xl outline-none placeholder:text-muted" value={page.title} placeholder="Titolo"
          onChange={(e) => upsert({ ...page, title: e.target.value })} />
        <button aria-pressed={!!page.star} title={page.star ? 'Togli la stella' : 'Segna come pagina principale'} onClick={() => upsert({ ...page, star: !page.star })}
          className={`shrink-0 rounded-md px-1.5 py-1 text-xl leading-none hover:bg-line/60 ${page.star ? 'text-gold' : 'text-muted'}`}>{page.star ? '★' : '☆'}</button>
        <Popover width="w-80" button={(open, t) => <IconBtn n="gear" label="Proprietà della pagina" active={open} onClick={t} />}>
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-muted">Cartella
              <select className={field} value={page.folder || ''} onChange={(e) => upsert({ ...page, folder: e.target.value })}>
                <option value="">Nessuna (radice)</option>
                {paths.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <div className="grid gap-1 text-xs text-muted">Periodo di (pagina madre)
              <PagePick className={field} value={page.parent || ''} options={parentOpts} onChange={(id) => upsert({ ...page, parent: id })} />
            </div>
            <label className="grid gap-1 text-xs text-muted">Tipo
              <Combo className={field} value={page.type} placeholder="Nessuno" options={typeOpts} onChange={(v) => upsert({ ...page, type: v })} />
              {sc && <span className="text-[11px]">Scheda attiva: {sc.preset ? PRESETS[sc.preset].label : page.type} (si modifica da «Tipi» nel pannello Pagine)</span>}
            </label>
            <div className="grid gap-1 text-xs text-muted">Tag <span className="text-[11px]">Categoria:valore (Cultura:Europea) oppure semplice (Animale). Invio o virgola per aggiungere.</span>
              <TagEditor tags={page.tags} all={allTags} onChange={(t) => upsert({ ...page, tags: t })} />
            </div>
            <DateField label={`${sc?.dates?.[0] || 'Data'} (timeline)`} value={page.date} onChange={(v) => upsert({ ...page, date: v, dateEnd: v == null ? null : page.dateEnd })} />
            {page.date != null && <DateField label={sc?.dates?.[1] || 'Fine (opzionale)'} value={page.dateEnd} onChange={(v) => upsert({ ...page, dateEnd: v })} />}
            <button onClick={() => printPage(page)} className="text-left text-sm text-accent hover:underline">Esporta in PDF (stampa)</button>
            <button onClick={() => ask({ title: `Spostare «${page.title || 'Senza titolo'}» nel cestino?`, text: 'Si può ripristinare dal Cestino.', label: 'Sposta nel cestino', danger: true }, () => { remove(page.id); nav('/w') })}
              className="flex items-center gap-1.5 text-sm text-danger hover:underline"><Icon n="trash" size={16} /> Sposta nel cestino</button>
          </div>
        </Popover>
      </div>
      <Editor page={page} />
      {dialog}
    </article>
  )
}

const row = 'block truncate rounded-md px-3 py-1.5 text-sm hover:bg-line/60'

export function PageSide({ page }: { page: Page }) {
  const nav = useNavigate()
  const { pages, maps, schemas, calendar: cal, create, upsert } = useStore()
  const schema = schemaFor(schemas, page.type)
  const inv = inverseRows(pages, schemas, page)
  const all = Object.values(pages).sort((a, b) => a.title.localeCompare(b.title))
  const back = all.filter((p) => p.id !== page.id && (p.body.includes('wiki:' + page.id) || refsOf(p, schemas).includes(page.id)))
  const out = [...new Set([...page.body.matchAll(/\]\(wiki:([^)\s]+)\)/g)].map((m) => m[1]).concat(refsOf(page, schemas)))].map((i) => pages[i]).filter(Boolean)
  // Collegamenti scritti nei metadati (sezione Note), senza testo [[…]] nel corpo
  const metaLinks = (page.links || []).map((i) => pages[i]).filter(Boolean)
  const linkOpts = all.filter((p) => p.id !== page.id && !(page.links || []).includes(p.id)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))
  // Elementi di mappa collegati a questa pagina (dal menu "Pagina" dell'elemento)
  const onMaps = Object.values(maps).flatMap((m) => m.features.filter((f) => f.properties?.page === page.id).map((f) => ({ m, f })))
    .filter(({ m, f }, i, a) => a.findIndex((x) => x.m.id === m.id && (x.f.properties.group || x.f.properties.id) === (f.properties.group || f.properties.id)) === i)
  // Famiglia di pagine: madre, periodi (figlie) e sovrani (discendenti con tipo «Sovrano», «Re», …)
  const parent = parentOf(pages, page)
  const siblings = parent ? childrenOf(pages, parent.id).filter((s) => s.id !== page.id) : []
  const periods = childrenOf(pages, page.id).filter((k) => !isRuler(k))
  const rulers = descendantsOf(pages, page.id).filter(isRuler).sort(byDate)
  const when = (p: Page) => (p.date != null ? fmt(cal, p.date) + (p.dateEnd != null ? ' → ' + fmt(cal, p.dateEnd) : '') : 'senza data')
  const addChild = (title: string, type = '') => { const c = create(title, page.folder || ''); upsert({ ...c, parent: page.id, type }); nav('/w/' + c.id) }
  // Una pagina esistente (anche in un'altra cartella, per esempio un personaggio) può diventare periodo o sovrano di questa
  const above = new Set(ancestorsOf(pages, page).map((x) => x.id))
  const attachOpts = all.filter((p) => p.id !== page.id && p.parent !== page.id && !above.has(p.id)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))
  // I periodi e i sovrani sono una specializzazione: li offrono le entità politiche (Regno, Stato…) e le pagine che già li hanno
  const showPeriods = schema?.preset === 'entita' || periods.length > 0 || rulers.length > 0
  const span = periods.filter((p) => p.date != null)
  const first = span.length ? Math.min(...span.map((p) => p.date!)) : null, last = span.length ? Math.max(...span.map((p) => p.dateEnd ?? p.date!)) : null
  // Elenco in ordine di tempo con, tra una voce e l'altra, il vuoto o la sovrapposizione
  const chrono = (l: Page[], overlap: string, gap: string, durations: boolean): any[] => l.flatMap((p, i) => {
    const prev = l[i - 1], out: any[] = []
    if (prev && prev.dateEnd != null && p.date != null) {
      if (p.date <= prev.dateEnd) out.push(<p key={p.id + 'o'} className="px-3 text-xs text-gold">↳ {overlap}</p>)
      else if (p.date > prev.dateEnd + 1) out.push(<p key={p.id + 'g'} className="px-3 text-xs text-muted">↳ {gap} di {durLabel(cal, p.date - prev.dateEnd - 1)}</p>)
    }
    out.push(
      <Link key={p.id} to={'/w/' + p.id} className={row}>
        <span className="block truncate">{p.title || 'Senza titolo'}</span>
        <span className="block truncate text-xs text-muted">{when(p)}{durations && p.date != null && p.dateEnd != null ? ' · ' + durLabel(cal, p.dateEnd - p.date) : ''}</span>
      </Link>
    )
    return out
  })
  const list = (l: Page[], empty: string) => l.length ? l.map((p) => <Link key={p.id} to={'/w/' + p.id} className={row}>{p.title || 'Senza titolo'}</Link>) : <p className="px-3 py-1 text-sm text-muted">{empty}</p>
  return (
    <div className="scroll-pretty h-full overflow-auto p-3">
      <Section title="Note e collegamenti">
        <textarea className={field + ' min-h-32 resize-y'} placeholder="Appunti su questa pagina…" value={page.notes || ''} onChange={(e) => upsert({ ...page, notes: e.target.value })} />
        <div className="mt-3 grid gap-1">
          <p className="text-xs text-muted">Collegamenti: restano nei metadati, senza scrivere nulla nel testo</p>
          {metaLinks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <Link to={'/w/' + t.id} className="min-w-0 truncate hover:text-accent">{t.title || 'Senza titolo'}</Link>
              <button aria-label={`Togli il collegamento con ${t.title}`} onClick={() => upsert({ ...page, links: (page.links || []).filter((x) => x !== t.id) })} className="text-muted hover:text-danger">×</button>
            </div>
          ))}
          <PagePick className={field} value="" placeholder="Collega a una pagina…" options={linkOpts} onChange={(id) => id && upsert({ ...page, links: [...(page.links || []), id] })} />
        </div>
      </Section>
      {schema && schema.fields.length > 0 && (
        <Section title={`Scheda: ${schema.preset ? PRESETS[schema.preset].label : page.type}`}>
          <FieldsEditor page={page} schema={schema} />
        </Section>
      )}
      {schema?.preset === 'personaggio' && <Section title="Famiglia"><FamilyBlock page={page} /></Section>}
      {schema?.preset === 'casato' && <Section title="Membri"><MembersBlock page={page} /></Section>}
      {inv.map((r) => (
        <Section key={r.label} title={r.label} count={r.pages.length}>
          {r.pages.map((q) => <Link key={q.id} to={'/w/' + q.id} className={row}>{q.title || 'Senza titolo'}</Link>)}
        </Section>
      ))}
      {parent && (
        <Section title="Parte di">
          <Link to={'/w/' + parent.id} className={row}>{parent.title || 'Senza titolo'}</Link>
          {siblings.length > 0 && <p className="px-3 pt-1 text-xs text-muted">Altri periodi</p>}
          {siblings.map((s) => <Link key={s.id} to={'/w/' + s.id} className={row}>{s.title || 'Senza titolo'} <span className="text-xs text-muted">{when(s)}</span></Link>)}
        </Section>
      )}
      {showPeriods && <Section title="Periodi" count={periods.length}>
        {first != null && last != null && <p className="px-3 pb-1 text-xs text-muted">Esistenza: {fmt(cal, first)} → {fmt(cal, last)}</p>}
        {periods.length ? chrono(periods, 'in parallelo al precedente', 'interruzione', false) : <p className="px-3 py-1 text-sm text-muted">Nessun periodo. Un periodo, un governo o una rifondazione sono pagine figlie di questa.</p>}
        <div className="px-3 pt-2">
          <PagePick className={field} value="" placeholder="Collega una pagina esistente…" options={attachOpts} onChange={(id) => { const t = pages[id]; if (t) upsert({ ...t, parent: page.id }) }} />
        </div>
        <div className="flex gap-3 px-3 pt-2 text-sm">
          <button onClick={() => addChild('Nuovo periodo')} className="text-accent hover:underline">+ Nuovo periodo</button>
          <button onClick={() => addChild('Nuovo sovrano', 'Sovrano')} className="text-accent hover:underline">+ Nuovo sovrano</button>
        </div>
      </Section>}
      {rulers.length > 0 && (
        <Section title="Sovrani" count={rulers.length}>
          {chrono(rulers, 'co-reggenza con il precedente', 'interregno', true)}
        </Section>
      )}
      <Section title="Collegata da" count={back.length}>{list(back, 'Nessuna pagina.')}</Section>
      <Section title="Collegamenti in uscita" count={out.length}>{list(out, 'Nessun collegamento.')}</Section>
      <Section title="Sulle mappe" count={onMaps.length}>
        {onMaps.length ? onMaps.map(({ m, f }) => (
          <Link key={f.properties.id} to={`/map/${m.id}?f=${f.properties.id}`} className={row}>{f.properties.name || 'Senza nome'} <span className="text-muted">({m.title})</span></Link>
        )) : <p className="px-3 py-1 text-sm text-muted">Nessun elemento di mappa.</p>}
      </Section>
    </div>
  )
}

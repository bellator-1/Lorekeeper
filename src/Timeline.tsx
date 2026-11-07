import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { useStore } from './store'
import { eraList, fmt, toDay, yearLen } from './calendar'
import { Folder, Page, folderColor, parentOf, rootOf, tagKey, tagVal } from './types'
import { Icon, Modal, Section, field } from './ui'

/* ---------- filtri (condivisi tra pannello sinistro e timeline) ---------- */
type TL = { q: string; folders: string[]; types: string[]; tags: string[]; set: (p: Partial<TL>) => void; reset: () => void }
export const useTL = create<TL>((set) => ({
  q: '', folders: [], types: [], tags: [],
  set: (p) => set(p), reset: () => set({ q: '', folders: [], types: [], tags: [] }),
}))

// Una cartella selezionata include le sue sottocartelle.
const chainOf = (fs: Folder[], fid: string) => {
  const out: string[] = []
  let f = fs.find((x) => x.id === fid), n = 0
  while (f && n++ < 20) { out.push(f.id); const p = f.parent; f = fs.find((x) => x.id === p) }
  return out.length ? out : ['']
}
// Filtri effettivi. Una selezione di un tag, tipo o cartella che non esiste più (rinominato, tolto dalle pagine,
// eliminato) non viene applicata: prima restava attiva ma senza il pulsante per togliere la spunta → timeline vuota.
function useEffectiveFilters() {
  const { q, folders: f0, types: ty0, tags: tg0 } = useTL()
  const pages = useStore((s) => s.pages), fs = useStore((s) => s.folders)
  const dated = Object.values(pages).filter((p) => p.date != null)
  const typeSet = new Set(dated.map((p) => p.type || '')), tagSet = new Set(dated.flatMap((p) => p.tags))
  const keySet = new Set([...tagSet].map(tagKey).filter(Boolean)), fids = new Set(['', ...fs.map((f) => f.id)])
  return {
    q, fs, raw: { folders: f0, types: ty0, tags: tg0 },
    sf: f0.filter((f) => fids.has(f)), types: ty0.filter((t) => typeSet.has(t)),
    tags: tg0.filter((s) => (s.endsWith(':*') ? keySet.has(s.slice(0, -2)) : tagSet.has(s))),
  }
}

// «Cultura:*» = qualsiasi valore della categoria Cultura
const tagHit = (p: Page, sel: string[]) => sel.some((s) => (s.endsWith(':*') ? p.tags.some((t) => tagKey(t) === s.slice(0, -2)) : p.tags.includes(s)))

function useMatcher() {
  const { q, fs, sf, types, tags } = useEffectiveFilters()
  return (p: Page) => {
    if (q && !`${p.title} ${p.type} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false
    if (types.length && !types.includes(p.type || '')) return false
    if (tags.length && !tagHit(p, tags)) return false
    if (sf.length) { const c = chainOf(fs, p.folder || ''); if (!sf.some((s) => c.includes(s))) return false }
    return true
  }
}

const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-accent hover:text-ink'}`

export function TimelinePanel() {
  const { pages, folders } = useStore()
  const tl = useTL()
  const dated = Object.values(pages).filter((p) => p.date != null)
  const types = [...new Set(dated.map((p) => p.type || ''))].sort()
  const tags = [...new Set(dated.flatMap((p) => p.tags))].sort()
  const toggle = (k: 'folders' | 'types' | 'tags', v: string) => tl.set({ [k]: tl[k].includes(v) ? tl[k].filter((x) => x !== v) : [...tl[k], v] })
  const flat: { f: Folder; d: number }[] = []
  const ids = new Set(folders.map((f) => f.id))
  const walk = (parent: string, d: number) => folders.filter((f) => (ids.has(f.parent) ? f.parent : '') === parent).sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => { flat.push({ f, d }); walk(f.id, d + 1) })
  walk('', 0)
  const ef = useEffectiveFilters()
  useEffect(() => {
    if (ef.sf.length !== tl.folders.length || ef.types.length !== tl.types.length || ef.tags.length !== tl.tags.length) tl.set({ folders: ef.sf, types: ef.types, tags: ef.tags })
  }, [pages, folders])
  const groups: { key: string; tags: string[] }[] = []
  tags.forEach((t) => { const k = tagKey(t); let g = groups.find((x) => x.key === k); if (!g) { g = { key: k, tags: [] }; groups.push(g) } g.tags.push(t) })
  groups.sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.key.localeCompare(b.key)))
  const active = tl.q || tl.folders.length || tl.types.length || tl.tags.length

  return (
    <div className="scroll-pretty flex h-full flex-col gap-3 overflow-auto p-3">
      <input className={field} placeholder="Cerca negli eventi…" value={tl.q} onChange={(e) => tl.set({ q: e.target.value })} />
      {active ? <button onClick={tl.reset} className="self-start text-xs text-accent hover:underline">Azzera i filtri</button> : null}
      <Section title="Cartelle">
        <div className="grid gap-0.5">
          {flat.map(({ f, d }) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-sm hover:bg-line/60" style={{ paddingLeft: 6 + d * 14 }}>
              <input type="checkbox" className="accent-accent" checked={tl.folders.includes(f.id)} onChange={() => toggle('folders', f.id)} />
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: folderColor(folders, f.id) }} />{f.name}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted hover:bg-line/60">
            <input type="checkbox" className="accent-accent" checked={tl.folders.includes('')} onChange={() => toggle('folders', '')} />Senza cartella
          </label>
        </div>
      </Section>
      <Section title="Tipi" count={types.length}>
        <div className="flex flex-wrap gap-1.5 px-1">{types.map((t) => <button key={t} onClick={() => toggle('types', t)} className={chip(tl.types.includes(t))}>{t || 'Senza tipo'}</button>)}</div>
      </Section>
      <Section title="Tag" count={tags.length}>
        <div className="grid gap-2.5 px-1">
          {groups.map((g) => (
            <div key={g.key || '_'} className="grid gap-1">
              {g.key ? (
                <button onClick={() => toggle('tags', g.key + ':*')} title="Tutte le pagine con questa categoria" className={`self-start text-xs font-medium ${tl.tags.includes(g.key + ':*') ? 'text-accent' : 'text-muted hover:text-ink'}`}>{g.key}</button>
              ) : groups.length > 1 ? <span className="text-xs text-muted">Senza categoria</span> : null}
              <div className="flex flex-wrap gap-1.5">{g.tags.map((t) => <button key={t} onClick={() => toggle('tags', t)} className={chip(tl.tags.includes(t))}>{g.key ? tagVal(t) : t}</button>)}</div>
            </div>
          ))}
          {!tags.length && <p className="text-sm text-muted">Nessun tag.</p>}
        </div>
      </Section>
    </div>
  )
}

/* ---------- calendario: mesi ed ere ---------- */
function CalendarEditor({ onClose }: { onClose: () => void }) {
  const { calendar: c, setCalendar } = useStore()
  const eras = c.eras ?? []
  const setM = (i: number, p: object) => setCalendar({ ...c, months: c.months.map((m, j) => (j === i ? { ...m, ...p } : m)) })
  const setE = (i: number, p: object) => setCalendar({ ...c, eras: eras.map((e, j) => (j === i ? { ...e, ...p } : e)) })
  return (
    <Modal onClose={onClose} wide>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="grid content-start gap-3">
          <h2 className="font-display text-xl">Mesi</h2>
          <label className="grid gap-1 text-xs text-muted">Suffisso dell'anno
            <input className={field} value={c.era} placeholder="es. E.C." onChange={(e) => setCalendar({ ...c, era: e.target.value })} /></label>
          <div className="grid gap-1.5">
            {c.months.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={field} value={m.name} onChange={(e) => setM(i, { name: e.target.value })} />
                <input type="number" min={1} className={field} style={{ width: 80 }} value={m.days} onChange={(e) => setM(i, { days: Math.max(1, +e.target.value || 1) })} />
                <button aria-label="Rimuovi mese" disabled={c.months.length < 2} className="text-muted hover:text-ink disabled:opacity-30" onClick={() => setCalendar({ ...c, months: c.months.filter((_, j) => j !== i) })}><Icon n="x" size={16} /></button>
              </div>
            ))}
          </div>
          <button className="self-start text-sm text-accent hover:underline" onClick={() => setCalendar({ ...c, months: [...c.months, { name: `Mese ${c.months.length + 1}`, days: 30 }] })}>Aggiungi mese</button>
          <p className="text-xs text-muted">Un anno dura {yearLen(c)} giorni. Cambiare mesi o durate sposta le date già inserite.</p>
        </div>
        <div className="grid content-start gap-3">
          <h2 className="font-display text-xl">Ere</h2>
          <p className="text-xs text-muted">Ogni era comincia all'anno indicato e dura fino all'inizio della successiva.</p>
          <div className="grid gap-1.5">
            {eras.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={field} value={e.name} placeholder="Nome dell'era" onChange={(ev) => setE(i, { name: ev.target.value })} />
                <input type="number" className={field} style={{ width: 96 }} value={e.start} onChange={(ev) => setE(i, { start: +ev.target.value || 0 })} />
                <button aria-label="Rimuovi era" className="text-muted hover:text-ink" onClick={() => setCalendar({ ...c, eras: eras.filter((_, j) => j !== i) })}><Icon n="x" size={16} /></button>
              </div>
            ))}
          </div>
          <button className="self-start text-sm text-accent hover:underline" onClick={() => setCalendar({ ...c, eras: [...eras, { name: `Era ${eras.length + 1}`, start: eras.length ? Math.max(...eras.map((e) => e.start)) + 1000 : 0 }] })}>Aggiungi era</button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- vista ---------- */
const ERA_COLORS = ['#8a62c2', '#d08a3c', '#3f9a9a', '#c25a98', '#5c9a58', '#4a7bc2']
const PAD = 48, TOP = 68, LANE = 46, CARD_H = 40
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
const tint = (c: string, pct = 12) => `color-mix(in srgb, ${c} ${pct}%, transparent)`

export default function Timeline() {
  const { pages, folders, maps, calendar: cal } = useStore()
  const match = useMatcher()
  const nav = useNavigate()
  const L = yearLen(cal)
  const sc = useRef<HTMLDivElement>(null)
  const pend = useRef<{ day: number; px: number } | null>(null)
  const [zs, setZs] = useState(40)
  const [tick, setTick] = useState(0)
  const [view, setView] = useState({ left: 0, w: 900 })
  const [cfg, setCfg] = useState(false)

  // Pagine collegate a elementi di mappa: pagina → [{ mappa, elemento }]
  const onMap: Record<string, { map: string; title: string; feat: string; key: string }[]> = {}
  Object.values(maps).forEach((m) => m.features.forEach((f) => {
    const pid = f.properties?.page, k = f.properties?.group || f.properties?.id
    if (pid && !(onMap[pid] ??= []).some((x) => x.map === m.id && x.key === k)) onMap[pid].push({ map: m.id, title: m.title, feat: f.properties.id, key: k })
  }))
  const ev = Object.values(pages).filter((p) => p.date != null && match(p)).sort((a, b) => a.date! - b.date!)
  const min = ev.length ? ev[0].date! : 0
  const max = ev.length ? Math.max(...ev.map((p) => p.dateEnd ?? p.date!)) : L
  const span = Math.max((max - min) / L, 0.02)
  const z = Math.min(0.05 * Math.pow(400000, zs / 100), 2.5e7 / span) // pixel per anno (scala logaritmica)
  const x = (n: number) => PAD + ((n - min) / L) * z
  const dayAt = (px: number) => min + ((px - PAD) / z) * L
  const W = Math.max(x(max) + PAD * 3, view.w)

  const anchor = (day: number, px: number) => { pend.current = { day, px }; setTick((t) => t + 1) }
  const fit = (a: number, b: number) => {
    const el = sc.current; if (!el) return
    const target = (el.clientWidth - PAD * 2) / Math.max((b - a) / L, 0.02)
    setZs(Math.min(100, Math.max(0, (100 * Math.log(target / 0.05)) / Math.log(400000))))
    anchor(a, PAD)
  }
  useLayoutEffect(() => { if (pend.current && sc.current) { sc.current.scrollLeft = x(pend.current.day) - pend.current.px; pend.current = null } }, [tick, zs])
  useEffect(() => { if (ev.length) fit(min, max) }, [min, max])
  useEffect(() => {
    const el = sc.current; if (!el) return
    const upd = () => setView((v) => (v.left === el.scrollLeft && v.w === el.clientWidth ? v : { left: el.scrollLeft, w: el.clientWidth }))
    upd(); el.addEventListener('scroll', upd); const ro = new ResizeObserver(upd); ro.observe(el)
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      anchor(dayAt(el.scrollLeft + e.clientX - el.getBoundingClientRect().left), e.clientX - el.getBoundingClientRect().left)
      setZs((v) => Math.min(100, Math.max(0, v - e.deltaY * 0.06)))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('scroll', upd); ro.disconnect(); el.removeEventListener('wheel', wheel) }
  })

  // Ere: fasce colorate; l'ultima si estende fino alla fine
  const eras = eraList(cal)
  const bands = eras.map((e, i) => {
    const a = e.start * L, b = i < eras.length - 1 ? eras[i + 1].start * L : Math.max(max, a)
    return { ...e, a, b, l: Math.max(0, x(a)), r: i < eras.length - 1 ? x(b) : W, c: ERA_COLORS[i % ERA_COLORS.length] }
  }).filter((b) => b.r > 0)

  // Assegnazione a corsie: nessuna sovrapposizione tra le schede
  // Famiglie di pagine (madre e periodi): restano sulla stessa corsia, che nessun'altra pagina occupa nei vuoti
  // tra un periodo e l'altro, e un tratteggio mostra l'interruzione. Se due periodi si sovrappongono nel tempo
  // il secondo passa a un'altra corsia.
  const parentIds = new Set(Object.values(pages).map((p) => p.parent).filter(Boolean))
  const groupOf = (e: Page) => (parentOf(pages, e) || parentIds.has(e.id) ? rootOf(pages, e).id : undefined)
  const label = (e: Page) => { const par = parentOf(pages, e); return (e.star ? '★ ' : '') + (par ? (par.title || 'Senza titolo') + ' · ' : '') + (e.title || 'Senza titolo') }
  const geom = (e: Page) => { const x0 = x(e.date!), wRange = e.dateEnd != null ? x(e.dateEnd) - x0 : 0; return { x0, wRange, wCard: Math.max(wRange, 36 + label(e).length * 7) } }
  const gEnd: Record<string, number> = {}
  ev.forEach((e) => { const g = groupOf(e); if (g) { const m = geom(e); gEnd[g] = Math.max(gEnd[g] ?? 0, m.x0 + m.wCard) } })
  const ends: number[] = [], memberEnd: number[] = [], groupLane: Record<string, number> = {}
  const placed = ev.map((e) => {
    const { x0, wRange, wCard } = geom(e), g = groupOf(e)
    let lane = -1
    if (g && groupLane[g] != null && memberEnd[groupLane[g]] + 8 <= x0) lane = groupLane[g]
    if (lane < 0) { lane = ends.findIndex((en) => en + 8 <= x0); if (lane < 0) lane = ends.length }
    if (g && groupLane[g] == null) { groupLane[g] = lane; memberEnd[lane] = x0 + wCard; ends[lane] = Math.max(x0 + wCard, gEnd[g]) }
    else if (g && groupLane[g] === lane) { memberEnd[lane] = x0 + wCard; ends[lane] = Math.max(ends[lane], x0 + wCard) }
    else ends[lane] = x0 + wCard
    return { e, x0, wRange, wCard, lane, g }
  })
  const gaps: { key: string; left: number; width: number; top: number }[] = []
  const lastOf: Record<string, (typeof placed)[number]> = {}
  placed.forEach((p) => {
    if (!p.g || groupLane[p.g] !== p.lane) return
    const prev = lastOf[p.g]
    if (prev && p.x0 - (prev.x0 + prev.wCard) > 14) gaps.push({ key: prev.e.id + p.e.id, left: prev.x0 + prev.wCard, width: p.x0 - (prev.x0 + prev.wCard), top: TOP + p.lane * LANE + CARD_H / 2 })
    lastOf[p.g] = p
  })
  const visible = placed.filter((p) => p.x0 + p.wCard >= view.left - 300 && p.x0 <= view.left + view.w + 300)

  // Tacche: solo quelle visibili (la timeline regge anche su decine di millenni)
  const step = STEPS.find((s) => s * z >= 80) ?? 100000
  const y0 = Math.floor(dayAt(view.left - 120) / L), y1 = Math.ceil(dayAt(view.left + view.w + 120) / L)
  const ticks: number[] = []
  for (let y = Math.ceil(y0 / step) * step; y <= y1 && ticks.length < 80; y += step) ticks.push(y)
  const months: { x: number; name: string }[] = []
  cal.months.forEach((m, i) => {
    if (i === 0 || z * (m.days / L) < 70) return
    for (let y = y0; y <= y1 && months.length < 400; y++) months.push({ x: x(toDay(cal, y, i, 1)), name: m.name })
  })
  const H = TOP + Math.max(ends.length, 1) * LANE + 40
  const goMini = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (sc.current) sc.current.scrollLeft = ((e.clientX - r.left) / r.width) * W - view.w / 2
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-2xl">Timeline</h1>
        <span className="text-xs text-muted">{ev.length} eventi</span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button onClick={() => fit(min, max)} className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-accent">Tutto</button>
          {eras.map((e, i) => (
            <button key={i} onClick={() => fit(e.start * L, i < eras.length - 1 ? eras[i + 1].start * L : max)} className="rounded-full border px-2.5 py-0.5 text-xs hover:opacity-80" style={{ borderColor: ERA_COLORS[i % 6], color: ERA_COLORS[i % 6] }}>{e.name}</button>
          ))}
          <label className="flex items-center gap-2 text-xs text-muted">Zoom
            <input type="range" min={0} max={100} step={0.5} value={zs} className="w-36 accent-accent"
              onChange={(e) => { const el = sc.current; if (el) anchor(dayAt(el.scrollLeft + el.clientWidth / 2), el.clientWidth / 2); setZs(+e.target.value) }} /></label>
          <button onClick={() => setCfg(true)} className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-accent">Calendario</button>
        </div>
      </div>

      {/* Panoramica: tutto l'arco temporale, cliccabile */}
      <div className="relative h-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line bg-paper" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); goMini(e) }} onPointerMove={(e) => e.buttons === 1 && goMini(e)}>
        {bands.map((b, i) => <div key={i} className="absolute inset-y-0" style={{ left: `${(b.l / W) * 100}%`, width: `${((b.r - b.l) / W) * 100}%`, background: tint(b.c, 16) }} />)}
        {placed.map(({ e, lane }) => <span key={e.id} className="absolute h-1.5 w-1.5 rounded-full" style={{ left: `${(x(e.date!) / W) * 100}%`, top: 6 + (lane % 5) * 7, background: folderColor(folders, e.folder || '') }} />)}
        <div className="absolute inset-y-0 rounded border-2 border-accent bg-accent/10" style={{ left: `${(view.left / W) * 100}%`, width: `${Math.min(100, (view.w / W) * 100)}%` }} />
      </div>

      <div ref={sc} className="scroll-pretty relative min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-paper">
        {ev.length === 0 ? (
          <p className="sticky left-0 mt-[16vh] text-center text-muted">{Object.values(pages).some((p) => p.date != null) ? 'Nessun evento corrisponde ai filtri.' : "Nessuna pagina con data. Imposta la data dall'ingranaggio di una pagina."}</p>
        ) : (
          <div className="relative" style={{ width: W, height: H }}>
            {bands.map((b, i) => <div key={i} className="absolute bottom-0 top-0" style={{ left: b.l, width: b.r - b.l, background: tint(b.c, 6), borderLeft: `1px solid ${tint(b.c, 40)}` }} />)}
            {ticks.map((y) => <div key={y} className="absolute bottom-0 top-0 border-l border-line" style={{ left: x(y * L) }} />)}
            {months.map((m, i) => <div key={i} className="absolute bottom-0 top-0 border-l border-dashed border-line/60" style={{ left: m.x }} />)}

            <div className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur" style={{ height: 52, width: W }}>
              {bands.map((b, i) => (
                <div key={i} className="absolute top-0 h-6" style={{ left: b.l, width: b.r - b.l, background: tint(b.c, 18), borderLeft: `2px solid ${b.c}` }}>
                  <span className="sticky left-2 inline-block whitespace-nowrap px-1.5 pt-0.5 text-[11px] font-semibold" style={{ color: b.c }}>{b.name}</span>
                </div>
              ))}
              {ticks.map((y) => <span key={y} className="absolute top-7 whitespace-nowrap pl-1.5 text-xs text-muted" style={{ left: x(y * L) }}>{y}{cal.era ? ' ' + cal.era : ''}</span>)}
              {months.map((m, i) => <span key={i} className="absolute top-7 whitespace-nowrap pl-1.5 text-[11px] text-muted/70" style={{ left: m.x }}>{m.name}</span>)}
            </div>

            {gaps.filter((g) => g.left + g.width >= view.left - 300 && g.left <= view.left + view.w + 300).map((g) => (
              <div key={g.key} title="Interruzione" className="absolute border-t-2 border-dashed border-muted/50" style={{ left: g.left, width: g.width, top: g.top }} />
            ))}
            {visible.map(({ e, x0, wRange, wCard, lane }) => {
              const color = folderColor(folders, e.folder || '')
              const lk = onMap[e.id]
              return (
                <button key={e.id} onClick={() => nav('/w/' + e.id)} title={fmt(cal, e.date!) + (e.dateEnd != null ? ' → ' + fmt(cal, e.dateEnd) : '')}
                  className="absolute overflow-hidden rounded-lg border border-line bg-paper text-left shadow-sm transition hover:border-accent hover:shadow-md"
                  style={{ left: x0, top: TOP + lane * LANE, width: wCard, height: CARD_H }}>
                  {wRange > 0 && <span className="absolute inset-0" style={{ background: tint(color, 16) }} />}
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                  {lk && (
                    <span role="link" title={'Sulla mappa: ' + lk.map((x) => x.title).join(', ')} onClick={(evt) => { evt.stopPropagation(); nav(`/map/${lk[0].map}?f=${lk[0].feat}`) }}
                      className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded bg-paper/90 px-1 text-[10px] text-muted hover:text-accent"><Icon n="map" size={12} />{lk.length > 1 ? lk.length : ''}</span>
                  )}
                  <span className={`relative block truncate pl-3 pt-1 text-[13px] font-medium ${lk ? 'pr-9' : 'pr-2'}`}>{label(e)}</span>
                  <span className="relative block truncate pl-3 pr-2 text-[11px] text-muted">{fmt(cal, e.date!)}{e.dateEnd != null ? ' → ' + fmt(cal, e.dateEnd) : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {cfg && <CalendarEditor onClose={() => setCfg(false)} />}
    </div>
  )
}

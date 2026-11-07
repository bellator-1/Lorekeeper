import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force'
import { useStore } from './store'
import { folderColor } from './types'
import { refsOf } from './kinds'
import { useSettings } from './settings'
import { PagePick } from './Tags'

const W = 1000, H = 700
const clampK = (k: number) => Math.min(8, Math.max(0.05, k))
// Campione di linea per la legenda: ends = 0 nessuna freccia, 1 a un capo, 2 a entrambi
const Sample = ({ color, dash, ends }: { color: string; dash?: string; ends: 0 | 1 | 2 }) => (
  <svg width="30" height="10" className="shrink-0" aria-hidden="true">
    <line x1={ends === 2 ? 6 : 1} y1="5" x2={ends ? 24 : 29} y2="5" stroke={color} strokeWidth="1.6" strokeDasharray={dash} />
    {ends >= 1 && <polygon points="29,5 22,2 22,8" fill={color} />}
    {ends === 2 && <polygon points="1,5 8,2 8,8" fill={color} />}
  </svg>
)

export default function Graph() {
  const { pages, folders } = useStore()
  const nav = useNavigate()
  const { graph: g0, set } = useSettings()
  const gs = { text: true, meta: true, parent: true, isolated: true, cluster: false, ...g0 }
  const [ctl, setCtl] = useState(false)
  const [focus, setFocus] = useState('')
  const [depth, setDepth] = useState(1)
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  const colorOf = (fid: string) => folderColor(folders, fid)

  const schemas = useStore((s) => s.schemas)

  const { nodes, links } = useMemo(() => {
    const list = Object.values(pages)
    const ids = new Set(list.map((p) => p.id))
    // Un solo arco per coppia di pagine: source→target; back = esiste anche il link inverso (reciproco).
    // Tipi di collegamento: «link» (nel testo), «meta» (appunti e schede), «parent» (madre → sottopagina); si possono nascondere.
    const edges = new Map<string, any>()
    list.forEach((p) => {
      const text = new Set<string>(), meta = new Set<string>()
      for (const m of p.body.matchAll(/\]\(wiki:([^)\s]+)\)/g)) text.add(m[1])
      refsOf(p, schemas).forEach((t) => meta.add(t))
      new Set([...text, ...meta]).forEach((t) => {
        if (!ids.has(t) || t === p.id) return
        const kind = gs.text && text.has(t) ? 'link' : gs.meta && meta.has(t) ? 'meta' : ''
        if (!kind) return
        const rev = t + '>' + p.id, key = p.id + '>' + t
        if (edges.has(rev)) edges.get(rev).back = true
        else if (!edges.has(key)) edges.set(key, { source: p.id, target: t, back: false, kind })
      })
    })
    if (gs.parent) list.forEach((p) => {
      if (!p.parent || p.parent === p.id || !ids.has(p.parent)) return
      edges.set(p.parent + '>' + p.id + '#parent', { source: p.parent, target: p.id, back: false, kind: 'parent' })
    })
    let edgeList = [...edges.values()]
    // Vicinato: solo le pagine entro `depth` passi dalla pagina scelta
    let keep: Set<string> | null = null
    if (focus && ids.has(focus)) {
      keep = new Set([focus])
      for (let d = 0; d < depth; d++) {
        const add = new Set<string>()
        edgeList.forEach((e) => { if (keep!.has(e.source) && !keep!.has(e.target)) add.add(e.target); if (keep!.has(e.target) && !keep!.has(e.source)) add.add(e.source) })
        add.forEach((x) => keep!.add(x))
      }
      edgeList = edgeList.filter((e) => keep!.has(e.source) && keep!.has(e.target))
    }
    const deg: Record<string, number> = {}
    edgeList.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1 })
    const shown = list.filter((p) => (keep ? keep.has(p.id) : gs.isolated || deg[p.id]))
    const nodes: any[] = shown.map((p) => ({ id: p.id, title: p.title || 'Senza titolo', fid: p.folder || '', star: !!p.star, deg: deg[p.id] || 0, r: 5 + Math.min(10, (deg[p.id] || 0) * 1.5) }))
    const links = edgeList
    // Disposizione: i nodi molto collegati si respingono di più e hanno legami più lunghi; due leggere forze verso il centro
    // tengono vicini anche i gruppi separati; con «Raggruppa per cartella» ogni cartella ha un suo punto di attrazione.
    const fids = [...new Set(nodes.map((n) => n.fid))]
    const R = 120 + 80 * Math.sqrt(fids.length)
    const anchor: Record<string, { x: number; y: number }> = {}
    fids.forEach((f, i) => { const a = (i / fids.length) * 2 * Math.PI; anchor[f] = { x: Math.cos(a) * R, y: Math.sin(a) * R } })
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d: any) => d.id).distance((l: any) => (l.kind === 'parent' ? 55 : 70 + 14 * Math.sqrt(Math.max(l.source.deg, l.target.deg)))))
      .force('charge', forceManyBody().strength((d: any) => -160 - 55 * Math.sqrt(d.deg)).distanceMax(450))
      .force('x', forceX((d: any) => (gs.cluster ? anchor[d.fid].x : 0)).strength(gs.cluster ? 0.14 : 0.05))
      .force('y', forceY((d: any) => (gs.cluster ? anchor[d.fid].y : 0)).strength(gs.cluster ? 0.14 : 0.07))
      .force('collide', forceCollide((d: any) => d.r + 18).strength(0.9).iterations(2))
      .stop()
    for (let i = 0; i < 400; i++) sim.tick()
    return { nodes, links }
  }, [pages, schemas, gs.text, gs.meta, gs.parent, gs.isolated, gs.cluster, focus, depth])

  const hasNodes = nodes.length > 0
  const viewRef = useRef(view); viewRef.current = view

  // Inquadra tutti i nodi nello spazio disponibile.
  const fit = () => {
    const el = svg.current
    if (!el || !nodes.length) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x0 = Math.min(...nodes.map((n) => n.x - n.r - 40)), x1 = Math.max(...nodes.map((n) => n.x + n.r + 40))
    const y0 = Math.min(...nodes.map((n) => n.y - n.r - 10)), y1 = Math.max(...nodes.map((n) => n.y + n.r + 30))
    const s = Math.min((r.width * 0.92) / (x1 - x0), (r.height * 0.92) / (y1 - y0))
    setView({ k: clampK(s / Math.min(r.width / W, r.height / H)), x: (x0 + x1) / 2, y: (y0 + y1) / 2 })
  }
  const layoutKey = [gs.text, gs.meta, gs.parent, gs.isolated, gs.cluster, focus, depth].join('|')
  useEffect(() => { fit() }, [hasNodes, layoutKey])

  // Rotella e pinch sul trackpad: listener nativo non passivo, così il browser non ingrandisce la pagina.
  // Lo zoom resta ancorato al punto sotto il cursore.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current, r = el.getBoundingClientRect()
      const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2
      const s = Math.min(r.width / (W / v.k), r.height / (H / v.k))
      const d = Math.max(-50, Math.min(50, e.deltaY))
      const k = clampK(v.k * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)))
      const s2 = (s * k) / v.k
      setView({ k, x: v.x + cx / s - cx / s2, y: v.y + cy / s - cy / s2 })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasNodes])
  const zoomBy = (f: number) => setView((v) => ({ ...v, k: clampK(v.k * f) }))

  if (!Object.keys(pages).length) return <p className="mt-[18vh] text-center text-muted">Ancora nessuna pagina.</p>

  const near = hover ? new Set(links.flatMap((l) => (l.source.id === hover ? [l.target.id] : l.target.id === hover ? [l.source.id] : []))) : null
  const dim = (id: string) => (hover && id !== hover && !near!.has(id) ? 0.15 : 1)
  // Con molti collegamenti: linee più tenui, frecce solo da vicino, nomi solo per le pagine più collegate (tutti, se ingrandisci)
  const calm = links.length > 120 ? 0.28 : links.length > 50 ? 0.4 : 0.6
  const minDeg = view.k < 0.45 ? 8 : view.k < 0.8 ? 4 : view.k < 1.3 ? 2 : 0
  const fs = Math.min(26, Math.max(8, 11 / view.k))
  const arrows = view.k >= 0.6
  // Legenda dei colori: le cartelle che hanno pagine, con il colore effettivo (anche ereditato); quelle grigie si omettono
  const used = new Set(Object.values(pages).map((p) => p.folder || ''))
  const legend = folders.filter((f) => used.has(f.id)).map((f) => ({ id: f.id, name: f.name, color: colorOf(f.id) })).filter((f) => f.color !== 'var(--muted)')

  const edge = (l: any, i: number) => {
    const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y
    const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len
    const a = { x: l.source.x + ux * (l.source.r + 2), y: l.source.y + uy * (l.source.r + 2) }
    const b = { x: l.target.x - ux * (l.target.r + 2), y: l.target.y - uy * (l.target.r + 2) }
    // d = +1: la freccia punta nel verso source→target; d = -1: nel verso opposto
    const head = (p: { x: number; y: number }, d: number) =>
      `${p.x},${p.y} ${p.x - d * ux * 9 - uy * 4},${p.y - d * uy * 9 + ux * 4} ${p.x - d * ux * 9 + uy * 4},${p.y - d * uy * 9 - ux * 4}`
    const hot = hover && (l.source.id === hover || l.target.id === hover)
    if (l.kind === 'parent') return (
      <g key={i} opacity={hover ? (hot ? 1 : 0.08) : Math.min(0.8, calm + 0.2)}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--gold)" strokeWidth={1.6} strokeDasharray="5 4" />
      </g>
    )
    const col = l.back ? 'var(--accent)' : 'var(--muted)'
    return (
      <g key={i} opacity={hover ? (hot ? 1 : 0.08) : calm}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={l.back ? 1.6 : 1} strokeDasharray={l.kind === 'meta' ? '2 3' : undefined} />
        {(arrows || hot) && <polygon points={head(b, 1)} fill={col} />}
        {l.back && (arrows || hot) && <polygon points={head(a, -1)} fill={col} />}
      </g>
    )
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-paper">
      <svg ref={svg} viewBox={`${view.x - W / 2 / view.k} ${view.y - H / 2 / view.k} ${W / view.k} ${H / view.k}`} className="h-full w-full cursor-grab touch-none"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false } }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || !svg.current) return
          const dx = e.clientX - d.x, dy = e.clientY - d.y
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
          const r = svg.current.getBoundingClientRect()
          const s = Math.min(r.width / (W / view.k), r.height / (H / view.k))
          d.x = e.clientX; d.y = e.clientY
          setView((v) => ({ ...v, x: v.x - dx / s, y: v.y - dy / s }))
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))} onPointerLeave={() => (drag.current = null)}>
        {links.map(edge)}
        {nodes.map((n) => {
          const lit = hover === n.id || near?.has(n.id) || n.id === focus
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={dim(n.id)} className="cursor-pointer"
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={(e) => { if (drag.current?.moved) return; if (e.shiftKey) setFocus(n.id); else nav('/w/' + n.id) }}>
              <circle r={n.r} fill={colorOf(n.fid)} stroke={n.id === focus ? 'var(--accent)' : n.star ? 'var(--gold)' : 'var(--paper)'} strokeWidth={n.id === focus || n.star ? 3 : 2} />
              {(lit || n.star || n.deg >= minDeg) && <text y={n.r + fs + 2} textAnchor="middle" fontSize={fs} fill="var(--ink)" stroke="var(--paper)" strokeWidth={3} style={{ paintOrder: 'stroke' }}>{n.star ? '★ ' : ''}{n.title}</text>}
            </g>
          )
        })}
        {!nodes.length && <text x={view.x} y={view.y} textAnchor="middle" fontSize={14 / view.k} fill="var(--muted)">Nessuna pagina con questi filtri</text>}
      </svg>
      <div className="absolute left-3 top-3 z-10 grid gap-2">
        <button onClick={() => setCtl(!ctl)} className="self-start rounded-md border border-line bg-panel/90 px-2.5 py-1 text-xs hover:border-accent">{ctl ? 'Chiudi' : 'Filtri e vista'}</button>
        {ctl && (
          <div className="grid w-64 gap-2.5 rounded-lg border border-line bg-panel/95 p-3 text-xs shadow-lg">
            <p className="text-muted">{nodes.length} pagine · {links.length} collegamenti</p>
            {([['text', 'Collegamenti nel testo'], ['meta', 'Appunti e schede'], ['parent', 'Madre → sottopagina'], ['isolated', 'Pagine senza collegamenti'], ['cluster', 'Raggruppa per cartella']] as const).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-accent" checked={!!gs[k]} onChange={() => set({ graph: { ...gs, [k]: !gs[k] } })} />{label}
              </label>
            ))}
            <div className="grid gap-1 border-t border-line pt-2.5">
              <span className="text-muted">Solo il vicinato di una pagina</span>
              <PagePick className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-accent" value={focus} placeholder="Tutte le pagine"
                options={Object.values(pages).sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))} onChange={setFocus} />
              {focus && (
                <label className="flex items-center gap-2 text-sm">Fino a
                  <select className="rounded-md border border-line bg-paper px-1.5 py-0.5" value={depth} onChange={(e) => setDepth(+e.target.value)}>
                    <option value={1}>1 passo</option><option value={2}>2 passi</option><option value={3}>3 passi</option>
                  </select>
                </label>
              )}
              <span className="text-muted">Maiusc + clic su un nodo: mostra solo il suo vicinato.</span>
            </div>
          </div>
        )}
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <button onClick={() => zoomBy(1 / 1.4)} aria-label="Riduci" title="Riduci" className="h-7 w-7 rounded-md border border-line bg-panel/90 text-sm hover:border-accent">−</button>
        <button onClick={() => zoomBy(1.4)} aria-label="Ingrandisci" title="Ingrandisci" className="h-7 w-7 rounded-md border border-line bg-panel/90 text-sm hover:border-accent">+</button>
        <button onClick={fit} title="Inquadra tutte le pagine" className="rounded-md border border-line bg-panel/90 px-2.5 py-1 text-xs hover:border-accent">Tutto</button>
      </div>
      {legend.length > 0 && (
        <div className="scroll-pretty absolute bottom-3 left-3 grid max-h-48 gap-1 overflow-auto rounded-lg border border-line bg-panel/90 px-3 py-2 text-xs">
          <span className="font-medium">Colore = cartella</span>
          {legend.map((f) => (
            <span key={f.id} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />{f.name}</span>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 right-3 grid gap-1.5 rounded-lg border border-line bg-panel/90 px-3 py-2 text-xs">
        <span className="font-medium">Collegamenti</span>
        <span className="flex items-center gap-2"><Sample color="var(--muted)" ends={1} />a senso unico (nel testo)</span>
        <span className="flex items-center gap-2"><Sample color="var(--accent)" ends={2} />reciproco</span>
        <span className="flex items-center gap-2"><Sample color="var(--muted)" dash="2 3" ends={1} />da appunti e schede (metadati)</span>
        <span className="flex items-center gap-2"><Sample color="var(--gold)" dash="5 4" ends={0} />madre → sottopagina</span>
        <span className="flex items-center gap-2"><span className="text-gold">★</span>pagina principale (anello dorato)</span>
        <span className="text-muted">Più collegamenti, cerchio più grande</span>
      </div>
    </div>
  )
}

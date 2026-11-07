import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { useStore } from './store'
import { useSettings } from './settings'
import { COLORS, MapBg, MapLayer, newId } from './types'
import { Icon, Resizer, useConfirm } from './ui'

type Tool = 'select' | 'marker' | 'line' | 'polygon' | 'edit' | 'drag' | 'remove'
const TOOLS: [Tool, string, string, string][] = [
  ['select', 'cursor', 'Seleziona', 'Clic su un elemento: nome, colore, livello, pagina'],
  ['marker', 'pin', 'Segnaposto', 'Clic per posizionare (Esc per finire)'],
  ['line', 'route', 'Rotta', "Clic per ogni punto; clic sull'ultimo per terminare"],
  ['polygon', 'polygon', 'Confine', 'Clic per ogni vertice; clic sul primo punto per chiudere'],
  ['edit', 'edit', 'Forma', 'Trascina i vertici'],
  ['drag', 'move', 'Sposta', 'Trascina gli elementi'],
  ['remove', 'trash', 'Elimina', 'Clic su un elemento per eliminarlo'],
]
const KIND: Record<string, string> = { Point: 'Segnaposto', LineString: 'Rotta', Polygon: 'Confine' }
// Le mappe create prima degli sfondi multipli hanno solo `image`: la trattiamo come unico sfondo.
const bgsOf = (d: any): MapBg[] => d.backgrounds ?? [{ id: 'base', name: 'Base', image: d.image, visible: true, opacity: 1 }]
// Sposta (ricorsivamente) coordinate Leaflet in orizzontale: serve per le copie "fantasma" e per riportare
// un elemento nel riquadro principale quando la mappa è ciclica.
const shiftLL = (ll: any, off: number): any => (Array.isArray(ll) ? ll.map((x) => shiftLL(x, off)) : L.latLng(ll.lat, ll.lng + off))
const pin = (c: string) => {
  const el = document.createElement('div'); el.className = 'pin'; el.style.background = c
  return L.divIcon({ className: '', html: el, iconSize: [16, 16], iconAnchor: [8, 8] })
}

// La mappa è un'immagine in coordinate piane. Gli elementi sono GeoJSON; ognuno sta in un livello
// (es. "Confini") e può avere un colore proprio: un livello contiene tanti regni di colori diversi.
export default function MapView({ id }: { id: string }) {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { ask, dialog } = useConfirm()
  const doc = useStore((s) => s.maps[id])
  const patchMap = useStore((s) => s.patchMap)
  const removeMap = useStore((s) => s.removeMap)
  const duplicateMap = useStore((s) => s.duplicateMap)
  const { rightW, resize } = useSettings()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const groups = useRef<Record<string, L.FeatureGroup>>({})
  const byId = useRef<Record<string, any>>({})
  const overlays = useRef<Record<string, any>>({})
  const urls = useRef<Record<string, string>>({})
  const ghosts = useRef<L.FeatureGroup | null>(null)
  const pending = useRef(new Set<string>())
  const bgFile = useRef<HTMLInputElement>(null)
  const docRef = useRef(doc); docRef.current = doc
  const focusRef = useRef<(fid: string) => void>()
  const [active, setActive] = useState(doc?.layers[0]?.id ?? '')
  const activeRef = useRef(active); activeRef.current = active
  const [tool, setToolState] = useState<Tool>('select')
  const toolRef = useRef<Tool>('select')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [joining, setJoining] = useState('')
  const joinRef = useRef('')
  const [showNames, setShowNames] = useState(true)

  const layerColor = (lid: string) => docRef.current?.layers.find((l) => l.id === lid)?.color ?? '#888'
  const featColor = (p: any) => p.color || layerColor(p.layer)
  const group = (lid: string) => (groups.current[lid] ??= L.featureGroup())

  // Un'area può avere più parti non confinanti (un regno con possedimenti lontani): sono elementi separati con lo stesso `group`.
  // Nome, colore, livello e pagina valgono per tutta l'area; il nome compare una volta sola, sulla parte più grande.
  const gk = (p: any) => p.group || p.id
  const parts = (l: any): any[] => { const k = gk(l.feature.properties); return Object.values(byId.current).filter((x: any) => gk(x.feature.properties) === k) }
  const areaOf = (l: any) => { if (l instanceof L.Marker) return 0; const b = l.getBounds(); return Math.abs((b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest())) }
  const mainOf = (l: any) => parts(l).reduce((a: any, b: any) => (areaOf(b) > areaOf(a) ? b : a), l)
  const setAll = (l: any, key: string, v: any) => parts(l).forEach((x: any) => { x.feature.properties[key] = v })
  // Il nome è testo, non HTML (un nome come «Regno <del Nord>» si vede com'è); i poligoni lo portano al centro
  const tip = (t: any, n: string, ref: any) => {
    const el = document.createElement('span'); el.textContent = n
    const mk = ref instanceof L.Marker, pg = ref instanceof L.Polygon
    t.bindTooltip(el, { permanent: true, direction: pg ? 'center' : mk ? 'right' : 'top', offset: mk ? [10, 0] : [0, 0], className: 'map-label' })
  }
  const label = (l: any, show = true) => {
    l.unbindTooltip()
    const n = l.feature.properties.name
    if (n && show) tip(l, n, l)
  }
  const relabel = (l: any) => { const m = mainOf(l); parts(l).forEach((x: any) => label(x, x === m)) }

  // Sfondi: immagini sovrapposte nello stesso riquadro, ognuna con visibilità, opacità e ordine propri.
  // I disegni stanno in un livello a parte, quindi si possono cambiare gli sfondi senza toccarli.
  // Mappa ciclica: ogni sfondo è ripetuto a est e a ovest (5 copie), così il passaggio è continuo.
  const syncBgs = () => {
    const m = map.current, d = docRef.current
    if (!m || !d) return
    const list = bgsOf(d)
    const ks = d.loop ? [-2, -1, 0, 1, 2] : [0]
    const want = new Set(list.flatMap((b) => ks.map((k) => `${b.id}|${k}`)))
    Object.keys(overlays.current).forEach((key) => { if (!want.has(key)) { m.removeLayer(overlays.current[key]); delete overlays.current[key] } })
    Object.keys(urls.current).forEach((bid) => { if (!list.some((b) => b.id === bid)) { URL.revokeObjectURL(urls.current[bid]); delete urls.current[bid] } })
    list.forEach((b, i) => {
      const url = urls.current[b.id]
      if (!url) {
        if (pending.current.has(b.id)) return
        pending.current.add(b.id)
        useStore.getState().vault?.assetUrl(b.image.slice(6)).then((u) => {
          pending.current.delete(b.id)
          if (!map.current) { URL.revokeObjectURL(u); return }
          urls.current[b.id] = u
          syncBgs()
        })
        return
      }
      ks.forEach((k) => {
        const o = (overlays.current[`${b.id}|${k}`] ??= L.imageOverlay(url, [[0, k * d.w], [d.h, (k + 1) * d.w]], { pane: 'bg' }))
        o.setOpacity(b.opacity); o.setZIndex(i)
        if (b.visible && !m.hasLayer(o)) o.addTo(m)
        if (!b.visible && m.hasLayer(o)) m.removeLayer(o)
      })
    })
  }

  // Mappa ciclica: limiti verticali, zoom minimo (non più di ~3 copie in vista) e riporto della vista nel riquadro principale.
  const applyBounds = () => {
    const m = map.current, d = docRef.current
    if (!m || !d) return
    if (d.loop) {
      m.setMaxBounds([[-d.h * 0.25, -1e7], [d.h * 1.25, 1e7]])
      const mz = Math.min(Math.log2(Math.max(m.getSize().x, 1) / (3 * d.w)), 2.5)
      m.setMinZoom(mz)
      if (m.getZoom() < mz) m.setZoom(mz)
    } else { m.setMaxBounds(null); m.setMinZoom(-4) }
  }
  const applyLoop = () => { applyBounds(); syncBgs(); rebuildGhosts() }

  // Copie "fantasma" (non modificabili) degli elementi a est e a ovest; cliccandole si apre la scheda dell'originale.
  const rebuildGhosts = () => {
    const m = map.current, d = docRef.current
    if (!m || !d) return
    ghosts.current ??= L.featureGroup().addTo(m)
    ghosts.current.clearLayers()
    if (!d.loop) return
    Object.values(groups.current).forEach((g) => {
      if (!m.hasLayer(g)) return
      g.eachLayer((l: any) => [-1, 1].forEach((k) => {
        const off = k * d.w, name = l.feature.properties.name
        let gl: any
        if (l instanceof L.Marker) gl = L.marker(shiftLL(l.getLatLng(), off), { icon: l.options.icon, pmIgnore: true, keyboard: false } as any)
        else gl = (l instanceof L.Polygon ? L.polygon : L.polyline)(shiftLL(l.getLatLngs(), off), { ...l.options, pmIgnore: true } as any)
        if (name && mainOf(l) === l) tip(gl, name, l)
        gl.on('click', (e: any) => { L.DomEvent.stopPropagation(e); if (toolRef.current === 'select') L.popup({ minWidth: 220 }).setLatLng(e.latlng).setContent(popup(l)).openOn(m) })
        ghosts.current!.addLayer(gl)
      }))
    })
  }
  // Un elemento disegnato o trascinato oltre il bordo viene riportato nel riquadro principale.
  const normalize = (l: any) => {
    const d = docRef.current
    if (!d?.loop) return
    const k = Math.floor((l instanceof L.Marker ? l.getLatLng().lng : l.getBounds().getCenter().lng) / d.w)
    if (!k) return
    if (l instanceof L.Marker) l.setLatLng(shiftLL(l.getLatLng(), -k * d.w)); else l.setLatLngs(shiftLL(l.getLatLngs(), -k * d.w))
  }

  const save = (layers?: MapLayer[]) => {
    const features: any[] = []
    Object.values(groups.current).forEach((g) => g.eachLayer((l: any) => features.push(l.toGeoJSON())))
    patchMap({ ...docRef.current, layers: layers ?? docRef.current.layers, features })
    rebuildGhosts()
  }
  const style = (l: any) => {
    const c = featColor(l.feature.properties)
    if (l instanceof L.Marker) l.setIcon(pin(c))
    else l.setStyle({ color: c, weight: l instanceof L.Polygon ? 2 : 3, fillOpacity: 0.2 })
  }
  const popup = (l: any) => {
    const p = l.feature.properties
    const el = document.createElement('div'); el.className = 'map-pop'
    const name = document.createElement('input'); name.placeholder = 'Nome'; name.value = p.name || ''
    name.oninput = () => { setAll(l, 'name', name.value); relabel(l); save() }

    const colors = document.createElement('div'); colors.className = 'row'
    const swatches: HTMLButtonElement[] = []
    ;['', ...COLORS].forEach((c) => {
      const b = document.createElement('button'); b.className = 'sw'; b.title = c ? 'Colore dell\'elemento' : 'Colore del livello'
      b.style.background = c || layerColor(p.layer)
      if ((p.color || '') === c) b.classList.add('on')
      b.onclick = () => { setAll(l, 'color', c); swatches.forEach((s) => s.classList.remove('on')); b.classList.add('on'); parts(l).forEach(style); save() }
      swatches.push(b); colors.appendChild(b)
    })
    const custom = document.createElement('input'); custom.type = 'color'; custom.value = /^#/.test(p.color || '') ? p.color : '#888888'
    custom.style.cssText = 'width:26px;height:22px;padding:0;border:0'
    custom.oninput = () => { setAll(l, 'color', custom.value); swatches.forEach((s) => s.classList.remove('on')); parts(l).forEach(style); save() }
    colors.appendChild(custom)

    const lsel = document.createElement('select')
    docRef.current.layers.forEach((ly) => lsel.add(new Option(ly.name, ly.id)))
    lsel.value = p.layer
    lsel.onchange = () => { parts(l).forEach((x: any) => { const q = x.feature.properties; group(q.layer).removeLayer(x); q.layer = lsel.value; group(q.layer).addLayer(x); style(x) }); save() }

    const psel = document.createElement('select')
    psel.add(new Option('Nessuna pagina collegata', ''))
    Object.values(useStore.getState().pages).sort((a, b) => a.title.localeCompare(b.title)).forEach((pg) => psel.add(new Option(pg.title || 'Senza titolo', pg.id)))
    psel.value = p.page || ''
    psel.onchange = () => { setAll(l, 'page', psel.value); save() }

    const go = document.createElement('button'); go.textContent = 'Apri pagina'
    go.onclick = () => { if (p.page) nav('/w/' + p.page) }
    const small = (t: string) => { const s = document.createElement('small'); s.textContent = t; return s }
    el.append(name, small('Colore'), colors, small('Livello'), lsel, small('Pagina'), psel, go)
    // Aree non confinanti
    const ps = parts(l)
    if (l instanceof L.Polygon) {
      const add = document.createElement('button'); add.textContent = '＋ Aggiungi un\'altra parte'; add.title = 'Disegna una parte separata che fa parte della stessa area (es. possedimenti lontani)'
      add.onclick = () => { joinRef.current = gk(p); setJoining(p.name || 'questa area'); map.current.closePopup(); setTool('polygon') }
      el.append(add)
    }
    if (ps.length > 1) {
      el.append(small(`Quest'area ha ${ps.length} parti`))
      const det = document.createElement('button'); det.textContent = 'Rendi indipendente questa parte'
      det.onclick = () => {
        const others = ps.filter((o: any) => o !== l)
        if (gk(p) === p.id) { const nk = newId(); others.forEach((o: any) => { o.feature.properties.group = nk }) }
        delete p.group; relabel(l); relabel(others[0]); map.current.closePopup(); save()
      }
      const del = document.createElement('button'); del.textContent = 'Elimina tutte le parti'
      del.onclick = () => ask({ title: `Eliminare l'area «${p.name || 'senza nome'}»?`, text: `Vengono eliminate tutte le ${ps.length} parti.`, label: 'Elimina area', danger: true }, () => {
        ps.forEach((x: any) => { group(x.feature.properties.layer).removeLayer(x); delete byId.current[x.feature.properties.id] })
        map.current.closePopup(); save()
      })
      el.append(det, del)
    }
    return el
  }

  const register = (l: any) => {
    const p = l.feature.properties
    p.id ??= newId()
    byId.current[p.id] = l
    group(p.layer).addLayer(l)
    relabel(l)
    l.on('pm:edit', () => save())
    l.on('pm:dragend', () => { normalize(l); save() })
    l.on('click', (e: any) => {
      if (toolRef.current !== 'select') return
      L.DomEvent.stopPropagation(e)
      L.popup({ minWidth: 220 }).setLatLng(e.latlng).setContent(popup(l)).openOn(map.current)
    })
  }

  const setTool = (t: Tool) => {
    const pm = map.current?.pm
    if (!pm) return
    if (t !== 'polygon') { joinRef.current = ''; setJoining('') }
    pm.disableDraw(); pm.disableGlobalEditMode(); pm.disableGlobalDragMode(); pm.disableGlobalRemovalMode()
    map.current.closePopup()
    if (t === 'marker') pm.enableDraw('Marker', { continueDrawing: true })
    if (t === 'line') pm.enableDraw('Line')
    if (t === 'polygon') pm.enableDraw('Polygon')
    if (t === 'edit') pm.enableGlobalEditMode()
    if (t === 'drag') pm.enableGlobalDragMode()
    if (t === 'remove') pm.enableGlobalRemovalMode()
    toolRef.current = t; setToolState(t)
    box.current?.classList.toggle('tool-draw', ['marker', 'line', 'polygon'].includes(t))
  }

  useEffect(() => {
    if (!doc || !box.current) return
    const m: any = L.map(box.current, { crs: L.CRS.Simple, minZoom: -4, maxZoom: 3, zoomSnap: 0.25, attributionControl: false, zoomControl: false })
    map.current = m
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    const bounds: L.LatLngBoundsExpression = [[0, 0], [doc.h, doc.w]]
    m.createPane('bg'); m.getPane('bg').style.zIndex = '150'
    syncBgs()
    m.fitBounds(bounds)
    // Nomi: la dimensione segue lo zoom (più piccoli da lontano, mai illeggibili da vicino)
    const sizeLabels = () => box.current?.style.setProperty('--label-size', Math.max(9, Math.min(18, 12 * Math.pow(2, m.getZoom() * 0.3))) + 'px')
    m.on('zoom', sizeLabels); sizeLabels()

    doc.layers.forEach((l) => { const g = group(l.id); if (l.visible) g.addTo(m) })
    L.geoJSON({ type: 'FeatureCollection', features: doc.features } as any, {
      pointToLayer: (f, ll) => L.marker(ll, { icon: pin(featColor(f.properties)) }),
      style: (f) => ({ color: featColor(f?.properties), weight: f?.geometry.type === 'Polygon' ? 2 : 3, fillOpacity: 0.2 }),
      onEachFeature: (_f, l) => register(l),
    })

    applyLoop()

    m.on('pm:create', (e: any) => {
      const l = e.layer
      l.remove()
      const jg = joinRef.current
      const base: any = jg ? Object.values(byId.current).find((x: any) => gk(x.feature.properties) === jg) : null
      const bp = base?.feature.properties
      l.feature = { type: 'Feature', properties: { id: newId(), layer: bp?.layer ?? activeRef.current, name: bp?.name ?? '', page: bp?.page ?? '', color: bp?.color ?? '', ...(jg ? { group: jg } : {}) } }
      joinRef.current = ''; setJoining('')
      normalize(l); style(l); register(l); save()
      if (e.shape !== 'Marker') setTool('select')
    })
    m.on('pm:remove', (e: any) => {
      const pr = e.layer.feature?.properties
      if (pr?.id) delete byId.current[pr.id]
      Object.values(groups.current).forEach((g) => g.removeLayer(e.layer))
      const rest: any = pr && Object.values(byId.current).find((x: any) => gk(x.feature.properties) === gk(pr))
      if (rest) relabel(rest)
      save()
    })
    m.on('moveend', () => {
      const d = docRef.current
      if (!d?.loop || ['marker', 'line', 'polygon'].includes(toolRef.current)) return
      const c = m.getCenter()
      if (c.lng >= 0 && c.lng < d.w) return
      m.closePopup()
      m.setView([c.lat, c.lng - Math.floor(c.lng / d.w) * d.w], m.getZoom(), { animate: false })
    })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setTool('select') }
    addEventListener('keydown', key)
    const ro = new ResizeObserver(() => { m.invalidateSize(); if (docRef.current?.loop) applyBounds() })
    ro.observe(box.current)
    return () => { removeEventListener('keydown', key); ro.disconnect(); m.remove(); map.current = null; groups.current = {}; byId.current = {}; Object.values(urls.current).forEach((u) => URL.revokeObjectURL(u)); urls.current = {}; overlays.current = {}; ghosts.current = null; pending.current.clear() }
  }, [])

  // Visibilità e colori dei livelli; il livello attivo decide colore e destinazione dei nuovi disegni.
  useEffect(() => {
    const m = map.current
    if (!m || !doc) return
    doc.layers.forEach((l) => {
      const g = group(l.id)
      if (l.visible && !m.hasLayer(g)) g.addTo(m)
      if (!l.visible && m.hasLayer(g)) m.removeLayer(g)
      g.eachLayer(style)
    })
    m.pm.setGlobalOptions({ pathOptions: { color: layerColor(active) }, markerStyle: { icon: pin(layerColor(active)) } })
    rebuildGhosts()
  }, [doc?.layers, active])

  useEffect(() => {
    const f = sp.get('f')
    if (!f) return
    const t = window.setTimeout(() => focusRef.current?.(f), 400)
    return () => clearTimeout(t)
  }, [sp])

  useEffect(() => { syncBgs() }, [doc?.backgrounds])
  useEffect(() => { box.current?.classList.toggle('names-off', !showNames) }, [showNames])
  useEffect(() => { applyLoop() }, [doc?.loop])

  if (!doc) return <p className="mt-[18vh] text-center text-muted">Mappa non trovata.</p>
  const bgs = bgsOf(doc)
  const setBgs = (b: MapBg[]) => patchMap({ ...docRef.current, backgrounds: b })
  const patchBg = (bid: string, p: Partial<MapBg>) => setBgs(bgs.map((b) => (b.id === bid ? { ...b, ...p } : b)))
  const moveBg = (i: number, d: number) => { const a = [...bgs]; [a[i], a[i + d]] = [a[i + d], a[i]]; setBgs(a) }
  const removeBg = (bid: string) => ask({ title: 'Rimuovere questo sfondo?', text: 'I disegni restano dove sono.', label: 'Rimuovi sfondo', danger: true }, () => setBgs(bgs.filter((b) => b.id !== bid)))
  const addBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const name = await useStore.getState().vault!.addAsset(f)
    setBgs([...bgs, { id: newId(), name: f.name.replace(/\.[^.]+$/, ''), image: 'asset:' + name, visible: true, opacity: 1 }])
  }
  const setLayers = (layers: MapLayer[]) => patchMap({ ...docRef.current, layers })
  const patchLayer = (lid: string, p: Partial<MapLayer>) => setLayers(doc.layers.map((x) => (x.id === lid ? { ...x, ...p } : x)))
  const focus = (fid: string) => {
    const l = byId.current[fid], m = map.current
    if (!l || !m) return
    const ps = parts(l), mn = mainOf(l)
    if (ps.length > 1) m.fitBounds(L.featureGroup(ps).getBounds().pad(0.2), { maxZoom: 2 })
    else if (l.getBounds) m.fitBounds(l.getBounds().pad(0.5), { maxZoom: 2 }); else m.setView(l.getLatLng(), Math.max(m.getZoom(), 0))
    if (toolRef.current === 'select') L.popup({ minWidth: 220 }).setLatLng(mn.getBounds ? mn.getBounds().getCenter() : mn.getLatLng()).setContent(popup(mn)).openOn(m)
  }

  focusRef.current = focus

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-paper">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
          <input className="font-display min-w-0 flex-1 bg-transparent text-xl outline-none" value={doc.title} onChange={(e) => patchMap({ ...docRef.current, title: e.target.value })} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted" title="La mappa si ripete in orizzontale: andando verso est si torna al punto di partenza">
            <input type="checkbox" className="accent-accent" checked={!!doc.loop} onChange={() => patchMap({ ...docRef.current, loop: !doc.loop })} />Mondo ciclico
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted" title="Mostra o nascondi i nomi sulla mappa">
            <input type="checkbox" className="accent-accent" checked={showNames} onChange={() => setShowNames(!showNames)} />Nomi
          </label>
          <button className="flex items-center gap-1.5 text-sm text-muted hover:text-ink hover:underline" title="Crea una copia con livelli, elementi, sfondi e impostazioni" onClick={() => nav('/map/' + duplicateMap(id))}><Icon n="copy" size={15} /> Duplica</button>
          <button className="flex items-center gap-1.5 text-sm text-danger hover:underline" onClick={() => ask({ title: `Eliminare la mappa «${doc.title}»?`, text: 'Non si può annullare: le mappe non passano dal Cestino.', label: 'Elimina mappa', danger: true }, () => { removeMap(id); nav('/maps') })}><Icon n="trash" size={16} /> Elimina</button>
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={box} className="absolute inset-0" />
          {joining && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-accent bg-panel/95 px-3 py-1 text-xs shadow-lg">
              Disegna la nuova parte di «{joining}»: un clic per vertice, Esc per annullare
            </div>
          )}
          <div className="absolute left-3 top-3 z-10 flex gap-0.5 rounded-xl border border-line bg-panel/95 p-1 shadow-lg backdrop-blur">
            {TOOLS.map(([t, icon, label, hint], i) => (
              <span key={t} className="flex items-center">
                {(i === 1 || i === 4) && <span className="mx-1 h-5 w-px bg-line" />}
                <button onClick={() => setTool(t)} title={`${label} — ${hint}`} aria-pressed={tool === t}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${tool === t ? 'bg-accent text-on-accent' : 'text-muted hover:bg-line/60 hover:text-ink'}`}>
                  <Icon n={icon} size={16} />{label}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <Resizer onDrag={(dx) => resize('rightW', -dx)} />
      <aside className="scroll-pretty shrink-0 overflow-auto bg-transparent pl-3" style={{ width: rightW }}>
        <h3 className="font-display mb-2 text-lg">Sfondi</h3>
        <div className="mb-5 grid gap-1.5">
          {bgs.map((b, i) => (
            <div key={b.id} className="rounded-xl border border-line bg-paper px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={b.visible} title="Visibile" onChange={() => patchBg(b.id, { visible: !b.visible })} className="accent-accent" />
                <input value={b.name} onChange={(e) => patchBg(b.id, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" />
                <button aria-label="Porta sopra" disabled={i === bgs.length - 1} onClick={() => moveBg(i, 1)} className="text-muted hover:text-ink disabled:opacity-30"><Icon n="chev" size={14} className="-rotate-90" /></button>
                <button aria-label="Porta sotto" disabled={i === 0} onClick={() => moveBg(i, -1)} className="text-muted hover:text-ink disabled:opacity-30"><Icon n="chev" size={14} className="rotate-90" /></button>
                <button aria-label="Rimuovi sfondo" onClick={() => removeBg(b.id)} className="text-muted hover:text-danger"><Icon n="trash" size={14} /></button>
              </div>
              <label className="mt-1 flex items-center gap-2 text-[11px] text-muted">Opacità
                <input type="range" min={0.05} max={1} step={0.05} value={b.opacity} onChange={(e) => patchBg(b.id, { opacity: +e.target.value })} className="flex-1 accent-accent" />
              </label>
            </div>
          ))}
          <button onClick={() => bgFile.current?.click()} className="flex items-center gap-1.5 px-1 text-sm text-accent hover:underline"><Icon n="plus" size={15} /> Aggiungi immagine</button>
          <input ref={bgFile} type="file" accept="image/*" hidden onChange={addBg} />
        </div>
        <h3 className="font-display mb-2 text-lg">Livelli</h3>
        <div className="grid gap-1.5">
          {doc.layers.map((l) => {
            const feats = doc.features.filter((f) => f.properties.layer === l.id)
            const rows = new Map<string, any[]>()
            feats.forEach((f) => { const k = f.properties.group || f.properties.id; const a = rows.get(k); if (a) a.push(f); else rows.set(k, [f]) })
            const isOpen = open[l.id] ?? active === l.id
            return (
              <div key={l.id} className={`rounded-xl border bg-paper ${active === l.id ? 'border-accent' : 'border-line'}`}>
                <div className="flex items-center gap-1.5 px-2 py-1.5" onClick={() => setActive(l.id)}>
                  <button aria-label="Mostra elementi" onClick={(e) => { e.stopPropagation(); setOpen({ ...open, [l.id]: !isOpen }) }} className="text-muted"><Icon n="chev" size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} /></button>
                  <input type="checkbox" checked={l.visible} title="Visibile" onClick={(e) => e.stopPropagation()} onChange={() => patchLayer(l.id, { visible: !l.visible })} className="accent-accent" />
                  <input type="color" value={l.color} title="Colore predefinito del livello" onClick={(e) => e.stopPropagation()} onChange={(e) => patchLayer(l.id, { color: e.target.value })} className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0" />
                  <input value={l.name} onChange={(e) => patchLayer(l.id, { name: e.target.value })} onFocus={() => setActive(l.id)} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" />
                  <span className="text-xs text-muted">{rows.size}</span>
                  <button aria-label="Elimina livello" className="text-muted hover:text-danger" onClick={(e) => {
                    e.stopPropagation()
                    ask({ title: `Eliminare il livello «${l.name}»?`, text: 'Anche tutti gli elementi che contiene vengono eliminati.', label: 'Elimina livello', danger: true }, () => {
                      const g = groups.current[l.id]
                      if (g) { map.current?.removeLayer(g); delete groups.current[l.id] }
                      Object.keys(byId.current).forEach((k) => { if (byId.current[k].feature.properties.layer === l.id) delete byId.current[k] })
                      const layers = doc.layers.filter((x) => x.id !== l.id)
                      setActive(layers[0]?.id ?? ''); save(layers)
                    })
                  }}><Icon n="trash" size={14} /></button>
                </div>
                {isOpen && (
                  <div className="border-t border-line px-1 py-1">
                    {[...rows.values()].map((fs) => { const f = fs[0]; return (
                      <button key={f.properties.id} onClick={() => focus(f.properties.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-line/60">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.properties.color || l.color }} />
                        <span className="min-w-0 flex-1 truncate">{f.properties.name || <span className="text-muted">Senza nome</span>}</span>
                        <span className="text-[10px] text-muted">{fs.length > 1 ? `${fs.length} parti` : KIND[f.geometry.type] ?? ''}</span>
                      </button>
                    ) })}
                    {!feats.length && <p className="px-2 py-1 text-xs text-muted">Nessun elemento. Disegna con il livello attivo.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button className="mt-3 flex items-center gap-1.5 px-1 text-sm text-accent hover:underline"
          onClick={() => { const nl = { id: newId(), name: 'Nuovo livello', color: COLORS[doc.layers.length % COLORS.length], visible: true }; setLayers([...doc.layers, nl]); setActive(nl.id); setOpen({ ...open, [nl.id]: true }) }}>
          <Icon n="plus" size={15} /> Nuovo livello
        </button>
      </aside>
      {dialog}
    </div>
  )
}

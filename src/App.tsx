import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from './store'
import { Page } from './types'
import { useSettings, useApplySettings } from './settings'
import { Icon, IconBtn, Modal, Resizer, field } from './ui'
import { HelpButton } from './Help'
import { Appearance } from './Appearance'
import Home from './Home'
import Sidebar from './Sidebar'
import Graph from './Graph'
import Timeline, { TimelinePanel } from './Timeline'
import MapView from './MapView'
import { MapsGallery, MapsPanel } from './MapsHome'
import MusicPlayer from './MusicPlayer'
import { PageView, PageSide } from './PageView'
import { CharactersPanel, CharactersView } from './Characters'

function Jump({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const pages = useStore((s) => s.pages)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const list = Object.values(pages).filter((p) => p.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 8)
  const go = (p?: Page) => { if (p) { nav('/w/' + p.id); onClose() } }
  return (
    <Modal onClose={onClose}>
      <input autoFocus className={field + ' rounded-b-none border-0 border-b py-3'} placeholder="Cerca una pagina…" value={q}
        onChange={(e) => { setQ(e.target.value); setI(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % Math.max(list.length, 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + list.length) % Math.max(list.length, 1)) }
          if (e.key === 'Enter') go(list[i])
        }} />
      <div className="p-1">
        {list.map((p, k) => (
          <button key={p.id} onClick={() => go(p)} onMouseEnter={() => setI(k)} className={`flex w-full justify-between rounded-md px-3 py-2 text-left text-sm ${k === i ? 'bg-accent text-on-accent' : ''}`}>
            <span className="truncate">{p.title || 'Senza titolo'}</span><span className="opacity-70">{p.type}</span>
          </button>
        ))}
        {!list.length && <p className="px-3 py-2 text-sm text-muted">Nessun risultato.</p>}
      </div>
    </Modal>
  )
}

type View = 'graph' | 'timeline' | 'maps' | 'map' | 'characters'
const NAV = [
  { id: 'pages', label: 'Pagine', icon: 'page', to: '/w' },
  { id: 'characters', label: 'Personaggi', icon: 'user', to: '/characters' },
  { id: 'maps', label: 'Mappe', icon: 'map', to: '/maps' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline', to: '/timeline' },
  { id: 'graph', label: 'Grafo', icon: 'graph', to: '/graph' },
]

function World({ view }: { view?: View }) {
  const { id } = useParams()
  const nav = useNavigate()
  const { vault, name, pages, maps, create } = useStore()
  const { left, right, leftW, rightW, set, resize } = useSettings()
  const [jump, setJump] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setJump(true) } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  if (!vault) return <Navigate to="/" replace />

  const section = view === 'map' ? 'maps' : view ?? 'pages'
  const page = !view && id ? pages[id] : undefined
  const crumb = page ? page.title || 'Senza titolo' : view === 'map' ? maps[id!]?.title ?? '' : view === 'characters' && id && pages[id] ? pages[id].title || 'Senza titolo' : NAV.find((n) => n.id === section)!.label
  const panel = section === 'characters' ? <CharactersPanel activeId={id} /> : section === 'maps' ? <MapsPanel activeId={id} /> : section === 'timeline' ? <TimelinePanel /> : <Sidebar activeId={id} />
  const dense = view === 'map' || view === 'timeline' || view === 'graph' || view === 'characters'

  return (
    <div className="flex h-full">
      <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
        <Link to="/" title="Tutti i mondi" className="font-display mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent text-lg text-on-accent shadow-sm">L</Link>
        {NAV.map((n) => {
          const on = n.id === section
          return (
            <Link key={n.id} to={n.to} aria-current={on ? 'page' : undefined}
              className={`relative flex w-14 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium ${on ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-line/60 hover:text-ink'}`}>
              {on && <span className="absolute -left-1 bottom-2 top-2 w-1 rounded-full bg-gold" />}
              <Icon n={n.icon} size={20} />{n.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel px-3">
          <IconBtn n="left" label="Mostra o nascondi il pannello laterale" active={left} onClick={() => set({ left: !left })} />
          <span className="font-display ml-1 truncate text-base">{name}</span>
          <span className="text-muted">/</span>
          <span className="truncate text-sm text-muted">{crumb}</span>
          <div className="flex-1" />
          <button onClick={() => setJump(true)} className="mr-1 hidden items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1 text-sm text-muted hover:border-accent hover:text-ink sm:flex">
            <Icon n="search" size={15} /> Cerca pagina <kbd className="rounded border border-line px-1 text-[10px]">Ctrl K</kbd>
          </button>
          <MusicPlayer />
          <Appearance />
          <HelpButton />
          {page && <IconBtn n="right" label="Mostra o nascondi note e collegamenti" active={right} onClick={() => set({ right: !right })} />}
        </header>

        <div className="flex min-h-0 flex-1">
          {left && (
            <>
              <div className="shrink-0 overflow-hidden bg-panel" style={{ width: leftW }}>{panel}</div>
              <Resizer onDrag={(dx) => resize('leftW', dx)} />
            </>
          )}
          <main className={`flex min-w-0 flex-1 flex-col overflow-hidden ${dense ? 'p-4' : 'p-6'}`}>
            {view === 'graph' ? <Graph />
              : view === 'characters' ? <CharactersView id={id} />
              : view === 'timeline' ? <Timeline />
              : view === 'maps' ? <MapsGallery />
              : view === 'map' ? (id && maps[id] ? <MapView key={id} id={id} /> : <p className="mt-[18vh] text-center text-muted">Mappa non trovata.</p>)
              : page ? <PageView key={page.id} page={page} />
              : (
                <div className="mx-auto mt-[16vh] grid justify-items-center gap-4 text-center">
                  <p className="font-display text-2xl">{id ? 'Pagina non trovata' : 'Scegli una pagina'}</p>
                  <p className="max-w-xs text-sm text-muted">{id ? 'Il link potrebbe puntare a una pagina eliminata.' : "Selezionala dall'elenco oppure creane una nuova."}</p>
                  <button onClick={() => nav('/w/' + create().id)} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"><Icon n="plus" size={16} /> Nuova pagina</button>
                </div>
              )}
          </main>
          {right && page && (
            <>
              <Resizer onDrag={(dx) => resize('rightW', -dx)} />
              <aside className="shrink-0 overflow-hidden bg-panel" style={{ width: rightW }}><PageSide page={page} /></aside>
            </>
          )}
        </div>
      </div>
      {jump && <Jump onClose={() => setJump(false)} />}
    </div>
  )
}

export default function App() {
  useApplySettings()
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/w" element={<World />} />
        <Route path="/w/:id" element={<World />} />
        <Route path="/characters" element={<World view="characters" />} />
        <Route path="/characters/:id" element={<World view="characters" />} />
        <Route path="/maps" element={<World view="maps" />} />
        <Route path="/map/:id" element={<World view="map" />} />
        <Route path="/timeline" element={<World view="timeline" />} />
        <Route path="/graph" element={<World view="graph" />} />
      </Routes>
    </HashRouter>
  )
}

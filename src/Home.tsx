import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { getRecents, pickWorld, reopen, removeRecent, Recent } from './storage'
import { Icon, Logo } from './ui'
import { HelpButton } from './Help'

const hue = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360

// Curve di livello decorative, in stile cartografico
const Contours = ({ className }: { className: string }) => (
  <svg aria-hidden className={`pointer-events-none absolute text-line ${className}`} viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="0.7">
    {Array.from({ length: 15 }, (_, i) => <ellipse key={i} cx="200" cy="200" rx={16 + i * 13} ry={11 + i * 11} transform={`rotate(${i * 6} 200 200)`} />)}
  </svg>
)

export default function Home() {
  const nav = useNavigate()
  const open = useStore((s) => s.open)
  const [recents, setRecents] = useState<Recent[]>([])
  const [err, setErr] = useState('')
  useEffect(() => { getRecents().then(setRecents) }, [])
  const go = async (getHandle: () => Promise<any>) => {
    try { await open(await getHandle()); nav('/w') } catch (e: any) { if (e?.name !== 'AbortError') setErr(e.message) }
  }

  return (
    <div className="relative flex min-h-full items-center overflow-hidden">
      <Contours className="-right-48 -top-48 h-[920px] w-[920px]" />
      <Contours className="-bottom-56 -left-40 h-[640px] w-[640px] opacity-70" />
      <main className="relative mx-auto grid w-full max-w-5xl gap-14 px-8 py-16 md:grid-cols-[1.1fr_1fr] md:items-center">
        <section className="grid content-start gap-6">
          <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px w-10 bg-gold" />Archivio di mondi</div>
          <div className="flex items-center gap-5">
            <Logo size={72} className="shrink-0 drop-shadow-sm" />
            <h1 className="font-display text-6xl leading-none sm:text-7xl">Lorekeeper</h1>
          </div>
          <p className="max-w-sm text-base text-muted">Pagine, mappe e cronologie del tuo mondo, in una cartella sul tuo disco.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => go(pickWorld)} className="rounded-lg bg-accent px-5 py-2.5 font-medium text-on-accent shadow-sm transition hover:opacity-90">Apri cartella del mondo</button>
            <HelpButton />
          </div>
          <p className="text-xs text-muted">Una cartella vuota diventa un mondo nuovo.</p>
          {!('showDirectoryPicker' in window) && <p className="rounded-lg border border-danger/50 p-3 text-sm text-danger">Questo browser non può accedere alle cartelle: usa Chrome, Edge o Brave.</p>}
          {err && <p className="text-sm text-danger">{err}</p>}
        </section>

        <section className="grid content-start gap-3">
          <h2 className="text-sm font-medium text-muted">Mondi recenti</h2>
          {recents.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Nessun mondo aperto di recente.</p>}
          {recents.map((r) => (
            <div key={r.name} className="group relative">
              <button onClick={() => go(() => reopen(r))}
                className="flex w-full items-center gap-4 rounded-xl border border-line bg-panel/80 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg font-display text-xl text-white" style={{ background: `hsl(${hue(r.name)} 38% 42%)` }}>{r.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg">{r.name}</span>
                  <span className="block text-xs text-muted">Apri mondo</span>
                </span>
                <Icon n="chev" className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
              <button aria-label={`Rimuovi ${r.name} dai recenti`} title="Rimuovi dai recenti"
                onClick={async () => { await removeRecent(r.name); setRecents(await getRecents()) }}
                className="absolute right-12 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted hover:text-danger group-hover:block"><Icon n="x" size={15} /></button>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

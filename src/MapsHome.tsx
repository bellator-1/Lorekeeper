import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Icon } from './ui'

function useNewMap() {
  const nav = useNavigate()
  const createMap = useStore((s) => s.createMap)
  const ref = useRef<HTMLInputElement>(null)
  const input = <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) nav('/map/' + (await createMap(f)).id) }} />
  return { pick: () => ref.current?.click(), input }
}

function Thumb({ image }: { image: string }) {
  const vault = useStore((s) => s.vault)
  const [url, setUrl] = useState('')
  useEffect(() => {
    let u = ''
    vault?.assetUrl(image.slice(6)).then((x) => { u = x; setUrl(x) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [image])
  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-line/50" />
}

// Pannello sinistro della sezione Mappe
export function MapsPanel({ activeId }: { activeId?: string }) {
  const maps = Object.values(useStore((s) => s.maps)).sort((a, b) => a.title.localeCompare(b.title))
  const { pick, input } = useNewMap()
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <button onClick={pick} className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:opacity-90"><Icon n="plus" size={16} /> Nuova mappa</button>
      {input}
      <div className="scroll-pretty -mx-1 grid min-h-0 flex-1 content-start gap-1 overflow-auto px-1">
        {maps.map((m) => (
          <Link key={m.id} to={'/map/' + m.id} className={`flex items-center gap-3 rounded-lg p-1.5 ${m.id === activeId ? 'bg-accent text-on-accent' : 'hover:bg-line/60'}`}>
            <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-line/60"><Thumb image={m.backgrounds?.find((b) => b.visible)?.image ?? m.image} /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{m.title}</span><span className="block text-xs opacity-70">{m.features.length} elementi</span></span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Vista principale della sezione Mappe, quando nessuna mappa è aperta
export function MapsGallery() {
  const maps = Object.values(useStore((s) => s.maps)).sort((a, b) => a.title.localeCompare(b.title))
  const { pick, input } = useNewMap()
  return (
    <div className="scroll-pretty h-full overflow-auto px-2 py-4">
      <h1 className="font-display mb-5 text-3xl">Mappe</h1>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {maps.map((m) => (
          <Link key={m.id} to={'/map/' + m.id} className="group overflow-hidden rounded-xl border border-line bg-paper shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
            <div className="aspect-[4/3] overflow-hidden"><Thumb image={m.backgrounds?.find((b) => b.visible)?.image ?? m.image} /></div>
            <div className="p-3"><div className="truncate font-display text-lg">{m.title}</div><div className="text-xs text-muted">{m.layers.length} livelli · {m.features.length} elementi</div></div>
          </Link>
        ))}
        <button onClick={pick} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line text-muted transition hover:border-accent hover:text-accent md:aspect-auto md:min-h-[200px]">
          <span className="grid justify-items-center gap-2"><Icon n="plus" size={26} /><span className="text-sm">Nuova mappa da immagine</span></span>
        </button>
      </div>
      {input}
    </div>
  )
}

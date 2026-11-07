import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { useSettings } from './settings'
import { newId, Track } from './types'
import { Icon, IconBtn, Popover, field } from './ui'

// Il lettore vive nell'header: la musica continua mentre navighi tra pagine, mappe e timeline.
export default function MusicPlayer() {
  const { music, vault, addTrack, removeTrack } = useStore()
  const { volume, set } = useSettings()
  const audio = useRef<HTMLAudioElement>(null)
  const urls = useRef<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState<'all' | 'one' | 'off'>('all')
  const [link, setLink] = useState('')

  useEffect(() => { if (audio.current) audio.current.volume = volume }, [volume])
  useEffect(() => () => Object.values(urls.current).forEach((u) => URL.revokeObjectURL(u)), [])

  const play = async (t: Track) => {
    const a = audio.current!
    a.src = t.kind === 'url' ? t.src : (urls.current[t.id] ??= await vault!.musicUrl(t.src))
    setCur(t.id)
    try { await a.play() } catch {}
  }
  const step = (d: number) => {
    if (!music.length) return
    const i = music.findIndex((t) => t.id === cur)
    play(music[(i + d + music.length) % music.length])
  }
  const toggle = () => {
    const a = audio.current!
    if (!cur) { if (music[0]) play(music[0]); return }
    a.paused ? a.play() : a.pause()
  }
  const ended = () => {
    if (mode === 'one') { audio.current!.currentTime = 0; audio.current!.play() }
    else if (mode === 'all') step(1)
  }
  const addFiles = async (files: FileList | null) => {
    for (const f of [...(files ?? [])]) {
      const src = await vault!.addMusic(f)
      addTrack({ id: newId(), name: f.name.replace(/\.[^.]+$/, ''), kind: 'file', src })
    }
  }
  const addLink = () => {
    const u = link.trim()
    if (!/^https?:\/\//.test(u)) return
    addTrack({ id: newId(), name: u.replace(/^https?:\/\//, '').slice(0, 42), kind: 'url', src: u })
    setLink('')
  }
  const remove = (t: Track) => {
    if (t.id === cur) { audio.current!.pause(); audio.current!.removeAttribute('src'); setCur(null) }
    removeTrack(t.id)
  }
  const now = music.find((t) => t.id === cur)
  const modes = { all: 'Ripeti tutto', one: 'Ripeti brano', off: 'Nessuna ripetizione' }

  return (
    <>
      <audio ref={audio} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={ended} />
      <Popover width="w-80" button={(open, t) => (
        <button onClick={t} title="Musica" aria-label="Musica" aria-pressed={open}
          className={`relative grid h-8 w-8 place-items-center rounded-md hover:bg-line/60 ${playing ? 'text-accent' : 'text-muted hover:text-ink'}`}>
          <Icon n="music" />{playing && <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
        </button>
      )}>
        <div className="grid gap-3">
          <div className="truncate font-display text-base">{now ? now.name : 'Nessun brano'}</div>
          <div className="flex items-center gap-1">
            <IconBtn n="prev" label="Precedente" onClick={() => step(-1)} />
            <button onClick={toggle} aria-label={playing ? 'Pausa' : 'Riproduci'} className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent hover:opacity-90"><Icon n={playing ? 'pause' : 'play'} size={16} /></button>
            <IconBtn n="next" label="Successivo" onClick={() => step(1)} />
            <button onClick={() => setMode(mode === 'all' ? 'one' : mode === 'one' ? 'off' : 'all')} title={modes[mode]} aria-label={modes[mode]}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-ink"><Icon n="repeat" size={15} />{mode === 'all' ? 'Tutto' : mode === 'one' ? 'Uno' : 'No'}</button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">Volume
            <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => set({ volume: +e.target.value })} className="flex-1 accent-accent" />
          </label>
          <div className="scroll-pretty -mx-1 max-h-44 overflow-auto px-1">
            {music.map((t) => (
              <div key={t.id} className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${t.id === cur ? 'bg-accent/15' : 'hover:bg-line/60'}`}>
                <button onClick={() => play(t)} className="min-w-0 flex-1 truncate text-left">{t.name}</button>
                <span className="text-[10px] text-muted">{t.kind === 'url' ? 'link' : 'file'}</span>
                <button aria-label="Rimuovi brano" onClick={() => remove(t)} className="hidden text-muted hover:text-danger group-hover:block"><Icon n="x" size={14} /></button>
              </div>
            ))}
            {!music.length && <p className="px-2 py-1 text-sm text-muted">La libreria è vuota.</p>}
          </div>
          <div className="grid gap-2 border-t border-line pt-3">
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-sm hover:border-accent"><Icon n="plus" size={15} /> Aggiungi file audio</button>
            <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <div className="flex gap-2">
              <input className={field} placeholder="Link a un file o a una radio…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <button onClick={addLink} className="rounded-md border border-line px-3 text-sm hover:border-accent">Aggiungi</button>
            </div>
          </div>
        </div>
      </Popover>
    </>
  )
}

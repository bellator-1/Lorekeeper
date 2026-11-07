import { useSettings } from './settings'
import { Popover } from './ui'

export function Seg<T extends string>({ v, o, on }: { v: T; o: [T, string][]; on: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {o.map(([k, l]) => (
        <button key={k} onClick={() => on(k)} className={`flex-1 rounded-md px-2 py-1 text-xs ${v === k ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  )
}
function Range({ label, v, min, max, step, unit = '', on }: { label: string; v: number; min: number; max: number; step: number; unit?: string; on: (v: number) => void }) {
  return (
    <label className="block text-xs text-muted">
      <span className="flex justify-between"><span>{label}</span><span>{v}{unit}</span></span>
      <input type="range" className="w-full accent-accent" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} />
    </label>
  )
}

export function Appearance() {
  const s = useSettings()
  return (
    <Popover button={(open, t) => (
      <button onClick={t} title="Aspetto" aria-label="Aspetto" aria-pressed={open} className={`h-8 rounded-md px-2 font-display text-base hover:bg-line/60 ${open ? 'text-ink' : 'text-muted hover:text-ink'}`}>Aa</button>
    )}>
      <div className="grid gap-3">
        <div className="grid gap-1"><span className="text-xs text-muted">Tema</span>
          <Seg v={s.theme} on={(theme) => s.set({ theme })} o={[['auto', 'Auto'], ['light', 'Chiaro'], ['dark', 'Scuro']]} /></div>
        <div className="grid gap-1"><span className="text-xs text-muted">Carattere del testo</span>
          <Seg v={s.font} on={(font) => s.set({ font })} o={[['serif', 'Serif'], ['display', 'Fraunces'], ['sans', 'Sans'], ['mono', 'Mono']]} /></div>
        <Range label="Dimensione" v={s.size} min={14} max={26} step={1} unit="px" on={(size) => s.set({ size })} />
        <Range label="Interlinea" v={s.lh} min={1.3} max={2.2} step={0.1} on={(lh) => s.set({ lh: +lh.toFixed(1) })} />
        <Range label="Larghezza pagina" v={s.width} min={560} max={1200} step={20} unit="px" on={(width) => s.set({ width })} />
      </div>
    </Popover>
  )
}

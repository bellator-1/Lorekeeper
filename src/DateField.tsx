import { useStore } from './store'
import { fromDay, toDay } from './calendar'
import { field } from './ui'

export function DateField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  const cal = useStore((s) => s.calendar)
  const d = value != null ? fromDay(cal, value) : null
  const set = (p: Partial<{ y: number; m: number; d: number }>) => {
    const n = { ...(d ?? { y: 0, m: 0, d: 1 }), ...p }
    onChange(toDay(cal, n.y, n.m, Math.max(1, Math.min(n.d, cal.months[n.m]?.days || 1))))
  }
  return (
    <div className="grid gap-1 text-xs text-muted">
      {label}
      {d ? (
        <div className="flex items-center gap-1">
          <input type="number" className={field} style={{ width: 56 }} value={d.d} onChange={(e) => set({ d: +e.target.value || 1 })} />
          <select className={field} value={d.m} onChange={(e) => set({ m: +e.target.value })}>
            {cal.months.map((m, i) => <option key={i} value={i}>{m.name}</option>)}
          </select>
          <input type="number" className={field} style={{ width: 84 }} value={d.y} onChange={(e) => set({ y: +e.target.value || 0 })} />
          <button aria-label="Rimuovi data" onClick={() => onChange(null)} className="px-1 hover:text-ink">✕</button>
        </div>
      ) : (
        <button className="text-left text-sm text-accent hover:underline" onClick={() => onChange(toDay(cal, 0, 0, 1))}>Imposta data</button>
      )}
    </div>
  )
}

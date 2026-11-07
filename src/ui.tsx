import { ReactNode, useEffect, useRef, useState } from 'react'

const PATHS: Record<string, string> = {
  left: 'M3 4h18v16H3zM9 4v16', right: 'M3 4h18v16H3zM15 4v16',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3', help: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01',
  plus: 'M12 5v14M5 12h14',
  folderPlus: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM12 11v6M9 14h6',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  timeline: 'M3 12h18M7 8v8M12 5v14M17 9v6',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  map: 'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
  play: 'M7 4l13 8-13 8z', pause: 'M8 4v16M16 4v16', prev: 'M19 4L9 12l10 8zM5 5v14', next: 'M5 4l10 8-10 8zM19 5v14',
  repeat: 'M17 2l4 4-4 4M3 11v-1a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 01-4 4H3',
  cursor: 'M5 3l14 7-6 2-2 6z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  route: 'M4 19l5-8 5 5 6-10M4 19h.01M20 6h.01', polygon: 'M12 3l8 6-3 11H7L4 9z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  book: 'M5 3h14v18H5zM9 3v18M12 8h4M12 12h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  copy: 'M9 9h11v11H9zM5 15V5h10',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  graph: 'M7 7a2 2 0 11-4 0 2 2 0 014 0zM21 12a2 2 0 11-4 0 2 2 0 014 0zM11 19a2 2 0 11-4 0 2 2 0 014 0zM6.5 8.5l3 7M7 7.5l10.5 3.5', chev: 'M9 6l6 6-6 6', x: 'M6 6l12 12M18 6L6 18', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

export function Icon({ n, size = 18, className = '' }: { n: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[n]} />
    </svg>
  )
}

export function IconBtn({ n, label, active, onClick }: { n: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-md hover:bg-line/60 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>
      <Icon n={n} />
    </button>
  )
}

// Sezione a scomparsa (usata nei menu laterali)
export function Section({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-muted hover:text-ink">
        <Icon n="chev" size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="capitalize">{title}</span>
        {count != null && <span className="ml-auto tabular-nums">{count}</span>}
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

export function Popover({ button, children, align = 'right', width = 'w-72' }: { button: (open: boolean, toggle: () => void) => ReactNode; children: ReactNode; align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {button(open, () => setOpen((o) => !o))}
      {open && <div className={`absolute z-30 mt-2 ${width} ${align === 'right' ? 'right-0' : 'left-0'} max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-panel p-3 shadow-xl`}>{children}</div>}
    </div>
  )
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 grid place-items-start justify-center bg-black/40 px-4 pt-[10vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className={`max-h-[78vh] w-full overflow-auto rounded-xl border border-line bg-panel shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        {children}
      </div>
    </div>
  )
}

export const field = 'w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-accent'

export function ContextMenu({ x, y, onClose, children }: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onClose); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', onClose); document.removeEventListener('keydown', key) }
  }, [onClose])
  return (
    <div style={{ left: Math.min(x, innerWidth - 220), top: Math.min(y, innerHeight - 240) }} onMouseDown={(e) => e.stopPropagation()} onClick={onClose}
      className="fixed z-50 w-52 rounded-lg border border-line bg-panel py-1 shadow-xl">{children}</div>
  )
}
export const MenuItem = ({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) => (
  <button onClick={onClick} className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-line/60 ${danger ? 'text-danger' : ''}`}>{children}</button>
)

// Maniglia per ridimensionare i pannelli laterali trascinandone il bordo
export function Resizer({ onDrag }: { onDrag: (dx: number) => void }) {
  return (
    <div role="separator" aria-orientation="vertical" className="group relative z-20 w-px shrink-0 cursor-col-resize bg-line"
      onPointerDown={(e) => {
        e.preventDefault()
        let last = e.clientX
        const move = (ev: PointerEvent) => { onDrag(ev.clientX - last); last = ev.clientX }
        const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); document.body.style.userSelect = '' }
        document.body.style.userSelect = 'none'
        addEventListener('pointermove', move); addEventListener('pointerup', up)
      }}>
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 transition-colors group-hover:bg-accent/25" />
    </div>
  )
}

// Conferma con finestra propria (al posto di window.confirm). Uso: const { ask, dialog } = useConfirm(); ask({ title, text, label, danger }, () => azione()); poi {dialog} nel JSX.
// `open` serve a chi ha una Modal sotto (es. il Cestino) per non chiuderla con lo stesso Esc.
export type Ask = { title: string; text?: string; label?: string; danger?: boolean }
export function useConfirm() {
  const [req, setReq] = useState<(Ask & { run: () => void }) | null>(null)
  const ask = (o: Ask, run: () => void) => setReq({ ...o, run })
  const dialog = req && (
    <Modal onClose={() => setReq(null)}>
      <div className="grid gap-4 p-5">
        <h2 className="font-display text-xl">{req.title}</h2>
        {req.text && <p className="text-sm text-muted">{req.text}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => setReq(null)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">Annulla</button>
          <button autoFocus onClick={() => { const run = req.run; setReq(null); run() }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90 ${req.danger ? 'bg-danger text-on-accent' : 'bg-accent text-on-accent'}`}>{req.label ?? 'Conferma'}</button>
        </div>
      </div>
    </Modal>
  )
  return { ask, dialog, open: !!req }
}

// Logo dell'app: stessa grafica di public/favicon.svg
export const Logo = ({ size = 56, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Lorekeeper">
    <defs><linearGradient id="lk-logo-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5f53cc" /><stop offset="1" stopColor="#262070" /></linearGradient></defs>
    <rect width="64" height="64" rx="14" fill="url(#lk-logo-bg)" />
    <path d="M8 27c8-3.5 17-3 24 2.5v23c-7-5-16-5.5-24-2z" fill="#f7f2e5" />
    <path d="M56 27c-8-3.5-17-3-24 2.5v23c7-5 16-5.5 24-2z" fill="#e8dfc8" />
    <path d="M32 29.5v23" stroke="#b8ac8a" strokeWidth="1.4" strokeLinecap="round" />
    <g stroke="#b8ac8a" strokeWidth="1.6" strokeLinecap="round" opacity=".9">
      <path d="M13 33c4-1 8-.8 14 1.2M13 38c4-1 8-.8 14 1.2M13 43c4-1 8-.8 14 1.2" />
      <path d="M51 33c-4-1-8-.8-14 1.2M51 38c-4-1-8-.8-14 1.2M51 43c-4-1-8-.8-14 1.2" />
    </g>
    <polygon points="32.00,5.50 34.12,11.09 40.08,11.37 35.42,15.11 37.00,20.88 32.00,17.60 27.00,20.88 28.58,15.11 23.92,11.37 29.88,11.09" fill="#e8b84f" stroke="#fff3c9" strokeWidth=".8" strokeLinejoin="round" />
  </svg>
)


import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Page } from './types'
import { Modal, useConfirm } from './ui'

export default function TrashModal({ onClose }: { onClose: () => void }) {
  const { vault, upsert } = useStore()
  const { ask, dialog, open } = useConfirm()
  const [items, setItems] = useState<Page[] | null>(null)
  const load = () => vault!.listTrash().then((l) => setItems(l.sort((a, b) => a.title.localeCompare(b.title))))
  useEffect(() => { load() }, [])
  return (
    <>
    <Modal onClose={() => { if (!open) onClose() }}>
      <div className="grid gap-3 p-5">
        <h2 className="font-display text-xl">Cestino</h2>
        {items === null ? <p className="text-sm text-muted">Caricamento…</p> : items.length === 0 ? <p className="text-sm text-muted">Il cestino è vuoto.</p> : (
          <div className="grid gap-1.5">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{p.title || 'Senza titolo'}</span>
                <button onClick={async () => { try { await vault!.save(p); upsert(p); await vault!.purge(p.id) } catch {} load() }} className="text-sm text-accent hover:underline">Ripristina</button>
                <button onClick={() => ask({ title: `Eliminare definitivamente «${p.title || 'Senza titolo'}»?`, text: 'Non si può annullare.', label: 'Elimina', danger: true }, async () => { await vault!.purge(p.id); load() })} className="text-sm text-danger hover:underline">Elimina</button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">Le pagine eliminate restano nella cartella .trash del mondo.</p>
      </div>
    </Modal>
    {dialog}
    </>
  )
}

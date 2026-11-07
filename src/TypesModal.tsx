import { useState } from 'react'
import { useStore } from './store'
import { Modal, field } from './ui'
import { Field, FieldKind, PRESETS, PresetName, Schema, schemaFor, typeKey } from './kinds'
import { newId } from './types'

const KINDS: [FieldKind, string][] = [['text', 'Testo'], ['date', 'Data'], ['choice', 'Scelta'], ['page', 'Una pagina'], ['pages', 'Più pagine']]

// Editor della scheda di un tipo: preset, etichette delle date, campi propri
function TypeEditor({ tkey, schema, stored }: { tkey: string; schema: Schema; stored: boolean }) {
  const setSchema = useStore((s) => s.setSchema)
  const save = (next: Schema) => setSchema(tkey, next)
  const upd = (i: number, p: Partial<Field>) => save({ ...schema, fields: schema.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  const dates = (a: string, b: string) => save({ ...schema, dates: a || b ? [a, b] : undefined })
  return (
    <div className="grid gap-3 border-t border-line p-3 text-sm">
      <label className="grid gap-1 text-xs text-muted">Scheda predefinita
        <select className={field} value={schema.preset ?? ''} onChange={(e) => { const v = e.target.value as '' | PresetName; save(v ? PRESETS[v].schema() : { fields: schema.fields }) }}>
          <option value="">Nessuna (solo i campi qui sotto)</option>
          {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
        <span className="text-[11px]">Scegliendo una scheda predefinita i campi vengono sostituiti da quelli suoi; i valori già scritti nelle pagine non si perdono.</span>
      </label>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
        <label className="grid gap-1">Nome della data<input className={field} placeholder="Data" value={schema.dates?.[0] ?? ''} onChange={(e) => dates(e.target.value, schema.dates?.[1] ?? '')} /></label>
        <label className="grid gap-1">Nome della fine<input className={field} placeholder="Fine" value={schema.dates?.[1] ?? ''} onChange={(e) => dates(schema.dates?.[0] ?? '', e.target.value)} /></label>
      </div>
      <div className="grid gap-2">
        <p className="text-xs text-muted">Campi</p>
        {schema.fields.map((f, i) => (
          <div key={f.id} className="grid gap-1.5 rounded-md border border-line p-2">
            <div className="flex gap-2">
              <input className={field} value={f.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <select className={field + ' w-36 shrink-0'} value={f.kind} onChange={(e) => upd(i, { kind: e.target.value as FieldKind })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <button aria-label="Togli il campo" onClick={() => save({ ...schema, fields: schema.fields.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">×</button>
            </div>
            {f.kind === 'choice' && <input key={f.id + 'o'} className={field} placeholder="Scelte separate da virgola" defaultValue={(f.options || []).join(', ')} onBlur={(e) => upd(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />}
            {(f.kind === 'page' || f.kind === 'pages') && <input className={field} placeholder="Relazione inversa sull'altra pagina (es. Figli)" value={f.inverse || ''} onChange={(e) => upd(i, { inverse: e.target.value || undefined })} />}
            {f.role && <p className="text-[11px] text-muted">Ruolo: {f.role === 'parent' ? 'genitore (da qui si ricavano figli, fratelli e albero)' : f.role === 'spouse' ? 'coniuge o partner' : 'casato (i membri si ricavano da qui)'}</p>}
          </div>
        ))}
        <div className="flex items-center gap-4">
          <button onClick={() => save({ ...schema, fields: [...schema.fields, { id: 'c' + newId(), label: 'Nuovo campo', kind: 'text' }] })} className="text-accent hover:underline">+ Aggiungi campo</button>
          {stored && <button onClick={() => setSchema(tkey, null)} className="text-muted hover:text-ink hover:underline">Ripristina</button>}
        </div>
      </div>
    </div>
  )
}

// Tipi di pagina e relative schede (specializzazioni)
export default function TypesModal({ onClose }: { onClose: () => void }) {
  const { pages, schemas, setSchema } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [nt, setNt] = useState('')
  const names = new Map<string, { name: string; n: number }>()
  Object.values(pages).forEach((p) => { const k = typeKey(p.type); if (!k) return; const e = names.get(k); if (e) e.n++; else names.set(k, { name: p.type.trim(), n: 1 }) })
  Object.keys(schemas).forEach((k) => { if (!names.has(k)) names.set(k, { name: k, n: 0 }) })
  const keys = [...names.keys()].sort((a, b) => a.localeCompare(b))
  const addType = () => { const k = typeKey(nt); if (!k) return; if (!schemas[k]) setSchema(k, schemaFor(schemas, k) ?? { fields: [] }); setOpen(k); setNt('') }
  return (
    <Modal onClose={onClose}>
      <div className="grid gap-4 p-5">
        <h2 className="font-display text-xl">Tipi di pagina</h2>
        <p className="text-sm text-muted">Il tipo di una pagina decide la scheda che offre: campi propri, nomi delle date e sezioni (la famiglia per i personaggi, i periodi per le entità politiche). Qui definisci le schede del mondo.</p>
        <div className="scroll-pretty grid max-h-[55vh] gap-2 overflow-auto">
          {keys.map((k) => {
            const info = names.get(k)!, stored = schemas[k], sc = schemaFor(schemas, k)
            const label = sc?.preset ? PRESETS[sc.preset].label : sc ? 'personalizzata' : 'nessuna'
            return (
              <div key={k} className="rounded-lg border border-line">
                <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm">
                  <span className="font-medium">{info.name}</span>
                  <span className="text-xs text-muted">{info.n === 1 ? '1 pagina' : `${info.n} pagine`} · scheda: {label}{!stored && sc ? ' (predefinita)' : ''}</span>
                </button>
                {open === k && <TypeEditor tkey={k} schema={sc ?? { fields: [] }} stored={!!stored} />}
              </div>
            )
          })}
          {!keys.length && <p className="text-sm text-muted">Nessun tipo ancora: assegna un tipo a una pagina dalle sue proprietà, oppure aggiungine uno qui sotto.</p>}
        </div>
        <div className="flex gap-2">
          <input className={field} placeholder="Nuovo tipo (es. Luogo, Oggetto, Personaggio)…" value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addType()} />
          <button onClick={addType} disabled={!nt.trim()} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-40">Aggiungi</button>
        </div>
      </div>
    </Modal>
  )
}

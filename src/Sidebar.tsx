import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { useSettings } from './settings'
import { COLORS, Folder, Page, ancestorsOf, childrenOf, descendantsOf, folderColor, folderPath, folderTree, parentOf, rootOf } from './types'
import { ContextMenu, MenuItem, Icon, IconBtn, Modal, field, useConfirm } from './ui'
import TrashModal from './Trash'
import DictionaryModal from './Dictionary'
import TypesModal from './TypesModal'
import { PagePick } from './Tags'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
const rowCls = (on: boolean) => `block truncate rounded-md py-1.5 pr-2 text-sm ${on ? 'bg-accent text-on-accent' : 'hover:bg-line/60'}`

// Menu contestuale: di una cartella (f) o di una pagina (p)
type Menu = { x: number; y: number; f?: Folder; p?: Page }

export default function Sidebar({ activeId }: { activeId?: string }) {
  const nav = useNavigate()
  const { pages, folders, create, upsert, remove, addFolder, patchFolder, colorFolder, removeFolder, movePage, moveFolder } = useStore()
  const { closed, folderView, counts, hiddenFolders, hideRoot, hiddenPages, starsTop, onlyStars, set } = useSettings()
  const { ask, dialog } = useConfirm()
  const [q, setQ] = useState('')
  const [over, setOver] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [moving, setMoving] = useState<Page | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const cancel = useRef(false)
  const [trash, setTrash] = useState(false)
  const [dict, setDict] = useState(false)
  const [types, setTypes] = useState(false)

  const ids = new Set(folders.map((f) => f.id))
  const fp = (f: Folder) => (ids.has(f.parent) ? f.parent : '')
  const pf = (p: Page) => (ids.has(p.folder || '') ? p.folder! : '')
  const allSubs = (parent: string) => folders.filter((f) => fp(f) === parent).sort(byName)
  // Vista per gruppo: una cartella nascosta nasconde se stessa, le sue sottocartelle e le sue pagine.
  const hidden = new Set(hiddenFolders)
  const subs = (parent: string) => allSubs(parent).filter((f) => !hidden.has(f.id))
  const isHidden = (fid: string) => { let f = folders.find((x) => x.id === fid), n = 0; while (f && n++ < 20) { if (hidden.has(f.id)) return true; const p = f.parent; f = folders.find((x) => x.id === p) } return false }
  // Una pagina con una madre (esistente e senza cicli) si vede sotto la madre, non nella propria cartella.
  const hasParent = (p: Page) => {
    let c = parentOf(pages, p), n = 0
    if (!c) return false
    while (c && n++ < 20) { if (c.id === p.id) return false; c = parentOf(pages, c) }
    return true
  }
  const df = (p: Page) => pf(rootOf(pages, p))
  const place = (f: string) => (f === '' ? !hideRoot : !isHidden(f))
  // Visibile se lo è il posto sotto la madre o la propria cartella
  const shownPage = (p: Page) => !pageHidden(p) && (place(df(p)) || (pf(p) !== '' && place(pf(p))))
  const toggleHidden = (id: string) => set({ hiddenFolders: hidden.has(id) ? hiddenFolders.filter((x) => x !== id) : [...hiddenFolders, id] })
  // Anche le singole pagine si possono nascondere: una pagina nascosta sparisce dall'elenco con le sue sottopagine
  // (nelle cartelle in cui compare per conto suo si vede ancora, a meno che non sia nascosta lei stessa)
  const hiddenP = new Set(hiddenPages)
  const underHidden = (p: Page) => ancestorsOf(pages, p).some((a) => hiddenP.has(a.id))
  const ownPlace = (p: Page) => pf(p) !== '' && pf(p) !== df(p)
  const pageHidden = (p: Page) => hiddenP.has(p.id) || (underHidden(p) && !ownPlace(p))
  const hidePage = (id: string) => { if (!hiddenP.has(id)) set({ hiddenPages: [...hiddenPages, id] }) }
  const showPage = (id: string) => set({ hiddenPages: hiddenPages.filter((x) => x !== id) })
  const hideKids = (p: Page) => set({ hiddenPages: [...new Set([...hiddenPages, ...childrenOf(pages, p.id).map((c) => c.id)])] })
  const showAll = () => set({ hiddenFolders: [], hideRoot: false, hiddenPages: [] })
  const hideAll = () => set({ hiddenFolders: folders.map((f) => f.id), hideRoot: true })
  // Lascia in vista solo questa cartella (con le sue sottocartelle) e le cartelle che la contengono.
  const onlyThis = (id: string) => {
    const keep = new Set(folderTree(folders, id))
    let a: string | undefined = folders.find((x) => x.id === id)?.parent, n = 0
    while (a && n++ < 20) { keep.add(a); const cur: string = a; a = folders.find((x) => x.id === cur)?.parent }
    set({ hiddenFolders: folders.filter((f) => !keep.has(f.id)).map((f) => f.id), hideRoot: true })
  }
  const anyHidden = hiddenFolders.some((id) => ids.has(id)) || hideRoot || hiddenPages.some((id) => pages[id])
  // Elenco di una cartella: le pagine senza madre e, tra quelle con madre, solo chi ha una cartella propria diversa da quella della madre
  // (un sovrano nella cartella Personaggi è anche sottopagina del suo regno: compare in entrambi i posti)
  const pagesIn = (fid: string) => Object.values(pages).filter((p) => !hiddenP.has(p.id) && pf(p) === fid && (!hasParent(p) || (fid !== '' && fid !== df(p)))).sort((a, b) => a.title.localeCompare(b.title))
  const toggle = (id: string) => set({ closed: closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id] })

  // Contatore di una cartella: pagine proprie + quelle di tutte le sottocartelle.
  const direct: Record<string, number> = {}
  Object.values(pages).forEach((p) => { if (pageHidden(p)) return; const k = pf(p) || df(p); direct[k] = (direct[k] || 0) + 1 })
  const countOf = (fid: string) => {
    const out = [fid]
    for (let i = 0; i < out.length && i < 5000; i++) folders.forEach((f) => { if (f.parent === out[i] && !hidden.has(f.id) && !out.includes(f.id)) out.push(f.id) })
    return out.reduce((a, id) => a + (direct[id] || 0), 0)
  }

  const paths = folders.map((f) => ({ id: f.id, label: folderPath(folders, f.id) })).sort((a, b) => a.label.localeCompare(b.label))

  // Nuova cartella: viene creata subito e il nome si scrive direttamente nell'elenco.
  const reveal = (id: string) => { if (closed.includes(id)) set({ closed: closed.filter((x) => x !== id) }) }
  const newFolder = (parent = '') => {
    const f = addFolder('Nuova cartella', parent)
    if (parent) reveal(parent)
    setEditing(f.id)
  }
  // Sposta una pagina in una cartella (se ha una madre resta anche sotto di lei; per staccarla c'è «Rendi indipendente»)
  const moveTo = (id: string, folder: string) => { const p = pages[id]; if (p && (p.folder || '') !== folder) upsert({ ...p, folder }) }
  const newChild = (p: Page) => { reveal(p.id); const c = create('Nuova sottopagina', p.folder || ''); upsert({ ...c, parent: p.id }); nav('/w/' + c.id) }
  // Aprendo una pagina nidificata si aprono le madri chiuse che la contengono
  useEffect(() => {
    const a = activeId ? pages[activeId] : undefined
    if (!a) return
    const shut = ancestorsOf(pages, a).map((x) => x.id).filter((id) => closed.includes(id))
    if (shut.length) set({ closed: closed.filter((id) => !shut.includes(id)) })
  }, [activeId])
  const duplicate = (p: Page) => {
    const c = create(p.title + ' (copia)', p.folder || '')
    upsert({ ...p, id: c.id, title: c.title })
    nav('/w/' + c.id)
  }

  // Drag & drop: pagine e cartelle si trascinano su una cartella (o sullo sfondo = radice)
  const drag = (kind: string, id: string) => (e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', kind + ':' + id) }
  const allow = (target: string) => (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setOver(target) }
  const drop = (target: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setOver(null)
    const [kind, id] = e.dataTransfer.getData('text/plain').split(':')
    if (kind === 'page') moveTo(id, target)
    if (kind === 'folder') moveFolder(id, target)
  }

  // Trascinare una pagina su un'altra la rende sua sottopagina
  const dropOnPage = (t: Page) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setOver(null)
    const [kind, id] = e.dataTransfer.getData('text/plain').split(':')
    const src = pages[id]
    if (kind !== 'page' || !src || src.id === t.id || src.parent === t.id) return
    if (descendantsOf(pages, src.id).some((d) => d.id === t.id)) return // niente cicli
    upsert({ ...src, parent: t.id }); reveal(t.id)
  }

  // Una pagina con sottopagine si comporta come una cartella: freccia per aprirla e chiuderla, sottopagine in ordine di data.
  const pageRow = (p: Page, pad: number, nest = true, path: string[] = []): ReactNode => {
    const kids = nest && !path.includes(p.id) ? childrenOf(pages, p.id).filter((k) => k.id !== p.id && !path.includes(k.id) && !hiddenP.has(k.id)) : []
    const isOpen = !closed.includes(p.id), active = p.id === activeId
    const cls = kids.length ? `flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm ${active ? 'bg-accent text-on-accent' : 'hover:bg-line/60'}` : rowCls(active)
    return (
      <div key={p.id}>
        <Link to={'/w/' + p.id} draggable onDragStart={drag('page', p.id)} onDragOver={allow('page:' + p.id)} onDrop={dropOnPage(p)}
          className={`${cls} ${over === 'page:' + p.id ? 'bg-accent/20 ring-1 ring-accent' : ''}`} style={{ paddingLeft: kids.length ? pad - 20 : pad }}
          onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, p }) }}>
          {kids.length > 0 && (
            <span className="shrink-0 cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.id) }}>
              <Icon n="chev" size={14} className={`transition-transform ${active ? '' : 'text-muted'} ${isOpen ? 'rotate-90' : ''}`} />
            </span>
          )}
          {kids.length > 0 ? <span className="min-w-0 flex-1 truncate">{p.title || 'Senza titolo'}{p.star && <span className={`ml-1.5 ${active ? '' : 'text-gold'}`} title="Pagina principale">★</span>}</span> : <>{p.title || 'Senza titolo'}{p.star && <span className={`ml-1.5 ${active ? '' : 'text-gold'}`} title="Pagina principale">★</span>}</>}
          {counts && kids.length > 0 && <span className={`text-xs ${active ? '' : 'text-muted'}`} title="Sottopagine">{kids.length}</span>}
        </Link>
        {kids.length > 0 && isOpen && kids.map((k) => pageRow(k, pad + 14, true, [...path, p.id]))}
      </div>
    )
  }

  const level = (parent: string, depth: number): ReactNode => (
    <>
      {subs(parent).map((f) => (
        <div key={f.id}>
          <div draggable={editing !== f.id} onDoubleClick={() => setEditing(f.id)} onDragStart={drag('folder', f.id)} onDragOver={allow(f.id)} onDrop={drop(f.id)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, f }) }}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm hover:bg-line/60 ${over === f.id ? 'bg-accent/20 ring-1 ring-accent' : ''}`}
            style={{ paddingLeft: 6 + depth * 14 }} onClick={() => toggle(f.id)}>
            <Icon n="chev" size={14} className={`shrink-0 text-muted transition-transform ${closed.includes(f.id) ? '' : 'rotate-90'}`} />
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: folderColor(folders, f.id) }} />
            {editing === f.id ? (
              <input autoFocus defaultValue={f.name} className="min-w-0 flex-1 rounded border border-accent bg-paper px-1.5 py-0.5 text-sm outline-none"
                onFocus={(e) => e.target.select()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur() } }}
                onBlur={(e) => { const v = e.target.value.trim(); if (!cancel.current && v) patchFolder(f.id, { name: v }); cancel.current = false; setEditing(null) }} />
            ) : (
              <span className="flex-1 truncate">{f.name}</span>
            )}
            {counts && <span className="text-xs text-muted" title="Pagine nella cartella, comprese le sottocartelle">{countOf(f.id)}</span>}
          </div>
          {!closed.includes(f.id) && level(f.id, depth + 1)}
        </div>
      ))}
      {!(parent === '' && hideRoot) && pagesIn(parent).map((p) => pageRow(p, 26 + depth * 14))}
    </>
  )

  const ql = q.toLowerCase()
  const all = Object.values(pages).sort((a, b) => a.title.localeCompare(b.title))
  const starred = all.filter((p) => p.star && !hiddenP.has(p.id))
  const found = !ql ? (onlyStars ? starred : all.filter(shownPage)) : all.filter((p) => p.title.toLowerCase().includes(ql) || p.body.toLowerCase().includes(ql) || p.tags.some((t) => t.toLowerCase().includes(ql)) || (p.type || '').toLowerCase().includes(ql))
  const flat = !!ql || !folderView || onlyStars

  // Elenco completo (anche delle cartelle nascoste) per la finestra «Vista dell'elenco»
  const listed: { f: Folder; d: number }[] = []
  const walk = (parent: string, d: number) => { if (d > 20) return; allSubs(parent).forEach((f) => { listed.push({ f, d }); walk(f.id, d + 1) }) }
  if (viewOpen) walk('', 0)

  return (
    <aside className="flex h-full flex-col gap-2 overflow-hidden p-3">
      <input className={field} placeholder="Filtra pagine…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={() => { if (hideRoot) set({ hideRoot: false }); nav('/w/' + create().id) }} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90">
          <Icon n="plus" size={16} /> Nuova pagina
        </button>
        {folderView && <IconBtn n="folderPlus" label="Nuova cartella" onClick={() => newFolder()} />}
        <IconBtn n="gear" label="Vista dell'elenco" active={viewOpen} onClick={() => setViewOpen(true)} />
      </div>
      <nav className={`scroll-pretty -mx-1 mt-1 min-h-0 flex-1 overflow-auto rounded-md px-1 ${over === '' ? 'ring-1 ring-accent' : ''}`}
        onDragOver={allow('')} onDrop={drop('')} onDragLeave={() => setOver(null)}>
        {!ql && starsTop && !onlyStars && starred.length > 0 && (
          <div className="mb-1 border-b border-line pb-1">
            <button onClick={() => toggle('__stars')} className="flex w-full items-center gap-1.5 px-1.5 py-1 text-xs font-medium text-muted hover:text-ink">
              <Icon n="chev" size={12} className={`transition-transform ${closed.includes('__stars') ? '' : 'rotate-90'}`} /><span className="text-gold">★</span> Principali <span className="font-normal">{starred.length}</span>
            </button>
            {!closed.includes('__stars') && starred.map((p) => pageRow(p, 22, false))}
          </div>
        )}
        {flat ? found.map((p) => pageRow(p, 10, false)) : level('', 0)}
        {flat && !found.length && <p className="px-2 text-sm text-muted">{ql ? 'Nessun risultato.' : onlyStars ? 'Nessuna pagina con la stella.' : anyHidden ? 'Nessuna pagina in vista.' : 'Ancora nessuna pagina.'}</p>}
        {!flat && !folders.length && !Object.keys(pages).length && <p className="px-2 text-sm text-muted">Ancora nessuna pagina.</p>}
      </nav>
      {anyHidden && (
        <p className="px-1 text-xs text-muted">Alcune cartelle o pagine sono nascoste. <button onClick={showAll} className="text-accent hover:underline">Mostra tutte</button></p>
      )}
      <div className="flex items-center gap-4 self-start px-1 text-xs text-muted">
        <button onClick={() => setTrash(true)} className="flex items-center gap-1.5 hover:text-ink"><Icon n="trash" size={14} /> Cestino</button>
        <button onClick={() => setDict(true)} className="flex items-center gap-1.5 hover:text-ink"><Icon n="book" size={14} /> Dizionario</button>
        <button onClick={() => setTypes(true)} className="flex items-center gap-1.5 hover:text-ink" title="Tipi di pagina e relative schede"><Icon n="gear" size={14} /> Tipi</button>
      </div>
      {trash && <TrashModal onClose={() => setTrash(false)} />}
      {dict && <DictionaryModal onClose={() => setDict(false)} />}
      {types && <TypesModal onClose={() => setTypes(false)} />}

      {menu?.f && (() => {
        const f = menu.f
        return (
          <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
            <MenuItem onClick={() => { reveal(f.id); nav('/w/' + create('Nuova pagina', f.id).id) }}>Nuova pagina qui</MenuItem>
            <MenuItem onClick={() => newFolder(f.id)}>Nuova sottocartella</MenuItem>
            <MenuItem onClick={() => setEditing(f.id)}>Rinomina</MenuItem>
            <MenuItem onClick={() => toggleHidden(f.id)}>Nascondi dalla vista</MenuItem>
            <MenuItem onClick={() => onlyThis(f.id)}>Mostra solo questa cartella</MenuItem>
            <div className="mt-1 border-t border-line px-3 pb-1 pt-2 text-xs text-muted">Colore</div>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {COLORS.map((c) => (
                <button key={c} title="Colore della cartella" onClick={() => colorFolder(f.id, c)}
                  className={`h-5 w-5 rounded-full border ${f.color === c ? 'border-ink' : 'border-line'}`} style={{ background: c }} />
              ))}
            </div>
            <MenuItem onClick={() => colorFolder(f.id, '')}>{f.color === '' ? '✓ ' : ''}Eredita dalla cartella madre</MenuItem>
            <MenuItem onClick={() => colorFolder(f.id, 'none')}>{f.color === 'none' ? '✓ ' : ''}Nessun colore</MenuItem>
            <MenuItem onClick={() => colorFolder(f.id, f.color, true)}>Applica alle sottocartelle</MenuItem>
            <div className="mt-1 border-t border-line" />
            <MenuItem danger onClick={() => ask({ title: `Eliminare la cartella «${f.name}»?`, text: 'Il contenuto non viene eliminato: pagine e sottocartelle salgono di un livello.', label: 'Elimina cartella', danger: true }, () => removeFolder(f.id))}>Elimina cartella</MenuItem>
          </ContextMenu>
        )
      })()}

      {menu?.p && (() => {
        const p = menu.p
        return (
          <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
            <MenuItem onClick={() => nav('/w/' + p.id)}>Apri</MenuItem>
            <MenuItem onClick={() => upsert({ ...p, star: !p.star })}>{p.star ? 'Togli la stella' : 'Segna come principale ★'}</MenuItem>
            <MenuItem onClick={() => hidePage(p.id)}>Nascondi dalla vista</MenuItem>
            {childrenOf(pages, p.id).length > 0 && <MenuItem onClick={() => hideKids(p)}>Nascondi le sottopagine</MenuItem>}
            <MenuItem onClick={() => duplicate(p)}>Duplica</MenuItem>
            <MenuItem onClick={() => newChild(p)}>Nuova sottopagina</MenuItem>
            {hasParent(p) && <MenuItem onClick={() => upsert({ ...p, parent: '' })}>Rendi indipendente</MenuItem>}
            <MenuItem onClick={() => setMoving(p)}>Sposta in…</MenuItem>
            <div className="mt-1 border-t border-line" />
            <MenuItem danger onClick={() => ask({ title: `Spostare «${p.title || 'Senza titolo'}» nel cestino?`, text: 'Si può ripristinare dal Cestino.', label: 'Sposta nel cestino', danger: true }, async () => { await remove(p.id); if (p.id === activeId) nav('/w') })}>Sposta nel cestino</MenuItem>
          </ContextMenu>
        )
      })()}

      {moving && (
        <Modal onClose={() => setMoving(null)}>
          <div className="grid gap-3 p-5">
            <h2 className="font-display text-xl">Sposta «{moving.title || 'Senza titolo'}»</h2>
            <div className="scroll-pretty grid max-h-72 gap-1 overflow-auto">
              {[{ id: '', label: 'Nessuna cartella (radice)' }, ...paths].map((o) => (
                <button key={o.id || 'root'} onClick={() => { moveTo(moving.id, o.id); setMoving(null) }}
                  className={`rounded-md px-3 py-1.5 text-left text-sm ${(moving.folder || '') === o.id ? 'bg-accent/15' : 'hover:bg-line/60'}`}>{o.label}</button>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {viewOpen && (
        <Modal onClose={() => setViewOpen(false)}>
          <div className="grid gap-4 p-5">
            <h2 className="font-display text-xl">Vista dell'elenco</h2>
            <div className="grid gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-accent" checked={folderView} onChange={() => set({ folderView: !folderView })} />Mostra le cartelle (spento: un unico elenco alfabetico)
              </label>
              <label className={`flex items-center gap-2 ${folderView ? 'cursor-pointer' : 'opacity-50'}`}>
                <input type="checkbox" className="accent-accent" checked={counts} disabled={!folderView} onChange={() => set({ counts: !counts })} />Mostra i contatori
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-accent" checked={starsTop} onChange={() => set({ starsTop: !starsTop })} />Elenco «★ Principali» in cima
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-accent" checked={onlyStars} onChange={() => set({ onlyStars: !onlyStars })} />Solo le pagine con la stella
              </label>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Cartelle in vista</span>
                <span className="flex gap-3 text-xs">
                  <button onClick={showAll} className="text-accent hover:underline">Tutte</button>
                  <button onClick={hideAll} className="text-accent hover:underline">Nessuna</button>
                </span>
              </div>
              <div className="scroll-pretty grid max-h-72 gap-0.5 overflow-auto rounded-lg border border-line p-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted hover:bg-line/60">
                  <input type="checkbox" className="accent-accent" checked={!hideRoot} onChange={() => set({ hideRoot: !hideRoot })} />Pagine senza cartella
                </label>
                {listed.map(({ f, d }) => (
                  <label key={f.id} title={fp(f) && isHidden(fp(f)) ? 'Nascosta insieme a una cartella che la contiene' : undefined}
                    className={`flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-sm hover:bg-line/60 ${fp(f) && isHidden(fp(f)) ? 'opacity-50' : ''}`} style={{ paddingLeft: 6 + d * 14 }}>
                    <input type="checkbox" className="accent-accent" checked={!hidden.has(f.id)} onChange={() => toggleHidden(f.id)} />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: folderColor(folders, f.id) }} />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </label>
                ))}
                {!folders.length && <p className="px-2 py-1 text-sm text-muted">Nessuna cartella.</p>}
              </div>
              <div className="grid gap-1.5 border-t border-line pt-3">
                <span className="text-sm font-medium">Pagine nascoste</span>
                <PagePick className={field} value="" placeholder="Nascondi una pagina…" options={all.filter((p) => !hiddenP.has(p.id)).map((p) => ({ id: p.id, title: p.title, hint: p.type }))} onChange={(id) => id && hidePage(id)} />
                <div className="flex flex-wrap gap-1.5">
                  {hiddenPages.map((id) => pages[id] && (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs">
                      {pages[id].title || 'Senza titolo'}<button aria-label={`Mostra ${pages[id].title}`} title="Mostra di nuovo" onClick={() => showPage(id)} className="text-muted hover:text-ink">×</button>
                    </span>
                  ))}
                  {!hiddenPages.some((id) => pages[id]) && <p className="text-xs text-muted">Nessuna pagina nascosta. Anche dal tasto destro su una pagina: «Nascondi dalla vista» (nasconde con lei le sue sottopagine).</p>}
                </div>
              </div>
              <p className="text-xs text-muted">Una cartella nascosta nasconde anche le sue sottocartelle e le sue pagine; una pagina nascosta, le sue sottopagine. La ricerca cerca sempre in tutte le pagine. Le pagine non vengono toccate: cambia solo cosa vedi in questo elenco.</p>
            </div>
          </div>
        </Modal>
      )}
      {dialog}
    </aside>
  )
}

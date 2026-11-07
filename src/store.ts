import { create } from 'zustand'
import { Vault } from './storage'
import { Folder, MapDoc, Page, Track, folderTree, newId } from './types'
import type { Schema, Schemas } from './kinds'
import { Calendar, DEFAULT_CAL } from './calendar'

type S = {
  vault: Vault | null
  name: string
  pages: Record<string, Page>
  folders: Folder[]
  calendar: Calendar
  maps: Record<string, MapDoc>
  music: Track[]
  dictionary: string[]
  schemas: Schemas
  setSchema: (key: string, schema: Schema | null) => void
  duplicateMap: (id: string) => string
  addWords: (ws: string[]) => void
  removeWord: (w: string) => void
  addTrack: (t: Track) => void
  removeTrack: (id: string) => void
  open: (handle: any) => Promise<void>
  upsert: (p: Page) => void
  create: (title?: string, folder?: string) => Page
  remove: (id: string) => Promise<void>
  addFolder: (name: string, parent?: string) => Folder
  patchFolder: (id: string, p: Partial<Folder>) => void
  colorFolder: (id: string, color: string, cascade?: boolean) => void
  removeFolder: (id: string) => void
  movePage: (id: string, folder: string) => void
  moveFolder: (id: string, parent: string) => void
  setCalendar: (c: Calendar) => void
  createMap: (file: File) => Promise<MapDoc>
  patchMap: (m: MapDoc) => void
  removeMap: (id: string) => Promise<void>
}

const timers: Record<string, number> = {}
const mapTimers: Record<string, number> = {}
const renameTimers: Record<string, number> = {}
const baseTitle: Record<string, string> = {}
let metaTimer = 0
// Scritture ancora in attesa del ritardo: servono a salvarle subito se la scheda viene chiusa o nascosta.
const dirtyPages = new Set<string>(), dirtyMaps = new Set<string>()
let metaDirty = false

export const useStore = create<S>((set, get) => {
  // world.json (cartelle + calendario), scrittura con debounce.
  const saveMeta = () => {
    clearTimeout(metaTimer); metaDirty = true
    metaTimer = window.setTimeout(() => { metaDirty = false; get().vault?.saveMeta({ folders: get().folders, calendar: get().calendar, music: get().music, dictionary: get().dictionary, schemas: get().schemas }) }, 400)
  }
  const setFolders = (fn: (f: Folder[]) => Folder[]) => { set((s) => ({ folders: fn(s.folders) })); saveMeta() }

  return {
    vault: null, name: '', pages: {}, folders: [], calendar: DEFAULT_CAL, maps: {}, music: [], dictionary: [], schemas: {},
    async open(handle) {
      flushSaves() // eventuali modifiche in attesa vanno nel mondo che si sta lasciando
      const vault = await Vault.open(handle)
      const [list, meta, maps] = await Promise.all([vault.list(), vault.readMeta(), vault.listMaps()])
      set({
        vault, name: handle.name, folders: meta.folders ?? [], calendar: meta.calendar ?? DEFAULT_CAL, music: meta.music ?? [], dictionary: Array.isArray(meta.dictionary) ? meta.dictionary : [],
        schemas: meta.schemas && typeof meta.schemas === 'object' && !Array.isArray(meta.schemas) ? meta.schemas : {},
        pages: Object.fromEntries(list.map((p) => [p.id, p])), maps: Object.fromEntries(maps.map((m) => [m.id, m])),
      })
    },
    upsert(p) {
      const prev = get().pages[p.id]
      // Rinomina: dopo una pausa nella digitazione, il testo dei link che puntano alla pagina segue il nuovo titolo.
      if (prev && prev.title !== p.title) {
        baseTitle[p.id] ??= prev.title
        clearTimeout(renameTimers[p.id])
        renameTimers[p.id] = window.setTimeout(() => {
          const old = baseTitle[p.id]; delete baseTitle[p.id]
          const cur = get().pages[p.id]
          if (!cur || !old || !cur.title.trim() || old === cur.title) return
          const a = `[${old}](wiki:${p.id})`, b = `[${cur.title}](wiki:${p.id})`
          Object.values(get().pages).forEach((q) => { if (q.id !== p.id && q.body.includes(a)) get().upsert({ ...q, body: q.body.split(a).join(b) }) })
        }, 900)
      }
      set((s) => ({ pages: { ...s.pages, [p.id]: p } }))
      clearTimeout(timers[p.id]); dirtyPages.add(p.id)
      timers[p.id] = window.setTimeout(() => {
        dirtyPages.delete(p.id)
        const cur = get().pages[p.id]
        if (cur) get().vault?.save(cur)
      }, 500)
    },
    create(title = 'Nuova pagina', folder = '') {
      const p: Page = { id: newId(), title, type: '', tags: [], body: '', folder }
      get().upsert(p)
      return p
    },
    async remove(id) {
      clearTimeout(timers[id]); dirtyPages.delete(id)
      const pg = get().pages[id]
      if (pg) await get().vault?.trash(pg).catch(() => {})
      set((s) => { const { [id]: _, ...pages } = s.pages; return { pages } })
    },
    addFolder(name, parent = '') {
      const f: Folder = { id: newId(), name, parent, color: '' }
      setFolders((fs) => [...fs, f])
      return f
    },
    patchFolder: (id, p) => setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f))),
    // cascade: le sottocartelle perdono il colore proprio ('') e seguono quello della cartella.
    colorFolder(id, color, cascade = false) {
      const ids = new Set(cascade ? folderTree(get().folders, id) : [id])
      setFolders((fs) => fs.map((f) => (ids.has(f.id) ? { ...f, color: f.id === id ? color : '' } : f)))
    },
    removeFolder(id) {
      const f = get().folders.find((x) => x.id === id)
      if (!f) return
      Object.values(get().pages).filter((p) => p.folder === id).forEach((p) => get().upsert({ ...p, folder: f.parent }))
      setFolders((fs) => fs.filter((x) => x.id !== id).map((x) => (x.parent === id ? { ...x, parent: f.parent } : x)))
    },
    movePage(id, folder) {
      const p = get().pages[id]
      if (p && (p.folder || '') !== folder) get().upsert({ ...p, folder })
    },
    moveFolder(id, parent) {
      let cur: string | undefined = parent, n = 0
      while (cur && n++ < 50) { if (cur === id) return; cur = get().folders.find((f) => f.id === cur)?.parent }
      setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, parent } : f)))
    },
    setCalendar(c) { set({ calendar: c }); saveMeta() },
    addWords(ws) {
      const have = new Set(get().dictionary.map((w) => w.toLowerCase())), add: string[] = []
      ws.map((w) => w.trim()).forEach((w) => { if (w && !have.has(w.toLowerCase())) { have.add(w.toLowerCase()); add.push(w) } })
      if (!add.length) return
      set((s) => ({ dictionary: [...s.dictionary, ...add].sort((a, b) => a.localeCompare(b)) })); saveMeta()
    },
    removeWord(w) { set((s) => ({ dictionary: s.dictionary.filter((x) => x !== w) })); saveMeta() },
    // Scheda di un tipo di pagina (chiave = tipo in minuscolo); null = torna alla predefinita
    setSchema(key, sc) { set((s) => { const next = { ...s.schemas }; if (sc) next[key] = sc; else delete next[key]; return { schemas: next } }); saveMeta() },
    // Copia di una mappa con livelli, elementi (anche le aree con più parti), sfondi e impostazioni; gli sfondi condividono i file
    duplicateMap(id) {
      const m = get().maps[id], nid = newId()
      if (m) get().patchMap({ ...JSON.parse(JSON.stringify(m)), id: nid, title: m.title + ' (copia)' })
      return nid
    },
    addTrack(t) { set((s) => ({ music: [...s.music, t] })); saveMeta() },
    removeTrack(id) {
      const t = get().music.find((x) => x.id === id)
      if (t?.kind === 'file') get().vault?.removeMusic(t.src)
      set((s) => ({ music: s.music.filter((x) => x.id !== id) })); saveMeta()
    },
    async createMap(file) {
      const image = 'asset:' + (await get().vault!.addAsset(file))
      const bmp = await createImageBitmap(file)
      const m: MapDoc = {
        id: newId(), title: file.name.replace(/\.[^.]+$/, ''), image, w: bmp.width, h: bmp.height, features: [],
        backgrounds: [{ id: newId(), name: 'Base', image, visible: true, opacity: 1 }],
        layers: [
          { id: newId(), name: 'Luoghi', color: '#d08a3c', visible: true },
          { id: newId(), name: 'Confini', color: '#c2574b', visible: true },
          { id: newId(), name: 'Rotte', color: '#4a7bc2', visible: true },
        ],
      }
      get().patchMap(m)
      return m
    },
    patchMap(m) {
      set((s) => ({ maps: { ...s.maps, [m.id]: m } }))
      clearTimeout(mapTimers[m.id]); dirtyMaps.add(m.id)
      mapTimers[m.id] = window.setTimeout(() => { dirtyMaps.delete(m.id); const cur = get().maps[m.id]; if (cur) get().vault?.saveMap(cur) }, 600)
    },
    async removeMap(id) {
      clearTimeout(mapTimers[id]); dirtyMaps.delete(id)
      await get().vault?.removeMap(id).catch(() => {})
      set((s) => { const { [id]: _, ...maps } = s.maps; return { maps } })
    },
  }
})

// Salva subito ciò che è ancora in attesa. Best effort: la scrittura è asincrona e il browser può interromperla,
// ma la finestra di perdita scende da ~0,5 secondi a quasi niente.
export function flushSaves() {
  const s = useStore.getState(), v = s.vault
  if (!v) return
  dirtyPages.forEach((id) => { clearTimeout(timers[id]); const p = s.pages[id]; if (p) v.save(p).catch(() => {}) })
  dirtyMaps.forEach((id) => { clearTimeout(mapTimers[id]); const m = s.maps[id]; if (m) v.saveMap(m).catch(() => {}) })
  if (metaDirty) { clearTimeout(metaTimer); v.saveMeta({ folders: s.folders, calendar: s.calendar, music: s.music, dictionary: s.dictionary, schemas: s.schemas }).catch(() => {}) }
  dirtyPages.clear(); dirtyMaps.clear(); metaDirty = false
}
addEventListener('pagehide', flushSaves)
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves() })

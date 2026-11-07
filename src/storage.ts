import { get, set } from 'idb-keyval'
import type { Page } from './types'

// Un mondo = una cartella: pages/<id>.md (frontmatter + markdown), assets/<hash>.<ext>
const toMd = (p: Page) =>
  `---\nid: ${p.id}\ntitle: ${JSON.stringify(p.title)}\ntype: ${p.type}\ntags: ${JSON.stringify(p.tags)}${p.folder ? `\nfolder: ${p.folder}` : ''}${p.parent ? `\nparent: ${p.parent}` : ''}${p.star ? '\nstar: true' : ''}${p.links?.length ? `\nlinks: ${JSON.stringify(p.links)}` : ''}${p.fields && Object.keys(p.fields).length ? `\nfields: ${JSON.stringify(p.fields)}` : ''}${p.date != null ? `\ndate: ${p.date}` : ''}${p.dateEnd != null ? `\ndateEnd: ${p.dateEnd}` : ''}${p.notes ? `\nnotes: ${JSON.stringify(p.notes)}` : ''}\n---\n\n${p.body}`

const json = (s: string | undefined, d: any) => { try { return s ? JSON.parse(s) : d } catch { return s ?? d } }

// Tag: JSON ("[\"a\", \"b\"]") oppure scritti a mano ("[a, b]" o "a, b"); non deve mai restituire altro che un array.
const tagsOf = (s?: string): string[] => {
  if (!s) return []
  let v: any = s
  try { v = JSON.parse(s) } catch {}
  const list: any[] = Array.isArray(v) ? v : String(v).replace(/^\[|\]$/g, '').split(',')
  return list.map((t) => String(t).trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

// Valori dei campi della scheda: oggetto JSON su una riga; qualunque altra cosa vale «nessun valore»
const fieldsOf = (s?: string): Record<string, any> => {
  if (!s) return {}
  try { const v = JSON.parse(s); return v && typeof v === 'object' && !Array.isArray(v) ? v : {} } catch { return {} }
}

const num = (s?: string) => (s && !isNaN(+s) ? +s : null)

export function parsePage(txt: string, fallbackId: string): Page {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?\r?\n?([\s\S]*)$/)
  const meta: Record<string, string> = {}
  m?.[1].split(/\r?\n/).forEach((l) => {
    const i = l.indexOf(':')
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  })
  return {
    id: meta.id || fallbackId,
    title: json(meta.title, 'Senza titolo'),
    type: meta.type && meta.type !== 'generico' ? meta.type : '',
    folder: meta.folder || '',
    parent: meta.parent || '',
    links: tagsOf(meta.links),
    star: meta.star === 'true' || meta.star === '1',
    fields: fieldsOf(meta.fields),
    date: num(meta.date),
    dateEnd: num(meta.dateEnd),
    notes: json(meta.notes, ''),
    tags: tagsOf(meta.tags),
    body: m ? m[2] : txt,
  }
}

async function writeFile(dir: any, name: string, data: string | ArrayBuffer) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

export class Vault {
  constructor(public root: any, public pages: any, public assets: any, public maps: any, public music: any) {}

  static async open(root: any) {
    const pages = await root.getDirectoryHandle('pages', { create: true })
    const assets = await root.getDirectoryHandle('assets', { create: true })
    const maps = await root.getDirectoryHandle('maps', { create: true })
    const music = await root.getDirectoryHandle('music', { create: true })
    return new Vault(root, pages, assets, maps, music)
  }
  async listMaps(): Promise<any[]> {
    const out: any[] = []
    for await (const [n, h] of this.maps.entries()) {
      if (n.endsWith('.json')) { try { out.push(JSON.parse(await (await h.getFile()).text())) } catch {} }
    }
    return out
  }
  saveMap(m: any) { return writeFile(this.maps, m.id + '.json', JSON.stringify(m)) }
  removeMap(id: string) { return this.maps.removeEntry(id + '.json') }
  async addMusic(file: File) {
    const name = Date.now().toString(36) + '-' + file.name.replace(/[^\w.\-]+/g, '_')
    await writeFile(this.music, name, await file.arrayBuffer())
    return name
  }
  async musicUrl(name: string) { return URL.createObjectURL(await (await this.music.getFileHandle(name)).getFile()) }
  removeMusic(name: string) { return this.music.removeEntry(name).catch(() => {}) }
  // world.json assente = mondo nuovo. Se esiste ma non si legge, l'apertura fallisce con un messaggio:
  // altrimenti il primo salvataggio lo sovrascriverebbe con valori vuoti (cartelle, calendario e musica persi).
  async readMeta(): Promise<any> {
    let fh: any
    try { fh = await this.root.getFileHandle('world.json') } catch (e: any) {
      if (e?.name === 'NotFoundError') return { folders: [] }
      throw e
    }
    const txt = await (await fh.getFile()).text()
    if (!txt.trim()) return { folders: [] }
    try { return JSON.parse(txt) } catch { throw new Error('world.json non è un JSON valido. Correggilo (o rinominalo per ricominciare) e riapri il mondo: non è stato modificato nulla.') }
  }
  saveMeta(m: any) { return writeFile(this.root, 'world.json', JSON.stringify(m, null, 2)) }
  async list(): Promise<Page[]> {
    const out: Page[] = []
    for await (const [name, h] of this.pages.entries()) {
      if (name.endsWith('.md')) out.push(parsePage(await (await h.getFile()).text(), name.slice(0, -3)))
    }
    return out
  }
  save(p: Page) { return writeFile(this.pages, p.id + '.md', toMd(p)) }
  remove(id: string) { return this.pages.removeEntry(id + '.md') }
  // Cestino: le pagine eliminate vanno in .trash/ e si possono ripristinare.
  async trashDir() { return this.root.getDirectoryHandle('.trash', { create: true }) }
  async trash(p: Page) { await writeFile(await this.trashDir(), p.id + '.md', toMd(p)); await this.pages.removeEntry(p.id + '.md').catch(() => {}) }
  async listTrash(): Promise<Page[]> {
    const out: Page[] = []
    for await (const [n, h] of (await this.trashDir()).entries()) if (n.endsWith('.md')) out.push(parsePage(await (await h.getFile()).text(), n.slice(0, -3)))
    return out
  }
  async purge(id: string) { await (await this.trashDir()).removeEntry(id + '.md').catch(() => {}) }

  async addAsset(file: File) {
    const buf = await file.arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))]
      .slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
    const name = `${hash}.${file.name.split('.').pop() || 'png'}`
    await writeFile(this.assets, name, buf)
    return name
  }
  async assetUrl(name: string) {
    const fh = await this.assets.getFileHandle(name)
    return URL.createObjectURL(await fh.getFile())
  }
}

// Mondi recenti: gli handle sono salvabili in IndexedDB, il permesso va però richiesto a ogni sessione.
export type Recent = { name: string; handle: any }
export const getRecents = async (): Promise<Recent[]> => (await get('recents')) ?? []

export async function pickWorld() {
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  const rest = (await getRecents()).filter((r) => r.name !== handle.name)
  await set('recents', [{ name: handle.name, handle }, ...rest].slice(0, 10))
  return handle
}

export async function reopen(r: Recent) {
  if ((await r.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Permesso negato')
  return r.handle
}

export async function removeRecent(name: string) { await set('recents', (await getRecents()).filter((r) => r.name !== name)) }

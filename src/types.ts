export type Page = { id: string; title: string; type: string; tags: string[]; body: string; folder?: string; date?: number | null; dateEnd?: number | null; notes?: string; parent?: string; links?: string[]; fields?: Record<string, any>; star?: boolean }
export type MapLayer = { id: string; name: string; color: string; visible: boolean }
export type MapBg = { id: string; name: string; image: string; visible: boolean; opacity: number }
export type MapDoc = { id: string; title: string; image: string; w: number; h: number; layers: MapLayer[]; features: any[]; backgrounds?: MapBg[]; loop?: boolean }
export const folderColor = (fs: Folder[], fid: string) => {
  let f = fs.find((x) => x.id === fid), n = 0
  // '' = eredita dalla cartella madre · 'none' = nessun colore (interrompe l'ereditarietà) · altro = colore proprio
  while (f && n++ < 20) { if (f.color === 'none') return 'var(--muted)'; if (f.color) return f.color; const p = f.parent; f = fs.find((x) => x.id === p) }
  return 'var(--muted)'
}
// Id della cartella e di tutte le sue sottocartelle (a qualsiasi profondità).
export const folderTree = (fs: Folder[], id: string) => {
  const out = [id]
  for (let i = 0; i < out.length && i < 5000; i++) fs.forEach((f) => { if (f.parent === out[i] && !out.includes(f.id)) out.push(f.id) })
  return out
}
export type Folder = { id: string; name: string; parent: string; color: string }
export const COLORS = ['#c2574b', '#d08a3c', '#b8a52f', '#5c9a58', '#3f9a9a', '#4a7bc2', '#8a62c2', '#c25a98']
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const folderPath = (fs: Folder[], id: string) => {
  const out: string[] = []
  let f = fs.find((x) => x.id === id), n = 0
  while (f && n++ < 20) { out.unshift(f.name); const p = f.parent; f = fs.find((x) => x.id === p) }
  return out.join(' / ')
}
export type Track = { id: string; name: string; kind: 'file' | 'url'; src: string }

// Tag a dizionario: «Categoria:valore» (Cultura:Europea, Moneta:fiorino). Un tag semplice («Animale», «:Animale») non ha categoria.
export const tagKey = (t: string) => { const i = t.indexOf(':'); return i > 0 ? t.slice(0, i).trim() : '' }
export const tagVal = (t: string) => { const i = t.indexOf(':'); return (i >= 0 ? t.slice(i + 1) : t).trim() }
export const normTag = (t: string) => { const k = tagKey(t), v = tagVal(t); return k && v ? `${k}:${v}` : k || v }

// Pagina madre / figlie: la stessa entità in momenti diversi («Polonia» → «Seconda Repubblica» → «Presidente X»).
// Una madre che non esiste più (pagina nel cestino) equivale a nessuna madre: ripristinandola il legame torna da solo.
export const byDate = (a: Page, b: Page) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.title.localeCompare(b.title)
export const parentOf = (pages: Record<string, Page>, p: Page): Page | undefined => (p.parent && p.parent !== p.id ? pages[p.parent] : undefined)
export const childrenOf = (pages: Record<string, Page>, id: string) => Object.values(pages).filter((p) => p.parent === id && p.id !== id).sort(byDate)
export const descendantsOf = (pages: Record<string, Page>, id: string) => {
  const out: Page[] = [], seen = new Set([id]), queue = [id]
  for (let i = 0; i < queue.length && i < 5000; i++) childrenOf(pages, queue[i]).forEach((c) => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); queue.push(c.id) } })
  return out
}
// Dal più alto al più vicino (a prova di cicli scritti a mano nei file)
export const ancestorsOf = (pages: Record<string, Page>, p: Page) => {
  const out: Page[] = []
  let c = parentOf(pages, p), n = 0
  while (c && n++ < 20 && c.id !== p.id && !out.includes(c)) { out.push(c); c = parentOf(pages, c) }
  return out.reverse()
}
export const rootOf = (pages: Record<string, Page>, p: Page) => ancestorsOf(pages, p)[0] ?? p
// Una pagina è un sovrano se il tipo (o il tag «Ruolo:…») è uno di questi
const RULERS = ['sovrano', 'sovrana', 'monarca', 're', 'regina', 'imperatore', 'imperatrice', 'reggente']
export const isRuler = (p: Page) => RULERS.includes(p.type.trim().toLowerCase()) || p.tags.some((t) => tagKey(t).toLowerCase() === 'ruolo' && RULERS.includes(tagVal(t).toLowerCase()))


import { Page, byDate } from './types'

/*
  Specializzazione delle pagine per tipo. Il campo «Tipo» di una pagina decide quale SCHEDA offre:
  campi propri (testo, data, scelta, collegamento a una pagina o a più pagine), etichette delle date e sezioni.
  Le schede si definiscono per ogni mondo (world.json → schemas, chiave = tipo in minuscolo) dalla finestra «Tipi».
  Alcune schede predefinite (preset) valgono per i tipi più comuni (Personaggio, Re, Regno…) finché non le si modifica.
  Le relazioni (campi di tipo pagina) sono collegamenti nei metadati: contano per «Collegata da» e per il grafo.
  Quelle con un «ruolo» (genitore, coniuge) alimentano la famiglia: figli e fratelli si ricavano da soli, senza scriverli.
*/
export type FieldKind = 'text' | 'date' | 'page' | 'pages' | 'choice'
export type Field = { id: string; label: string; kind: FieldKind; options?: string[]; inverse?: string; role?: 'parent' | 'spouse' | 'house' }
export type PresetName = 'personaggio' | 'entita' | 'casato'
export type Schema = { preset?: PresetName; fields: Field[]; dates?: [string, string] }
export type Schemas = Record<string, Schema>

export const PRESETS: Record<PresetName, { label: string; schema: () => Schema }> = {
  personaggio: {
    label: 'Personaggio',
    schema: () => ({
      preset: 'personaggio', dates: ['Nascita', 'Morte'],
      fields: [
        { id: 'padre', label: 'Padre', kind: 'page', inverse: 'Figli', role: 'parent' },
        { id: 'madre', label: 'Madre', kind: 'page', inverse: 'Figli', role: 'parent' },
        { id: 'coniugi', label: 'Coniugi o partner', kind: 'pages', inverse: 'Coniugi o partner', role: 'spouse' },
        { id: 'casato', label: 'Casato', kind: 'page', role: 'house' },
        { id: 'titolo', label: 'Titolo o ruolo', kind: 'text' },
      ],
    }),
  },
  // Entità politica: offre i periodi (rifondazioni, governi) e la cronologia dei sovrani
  entita: { label: 'Entità politica (regno, stato…)', schema: () => ({ preset: 'entita', dates: ['Fondazione', 'Fine'], fields: [] }) },
  // Casato: dà un nome e una storia a un gruppo di personaggi; i membri sono quelli che lo indicano nel campo «Casato» della loro scheda
  casato: {
    label: 'Casato (famiglia, dinastia, clan)',
    schema: () => ({
      preset: 'casato', dates: ['Fondazione', 'Estinzione'],
      fields: [
        { id: 'motto', label: 'Motto', kind: 'text' },
        { id: 'sede', label: 'Sede', kind: 'page', inverse: 'Sede del casato' },
      ],
    }),
  },
}

const BY_TYPE: Record<string, PresetName> = Object.fromEntries([
  ...['personaggio', 'personaggi', 'persona', 'sovrano', 'sovrana', 'monarca', 're', 'regina', 'imperatore', 'imperatrice', 'reggente'].map((t) => [t, 'personaggio']),
  ...['regno', 'regni', 'stato', 'impero', 'repubblica', 'nazione', 'ducato', 'principato'].map((t) => [t, 'entita']),
  ...['casato', 'casati', 'casata', 'casate', 'dinastia', 'dinastie', 'famiglia', 'clan', 'stirpe'].map((t) => [t, 'casato']),
])

export const typeKey = (t: string) => t.trim().toLowerCase()
export const schemaFor = (schemas: Schemas, type: string): Schema | null => {
  const k = typeKey(type)
  if (!k) return null
  return schemas[k] ?? (BY_TYPE[k] ? PRESETS[BY_TYPE[k]].schema() : null)
}

export const isRel = (f: Field) => f.kind === 'page' || f.kind === 'pages'
export const idsOf = (p: Page, f: Field): string[] => {
  const v = p.fields?.[f.id]
  if (f.kind === 'page') return typeof v === 'string' && v ? [v] : []
  if (f.kind === 'pages' && Array.isArray(v)) return v.filter((x: any) => typeof x === 'string' && x)
  return []
}
// Tutte le pagine a cui questa rimanda dai metadati: collegamenti liberi (Note) e campi di relazione della scheda
export const refsOf = (p: Page, schemas: Schemas): string[] => {
  const out = new Set(p.links || [])
  schemaFor(schemas, p.type)?.fields.forEach((f) => idsOf(p, f).forEach((i) => out.add(i)))
  return [...out]
}

export type Fam = { parents: Page[]; siblings: Page[]; spouses: Page[]; children: Page[] }
// Famiglia di una pagina: genitori e coniugi dai campi con ruolo; figli e fratelli ricavati dalle altre pagine
export const famOf = (pages: Record<string, Page>, schemas: Schemas, p: Page): Fam => {
  const roleIds = (q: Page, role: 'parent' | 'spouse') => schemaFor(schemas, q.type)?.fields.filter((f) => f.role === role).flatMap((f) => idsOf(q, f)) ?? []
  const uniq = (l: (Page | undefined)[]) => [...new Map(l.filter(Boolean).map((x) => [x!.id, x!])).values()].sort(byDate)
  const all = Object.values(pages)
  const mine = roleIds(p, 'parent')
  return {
    parents: uniq(mine.map((i) => pages[i])),
    spouses: uniq([...roleIds(p, 'spouse').map((i) => pages[i]), ...all.filter((q) => q.id !== p.id && roleIds(q, 'spouse').includes(p.id))]),
    children: uniq(all.filter((q) => q.id !== p.id && roleIds(q, 'parent').includes(p.id))),
    siblings: uniq(all.filter((q) => q.id !== p.id && mine.length > 0 && roleIds(q, 'parent').some((i) => mine.includes(i)))),
  }
}

// Relazioni inverse dei campi con «inverso» e senza ruolo (es. «Alleato di» ⇄ «Alleati»): le altre pagine che puntano a questa
export const inverseRows = (pages: Record<string, Page>, schemas: Schemas, p: Page) => {
  const rows = new Map<string, Page[]>()
  Object.values(pages).forEach((q) => {
    if (q.id === p.id) return
    schemaFor(schemas, q.type)?.fields.forEach((f) => {
      if (!isRel(f) || f.role || !f.inverse || !idsOf(q, f).includes(p.id)) return
      const l = rows.get(f.inverse) ?? []
      if (!l.includes(q)) l.push(q)
      rows.set(f.inverse, l)
    })
  })
  return [...rows.entries()].map(([label, ps]) => ({ label, pages: ps.sort(byDate) }))
}

// Casato: il campo «Casato» (ruolo house) di un personaggio indica la pagina del casato; i membri si ricavano dalle altre pagine
export const houseFieldOf = (schemas: Schemas, q: Page): Field | undefined => schemaFor(schemas, q.type)?.fields.find((f) => f.role === 'house' && f.kind === 'page')
export const houseOf = (pages: Record<string, Page>, schemas: Schemas, q: Page): Page | undefined => {
  const f = houseFieldOf(schemas, q), id = f ? idsOf(q, f)[0] : ''
  return id ? pages[id] : undefined
}
export const membersOf = (pages: Record<string, Page>, schemas: Schemas, p: Page): Page[] =>
  Object.values(pages).filter((q) => { const f = houseFieldOf(schemas, q); return q.id !== p.id && !!f && idsOf(q, f).includes(p.id) }).sort(byDate)


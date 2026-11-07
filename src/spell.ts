import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/*
  Correttore interno, al posto di quello del browser (che non conosce le parole inventate e le sottolinea in rosso).
  Una parola è CONOSCIUTA, e non viene mai segnalata, se è: nel dizionario del mondo, in un titolo o in un tag,
  usata almeno due volte nel testo del mondo (scelta dell'autore), oppure nell'elenco di base della lingua (opzionale).
  Si segnala solo ciò che ha l'aria di un refuso:
  1. un nome quasi uguale a un titolo/tag/parola del dizionario (Arvenorr → Arvenor); maiuscole solo a metà frase,
     minuscole solo contro il dizionario scritto a mano (≥ 6 lettere);
  2. una parola quasi uguale a una usata spesso nel mondo (≥ 3 volte) o presente nell'elenco di base; la differenza
     non può stare nell'ultima lettera (altrimenti si segnalerebbero i plurali e le coniugazioni: gatto/gatti);
  3. solo con l'elenco di base: una parola sconosciuta senza nessuna parola vicina.
  Senza elenco di base il correttore impara dal testo del mondo, quindi è prudente nei mondi piccoli.
*/
export type Entry = { w: string; lower: string; cap: boolean; custom: boolean }
export type Base = { set: Set<string>; index: Map<string, string[]> }
export type Flag = { s: string } | null // s = correzione proposta (vuota: parola sconosciuta)
export type Vocab = {
  known: Set<string>; byLen: Map<number, Entry[]>
  freq: Map<string, number>; refs: Map<string, { w: string; n: number }[]>
  base: Base | null; cache: Map<string, Flag>
}
export type Miss = { x: number; y: number; from: number; to: number; word: string; sugg: string }

const WORD = /\p{L}[\p{L}-]*/gu
const START = new Set(['.', '!', '?', '…', ':', ';', '«', '“', '"', '—', '–', '(', '[', '\ufffc'])
const isCap = (w: string) => w[0] !== w[0].toLowerCase()

// Conteggio delle parole per pagina, rifatto solo per le pagine il cui testo è cambiato
const tok = new Map<string, { body: string; counts: Map<string, number> }>()
const clean = (b: string) => b.replace(/\]\((?:wiki|asset):[^)]*\)/g, ']').replace(/&emsp;|&nbsp;/g, ' ')
function countsOf(id: string, body: string) {
  const c = tok.get(id)
  if (c && c.body === body) return c.counts
  const m = new Map<string, number>()
  for (const w of clean(body).matchAll(WORD)) { const l = w[0].toLowerCase(); m.set(l, (m.get(l) ?? 0) + 1) }
  tok.set(id, { body, counts: m })
  return m
}

export function buildVocab(src: { titles: string[]; tags: string[]; bodies: { id: string; body: string }[]; custom: string[]; base: Base | null }): Vocab {
  const known = new Set<string>(), seen = new Set<string>(), byLen = new Map<number, Entry[]>()
  const add = (raw: string, isCustom: boolean) => {
    for (const m of raw.matchAll(WORD)) {
      const w = m[0], lower = w.toLowerCase(), cap = isCap(w)
      known.add(lower)
      if (w.length < 5 || (!isCustom && !cap) || (isCustom && !cap && w.length < 6)) continue
      const key = lower + (isCustom ? '!' : '')
      if (seen.has(key)) continue
      seen.add(key)
      const l = byLen.get(w.length) ?? []
      l.push({ w, lower, cap, custom: isCustom }); byLen.set(w.length, l)
    }
  }
  src.titles.forEach((t) => add(t, false)); src.tags.forEach((t) => add(t, false)); src.custom.forEach((t) => add(t, true))
  const freq = new Map<string, number>()
  for (const { id, body } of src.bodies) countsOf(id, body).forEach((n, w) => freq.set(w, (freq.get(w) ?? 0) + n))
  const refs = new Map<string, { w: string; n: number }[]>()
  freq.forEach((n, w) => { if (n >= 3 && w.length >= 4) { const k = w.length + w[0], l = refs.get(k) ?? []; l.push({ w, n }); refs.set(k, l) } })
  return { known, byLen, freq, refs, base: src.base, cache: new Map() }
}

// Elenco di base opzionale: public/dizionario-it.txt, una parola per riga (le righe di un dizionario hunspell «parola/flag» vanno bene)
let baseP: Promise<Base | null> | null = null
export function loadBase(): Promise<Base | null> {
  baseP ??= (async () => {
    try {
      const r = await fetch(new URL('dizionario-it.txt', document.baseURI).href)
      if (!r.ok || (r.headers.get('content-type') || '').includes('text/html')) return null
      const set = new Set<string>(), index = new Map<string, string[]>()
      for (const line of (await r.text()).split(/\r?\n/)) {
        const w = line.split('/')[0].trim().toLowerCase()
        if (!w || set.has(w) || !/^\p{L}[\p{L}-]*$/u.test(w)) continue
        set.add(w)
        if (w.length >= 4) { const k = w.length + w[0], l = index.get(k) ?? []; l.push(w); index.set(k, l) }
      }
      return set.size ? { set, index } : null
    } catch { return null }
  })()
  return baseP
}

// Distanza di Damerau (scambio di due lettere = 1); restituisce max + 1 se supera il limite.
function dist(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const n = a.length, m = b.length
  let prev2: number[] = [], prev = Array.from({ length: m + 1 }, (_, j) => j)
  for (let i = 1; i <= n; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= m; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev; prev = cur
  }
  return prev[m]
}

function nearName(v: Vocab, word: string, cap: boolean, sentenceStart: boolean): string | null {
  if (word.length < 5 || (cap && sentenceStart) || (!cap && word.length < 6)) return null
  const lower = word.toLowerCase(), max = word.length >= 9 ? 2 : 1
  let best: Entry | null = null, bd = max + 1
  for (let l = word.length - max; l <= word.length + max; l++) {
    for (const e of v.byLen.get(l) ?? []) {
      if (e.cap !== cap || (!cap && !e.custom)) continue
      const d = dist(lower, e.lower, max)
      if (d < bd) { bd = d; best = e }
    }
  }
  return best ? best.w : null
}

function nearRef(v: Vocab, lower: string): string | null {
  const last = lower[lower.length - 1]
  let best: { w: string; n: number } | null = null
  for (let l = lower.length - 1; l <= lower.length + 1; l++) {
    const k = l + lower[0]
    for (const e of v.refs.get(k) ?? []) {
      if (e.w === lower || e.w[e.w.length - 1] !== last) continue
      if (dist(lower, e.w, 1) <= 1 && (!best || e.n > best.n)) best = e
    }
    if (!best && v.base) for (const w of v.base.index.get(k) ?? []) {
      if (w === lower || w[w.length - 1] !== last) continue
      if (dist(lower, w, 1) <= 1) return w
    }
  }
  return best ? best.w : null
}

export function suggest(v: Vocab, word: string, sentenceStart: boolean): Flag {
  const lower = word.toLowerCase()
  if (word.length < 4 || v.known.has(lower)) return null
  const cap = isCap(word), key = lower + (cap ? 'C' : 'c') + (sentenceStart ? '1' : '0')
  const hit = v.cache.get(key)
  if (hit !== undefined) return hit
  let r: Flag = null
  if ((v.freq.get(lower) ?? 0) < 2 && !v.base?.set.has(lower)) {
    const name = nearName(v, word, cap, sentenceStart)
    const ref = name ? null : nearRef(v, lower)
    if (name) r = { s: name }
    else if (ref) r = { s: cap ? ref[0].toUpperCase() + ref.slice(1) : ref }
    else if (v.base && word.length >= 5 && !lower.includes('-')) r = { s: '' }
  }
  v.cache.set(key, r)
  return r
}

export const spellKey = new PluginKey('lkSpell')

export const SpellCheck = Extension.create<{ getVocab: () => Vocab | null; enabled: () => boolean; onMenu: (m: Miss) => void }>({
  name: 'spellCheck',
  addOptions() { return { getVocab: () => null, enabled: () => true, onMenu: () => {} } },
  addProseMirrorPlugins() {
    const opts = this.options
    const build = (doc: any) => {
      const v = opts.getVocab()
      if (!v || !opts.enabled()) return DecorationSet.empty
      const decos: Decoration[] = []
      doc.descendants((node: any, pos: number) => {
        if (!node.isTextblock) return true
        if (node.type.spec.code) return false
        const text: string = node.textBetween(0, node.content.size, undefined, '\ufffc')
        for (const m of text.matchAll(WORD)) {
          const i = m.index ?? 0, w = m[0]
          let j = i - 1
          while (j >= 0 && /\s/.test(text[j])) j--
          const f = suggest(v, w, j < 0 || START.has(text[j]))
          if (f) decos.push(Decoration.inline(pos + 1 + i, pos + 1 + i + w.length, { class: 'spell-miss', title: f.s ? `Forse intendevi «${f.s}» (tasto destro per correggere)` : 'Parola non presente nel dizionario (tasto destro per aggiungerla)', 'data-sugg': f.s }))
        }
        return false
      })
      return DecorationSet.create(doc, decos)
    }
    return [
      new Plugin({
        key: spellKey,
        state: {
          init: (_c: any, st: any) => build(st.doc),
          // si ricalcola quando cambia il testo o quando l'editor lo chiede (dizionario aggiornato)
          apply: (tr: any, old: any, _o: any, st: any) => (tr.docChanged || tr.getMeta(spellKey) ? build(st.doc) : old),
        },
        props: {
          decorations: (st: any) => spellKey.getState(st),
          handleDOMEvents: {
            contextmenu: (view: any, e: MouseEvent) => {
              if (!(e.target as HTMLElement).closest?.('.spell-miss')) return false
              const at = view.posAtCoords({ left: e.clientX, top: e.clientY })
              const set = spellKey.getState(view.state) as DecorationSet
              const d = at && set.find(at.pos, at.pos)[0]
              if (!d) return false
              e.preventDefault()
              opts.onMenu({ x: e.clientX, y: e.clientY, from: d.from, to: d.to, word: view.state.doc.textBetween(d.from, d.to), sugg: (d as any).type.attrs['data-sugg'] })
              return true
            },
          },
        },
      }),
    ]
  },
})

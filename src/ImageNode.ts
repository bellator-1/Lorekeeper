import Image from '@tiptap/extension-image'
import { useStore } from './store'

// Le opzioni dell'immagine stanno nel "title" markdown come coppie chiave=valore separate da ';':
//   ![](asset:x.png "align=left;w=40")
// Il formato è estendibile: chiavi sconosciute vengono conservate a ogni salvataggio, quindi
// si possono aggiungere nuove opzioni (didascalia, bordo, ecc.) senza rompere i file esistenti.
// Il vecchio formato "left,40" viene ancora letto e migrato al primo salvataggio.
const ALIGNS = ['left', 'center', 'right', 'full']
export type ImgOpts = { align: string; w: number; [k: string]: string | number }

export const parseImg = (t?: string | null): ImgOpts => {
  const o: any = { align: 'center', w: 60 }
  const s = (t || '').trim()
  if (s.includes('=')) {
    s.split(';').forEach((kv) => { const [k, ...v] = kv.split('='); if (k.trim()) o[k.trim()] = v.join('=').trim() })
  } else if (s) {
    const [a, w] = s.split(',')
    if (a) o.align = a
    if (w) o.w = w
  }
  o.align = ALIGNS.includes(o.align) ? o.align : 'center'
  o.w = Math.min(100, Math.max(10, +o.w || 60))
  return o
}
export const stringifyImg = (o: ImgOpts) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(';')

export const AssetImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      let cur = node
      const dom = document.createElement('div')
      dom.className = 'img-wrap'
      const img = document.createElement('img')
      img.draggable = false
      const src = node.attrs.src as string
      if (src.startsWith('asset:')) useStore.getState().vault?.assetUrl(src.slice(6)).then((u) => (img.src = u))
      else img.src = src
      dom.append(img)
      const apply = () => {
        const o = parseImg(cur.attrs.title)
        dom.dataset.align = o.align
        dom.style.width = o.align === 'full' ? '100%' : o.w + '%'
      }
      apply()
      return {
        dom,
        update: (n) => { if (n.type !== cur.type) return false; cur = n; apply(); return true },
        selectNode: () => dom.classList.add('sel'),
        deselectNode: () => dom.classList.remove('sel'),
      }
    }
  },
})

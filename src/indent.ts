import { Extension, InputRule } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'

/*
  Rientranza a blocco: l'intero paragrafo si sposta a destra di un certo numero di pixel (attributo `indent`).
  Nel file .md il paragrafo è racchiuso tra << e >>:
      <<Testo rientrato di 24 px (il passo normale).>>
      <<48|Testo rientrato di 48 px.>>
  (altri programmi mostrano le parentesi, Lorekeeper no). Tab / Maiusc+Tab e i pulsanti della barra cambiano di un passo;
  scrivere «<<» (o «<<48») seguito da spazio all'inizio di un paragrafo lo rientra subito.
  Elenchi e tabelle non sono toccati: lì Tab ha già un altro significato.
*/
export const STEP = 24
export const MAX = 480
const SKIP = ['listItem', 'taskItem', 'tableCell', 'tableHeader']
const clamp = (n: number) => Math.min(MAX, Math.max(0, Math.round(n) || 0))

export const IndentParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...(this as any).parent?.(),
      indent: {
        default: 0,
        parseHTML: (el: HTMLElement) => clamp(parseInt(el.getAttribute('data-indent') || '0', 10)),
        renderHTML: (attrs: any) => (attrs.indent ? { 'data-indent': String(attrs.indent), style: `margin-left:${attrs.indent}px` } : {}),
      },
    }
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const n = clamp(node.attrs.indent)
          if (n) state.write('<<' + (n === STEP ? '' : n + '|'))
          state.renderInline(node)
          if (n) state.write('>>')
          state.closeBlock(node)
        },
        parse: {
          // markdown-it (html: false) scrive «<<testo>>» come testo con < e > codificati: qui si riconosce e si toglie
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('p').forEach((p) => {
              const m = /^&lt;&lt;(?:(\d{1,3})\|)?([\s\S]*)&gt;&gt;$/.exec(p.innerHTML.trim())
              if (!m) return
              p.innerHTML = m[2]
              p.setAttribute('data-indent', String(clamp(m[1] ? parseInt(m[1], 10) : STEP)))
            })
          },
        },
      },
    }
  },
})

const blocks = (state: any) => {
  const { from, to } = state.selection
  const out: { pos: number; node: any }[] = []
  state.doc.nodesBetween(from, to, (node: any, pos: number, parent: any) => {
    if (!node.isTextblock) return true
    if (node.type.name === 'paragraph' && !SKIP.includes(parent?.type.name)) out.push({ pos, node })
    return false
  })
  return out
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> { indent: { indent: () => ReturnType; outdent: () => ReturnType } }
}

export const Indent = Extension.create({
  name: 'indent',
  addCommands() {
    const shift = (d: number) => () => ({ state, tr, dispatch }: any) => {
      const bl = blocks(state).filter((b) => clamp(b.node.attrs.indent + d) !== clamp(b.node.attrs.indent))
      if (!bl.length) return false
      if (dispatch) bl.forEach((b) => tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, indent: clamp(b.node.attrs.indent + d) }))
      return true
    }
    return { indent: shift(STEP), outdent: shift(-STEP) } as any
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => { (this.editor.commands as any).indent(); return blocks(this.editor.state).length > 0 },
      // Maiusc+Tab non deve far uscire il cursore dall'editor anche quando non c'è nulla da togliere
      'Shift-Tab': () => { (this.editor.commands as any).outdent(); return blocks(this.editor.state).length > 0 },
      // Backspace all'inizio di un paragrafo rientrato: toglie un passo di rientranza invece di unirlo al precedente
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection
        if (!empty || $from.parentOffset !== 0 || $from.parent.type.name !== 'paragraph' || !$from.parent.attrs.indent) return false
        return (this.editor.commands as any).outdent()
      },
    }
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^<<(\d{1,3})?\s$/,
        handler: ({ state, range, match }: any) => {
          const $from = state.doc.resolve(range.from)
          if ($from.parent.type.name !== 'paragraph' || SKIP.includes($from.node(-1)?.type.name)) return null
          const px = clamp(match[1] ? parseInt(match[1], 10) : STEP)
          state.tr.delete(range.from, range.to).setNodeMarkup($from.before(), undefined, { ...$from.parent.attrs, indent: px })
        },
      }),
    ]
  },
})

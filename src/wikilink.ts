import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { useStore } from './store'

// Digitando "[[" compare l'elenco delle pagine; Invio inserisce un link (href "wiki:<id>").
// Se non esiste una pagina con quel titolo, propone di crearla.
export const WikiSuggest = Extension.create({
  name: 'wikiSuggest',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '[[',
        allowSpaces: true,
        items: ({ query }) => {
          const q = query.trim().toLowerCase()
          const all = Object.values(useStore.getState().pages)
          const res: any[] = all.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 8)
          if (q && !all.some((p) => p.title.toLowerCase() === q)) res.push({ isNew: true, title: query.trim() })
          return res
        },
        command: ({ editor, range, props }) => {
          const page = props.isNew ? useStore.getState().create(props.title) : props
          editor.chain().focus().insertContentAt(range, [
            { type: 'text', text: page.title, marks: [{ type: 'link', attrs: { href: 'wiki:' + page.id } }] },
            { type: 'text', text: ' ' },
          ]).run()
        },
        render: () => {
          let el: HTMLDivElement, items: any[] = [], sel = 0, cmd: any
          const draw = () => {
            el.innerHTML = ''
            if (!items.length) el.textContent = 'Nessuna pagina'
            items.forEach((p, i) => {
              const d = document.createElement('div')
              d.className = 'sug' + (i === sel ? ' on' : '')
              d.textContent = p.isNew ? `Crea "${p.title}"` : p.title
              d.onmousedown = (e) => { e.preventDefault(); cmd(p) }
              el.appendChild(d)
            })
          }
          const place = (p: any) => {
            const r = p.clientRect?.()
            if (r) { el.style.left = r.left + 'px'; el.style.top = r.bottom + 4 + 'px' }
          }
          return {
            onStart: (p) => {
              el = document.createElement('div'); el.className = 'sug-box'; document.body.appendChild(el)
              items = p.items; cmd = p.command; sel = 0; draw(); place(p)
            },
            onUpdate: (p) => { items = p.items; cmd = p.command; sel = 0; draw(); place(p) },
            onKeyDown: ({ event }) => {
              const n = Math.max(items.length, 1)
              if (event.key === 'ArrowDown') { sel = (sel + 1) % n; draw(); return true }
              if (event.key === 'ArrowUp') { sel = (sel - 1 + n) % n; draw(); return true }
              if (event.key === 'Enter' && items[sel]) { cmd(items[sel]); return true }
              return false
            },
            onExit: () => el?.remove(),
          }
        },
      }),
    ]
  },
})

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from 'tiptap-markdown'
import { useNavigate } from 'react-router-dom'
import { WikiSuggest } from './wikilink'
import { useStore } from './store'
import { useSettings } from './settings'
import { ContextMenu, MenuItem } from './ui'
import { Indent, IndentParagraph } from './indent'
import { SpellCheck, spellKey, buildVocab, loadBase, Base, Miss, Vocab } from './spell'
import { AssetImage, parseImg, stringifyImg } from './ImageNode'
import type { Page } from './types'

// Le rientranze (U+2003) si salvano come entità: il lettore markdown altrimenti le elimina a inizio paragrafo.
const toFile = (md: string) => md.replace(/^((?:> ?)*)(\u2003+)/gm, (_m, q, s) => q + '&emsp;'.repeat(s.length))

export default function Editor({ page }: { page: Page }) {
  const nav = useNavigate()
  const ref = useRef<any>(null)
  const { pages, dictionary, addWords } = useStore()
  const { spell, nativeSpell } = useSettings()
  const [miss, setMiss] = useState<Miss | null>(null)
  // Vocabolario del correttore: titoli, tag, dizionario del mondo e testo di tutte le pagine; si ricalcola con un po' di ritardo
  const vocabRef = useRef<Vocab | null>(null)
  const [base, setBase] = useState<Base | null>(null)
  useEffect(() => { loadBase().then(setBase) }, [])
  const mkVocab = () => buildVocab({ titles: Object.values(pages).map((p) => p.title), tags: Object.values(pages).flatMap((p) => p.tags), bodies: Object.values(pages).map((p) => ({ id: p.id, body: p.body })), custom: dictionary, base })
  const [vocab, setVocab] = useState<Vocab>(mkVocab)
  useEffect(() => { const t = window.setTimeout(() => setVocab(mkVocab()), 600); return () => clearTimeout(t) }, [pages, dictionary, base])
  vocabRef.current = vocab

  const onFiles = (files?: FileList | null) => {
    const imgs = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return false
    imgs.forEach(async (f) => {
      const name = await useStore.getState().vault!.addAsset(f)
      ref.current?.chain().focus().insertContent([{ type: 'image', attrs: { src: 'asset:' + name, title: 'align=center;w=60' } }, { type: 'paragraph' }]).run()
    })
    return true
  }

  const editor = useEditor(
    {
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({ paragraph: false }),
        IndentParagraph,
        Link.configure({ openOnClick: false, protocols: ['wiki'] }),
        AssetImage,
        Placeholder.configure({ placeholder: 'Inizia a scrivere…' }),
        Table, TableRow, TableHeader, TableCell, TaskList, TaskItem.configure({ nested: true }),
        Markdown.configure({ html: false, linkify: false }),
        WikiSuggest,
        Indent,
        SpellCheck.configure({ getVocab: () => vocabRef.current, enabled: () => useSettings.getState().spell, onMenu: setMiss }),
      ],
      content: page.body,
      editorProps: {
        handleClick: (_v, _p, e) => {
          const href = (e.target as HTMLElement).closest('a')?.getAttribute('href')
          if (href?.startsWith('wiki:')) { e.preventDefault(); nav('/w/' + href.slice(5)); return true }
          return false
        },
        handlePaste: (_v, e) => onFiles(e.clipboardData?.files),
        handleDrop: (_v, e) => onFiles((e as DragEvent).dataTransfer?.files),
      },
      onUpdate: ({ editor }) => {
        const cur = useStore.getState().pages[page.id]
        if (cur) useStore.getState().upsert({ ...cur, body: toFile(editor.storage.markdown.getMarkdown()) })
      },
    },
    [page.id],
  )
  ref.current = editor
  // Il correttore ricalcola quando cambia il dizionario o l'interruttore; l'attributo spellcheck regola quello del browser.
  useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(spellKey, true)) }, [editor, vocab, spell])
  useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dom.setAttribute('spellcheck', String(nativeSpell)) }, [editor, nativeSpell])
  if (!editor) return null

  const Btn = ({ children, title, run, on }: { children: ReactNode; title: string; run: () => void; on?: boolean }) => (
    <button type="button" title={title} aria-label={title} aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()} onClick={run}
      className={`h-7 min-w-7 rounded px-2 text-sm ${on ? 'bg-accent text-on-accent' : 'text-muted hover:bg-line/60 hover:text-ink'}`}>
      {children}
    </button>
  )
  const Sep = () => <span className="mx-1 w-px self-stretch bg-line" />
  const c = () => editor.chain().focus()

  // Con un'immagine selezionata, i suoi controlli sostituiscono la formattazione nella stessa barra:
  // posizione fissa, nessun overlay sul testo, nessuno spostamento quando cambia la larghezza.
  const img = editor.isActive('image') ? parseImg(editor.getAttributes('image').title) : null
  const setImg = (p: object) => editor.commands.updateAttributes('image', { title: stringifyImg({ ...parseImg(editor.getAttributes('image').title), ...p }) })
  const inTable = editor.isActive('table')
  const imageControls = img && (
    <>
      <span className="mr-1 text-xs text-muted">Immagine</span>
      {([['left', 'Sinistra'], ['center', 'Centro'], ['right', 'Destra'], ['full', 'Larga']] as const).map(([a, l]) => (
        <Btn key={a} title={l} on={img.align === a} run={() => setImg({ align: a })}>{l}</Btn>
      ))}
      <Sep />
      <label className="flex items-center gap-2 text-xs text-muted">Larghezza
        <input type="range" min={15} max={100} value={img.w} disabled={img.align === 'full'} onChange={(e) => setImg({ w: +e.target.value })} className="w-40 accent-accent" />
        <span className="w-9 tabular-nums">{img.w}%</span>
      </label>
      <Sep />
      <Btn title="Rimuovi immagine" run={() => c().deleteSelection().run()}>Rimuovi</Btn>
    </>
  )

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-y border-line bg-paper px-5 py-1.5">
        {imageControls ?? (<>
        <Btn title="Grassetto" on={editor.isActive('bold')} run={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn title="Corsivo" on={editor.isActive('italic')} run={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Sep />
        {([1, 2, 3] as const).map((l) => (
          <Btn key={l} title={`Titolo ${l}`} on={editor.isActive('heading', { level: l })} run={() => c().toggleHeading({ level: l }).run()}>H{l}</Btn>
        ))}
        <Sep />
        {inTable ? (
          <>
            <Btn title="Aggiungi riga" run={() => c().addRowAfter().run()}>+ Riga</Btn>
            <Btn title="Aggiungi colonna" run={() => c().addColumnAfter().run()}>+ Colonna</Btn>
            <Btn title="Elimina riga" run={() => c().deleteRow().run()}>− Riga</Btn>
            <Btn title="Elimina colonna" run={() => c().deleteColumn().run()}>− Colonna</Btn>
            <Btn title="Elimina tabella" run={() => c().deleteTable().run()}>Elimina tabella</Btn>
          </>
        ) : (
          <>
            <Btn title="Elenco puntato" on={editor.isActive('bulletList')} run={() => c().toggleBulletList().run()}>• Elenco</Btn>
            <Btn title="Elenco numerato" on={editor.isActive('orderedList')} run={() => c().toggleOrderedList().run()}>1. Elenco</Btn>
            <Btn title="Lista di attività" on={editor.isActive('taskList')} run={() => c().toggleTaskList().run()}>☑ Attività</Btn>
            <Btn title="Citazione" on={editor.isActive('blockquote')} run={() => c().toggleBlockquote().run()}>❝</Btn>
            <Btn title="Tabella" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ Tabella</Btn>
            <Btn title="Linea" run={() => c().setHorizontalRule().run()}>—</Btn>
            <Sep />
            <Btn title="Riduci la rientranza del paragrafo (Maiusc+Tab)" run={() => c().outdent().run()}>⇤</Btn>
            <Btn title="Rientra il paragrafo (Tab); «<<» + spazio a inizio riga fa lo stesso" run={() => c().indent().run()}>⇥</Btn>
          </>
        )}
        <Sep />
        <Btn title="Collega a una pagina" run={() => c().insertContent('[[').run()}>[[ Link</Btn>
        </>)}
      </div>
      <div className="lore scroll-pretty min-h-0 flex-1 cursor-text overflow-y-auto rounded-b-xl px-8 pb-10 pt-6" onClick={(e) => { if (e.target === e.currentTarget) editor.commands.focus('end') }}>
        <EditorContent editor={editor} />
      </div>
      {miss && (
        <ContextMenu x={miss.x} y={miss.y} onClose={() => setMiss(null)}>
          {miss.sugg && <MenuItem onClick={() => { editor.view.dispatch(editor.state.tr.insertText(miss.sugg, miss.from, miss.to)); editor.commands.focus() }}>Correggi in «{miss.sugg}»</MenuItem>}
          <MenuItem onClick={() => addWords([miss.word])}>Aggiungi «{miss.word}» al dizionario</MenuItem>
        </ContextMenu>
      )}
    </>
  )
}

import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONTS = {
  serif: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
  display: '"Fraunces Variable", Georgia, serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
}
type Data = {
  theme: 'auto' | 'light' | 'dark'; font: keyof typeof FONTS; size: number; lh: number; width: number
  left: boolean; right: boolean; closed: string[]; leftW: number; rightW: number; volume: number
  folderView: boolean; counts: boolean; hiddenFolders: string[]; hideRoot: boolean
  spell: boolean; nativeSpell: boolean
  graph: { text: boolean; meta: boolean; parent: boolean; isolated: boolean; cluster: boolean }
  hiddenPages: string[]; starsTop: boolean; onlyStars: boolean
}
type St = Data & { set: (p: Partial<Data>) => void; resize: (k: 'leftW' | 'rightW', dx: number) => void }

export const useSettings = create<St>()(
  persist((set) => ({
    theme: 'auto', font: 'serif', size: 18, lh: 1.7, width: 780, left: true, right: true, closed: [], leftW: 272, rightW: 300, volume: 0.6, folderView: true, counts: true, hiddenFolders: [], hideRoot: false, spell: true, nativeSpell: false, graph: { text: true, meta: true, parent: true, isolated: true, cluster: false }, hiddenPages: [], starsTop: true, onlyStars: false,
    set: (p) => set(p),
    resize: (k, dx) => set((s) => ({ [k]: Math.min(560, Math.max(200, s[k] + dx)) }) as any),
  }), {
    name: 'lorekeeper-settings',
    version: 2,
    // v2: il correttore del browser è spento (le parole inventate non sono errori); si riaccende dal Dizionario
    migrate: (s: any, v: number) => (v < 2 ? { ...s, nativeSpell: false } : s),
  }),
)

export function useApplySettings() {
  const { theme, font, size, lh, width } = useSettings()
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && mq.matches))
    apply(); mq.addEventListener('change', apply)
    const st = document.documentElement.style
    st.setProperty('--editor-font', FONTS[font]); st.setProperty('--editor-size', size + 'px')
    st.setProperty('--editor-lh', String(lh)); st.setProperty('--editor-width', width + 'px')
    return () => mq.removeEventListener('change', apply)
  }, [theme, font, size, lh, width])
}

import type { EdgeShape as EdgeShapeSetting } from '@/features/graph/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_BASE_URL } from '@/features/zotero/local-api'
import type { ZoteroLibraryType } from '@/features/zotero/types'

export type SourceMode = 'local' | 'demo'

export interface SettingsState {
  /** `local` talks to Zotero; `demo` serves the bundled fixture library. */
  mode: SourceMode
  baseUrl: string
  libraryType: ZoteroLibraryType
  libraryId: number
  /** CSL style id passed to `include=bib`. */
  citationStyle: string
  /** Default routing style for new connections. */
  edgeShape: EdgeShapeSetting
  /** View-only: nothing on the board can be moved, connected or deleted. */
  viewOnly: boolean
  /** Only used when `baseUrl` points at api.zotero.org instead of the local server. */
  apiKey: string
  /** Auto-refresh item snapshots on a board when Zotero is reachable. */
  autoRehydrate: boolean
  setMode: (mode: SourceMode) => void
  setBaseUrl: (baseUrl: string) => void
  setLibrary: (type: ZoteroLibraryType, id: number) => void
  setCitationStyle: (style: string) => void
  setEdgeShape: (shape: EdgeShapeSetting) => void
  toggleViewOnly: () => void
  setApiKey: (key: string) => void
  setAutoRehydrate: (value: boolean) => void
  reset: () => void
}

const DEFAULTS = {
  mode: 'local' as SourceMode,
  baseUrl: import.meta.env.VITE_ZOTERO_BASE_URL ?? DEFAULT_BASE_URL,
  libraryType: 'user' as ZoteroLibraryType,
  libraryId: 0,
  citationStyle: 'apa',
  edgeShape: 'bezier' as const,
  viewOnly: false,
  apiKey: '',
  autoRehydrate: true,
}

export const CITATION_STYLES = [
  { id: 'apa', label: 'APA 7th' },
  { id: 'chicago-note-bibliography', label: 'Chicago (note)' },
  { id: 'modern-language-association', label: 'MLA 9th' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'nature', label: 'Nature' },
  { id: 'vancouver', label: 'Vancouver' },
]

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMode: (mode) => set({ mode }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setLibrary: (libraryType, libraryId) => set({ libraryType, libraryId }),
      setCitationStyle: (citationStyle) => set({ citationStyle }),
      setEdgeShape: (edgeShape) => set({ edgeShape }),
      toggleViewOnly: () => set((state) => ({ viewOnly: !state.viewOnly })),
      setApiKey: (apiKey) => set({ apiKey }),
      setAutoRehydrate: (autoRehydrate) => set({ autoRehydrate }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'mindtero.settings', version: 1 },
  ),
)

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSettings } from '@/lib/settings'
import { DemoSource } from './demo'
import { LocalApiSource } from './local-api'
import type { ZoteroSource } from './source'

const ZoteroSourceContext = createContext<ZoteroSource | null>(null)

/** Builds the active {@link ZoteroSource} from settings and shares it with the tree. */
export function ZoteroProvider({ children }: { children: ReactNode }) {
  const mode = useSettings((s) => s.mode)
  const baseUrl = useSettings((s) => s.baseUrl)
  const libraryType = useSettings((s) => s.libraryType)
  const libraryId = useSettings((s) => s.libraryId)
  const apiKey = useSettings((s) => s.apiKey)

  const source = useMemo<ZoteroSource>(() => {
    if (mode === 'demo') return new DemoSource()
    return new LocalApiSource({
      baseUrl,
      library: { type: libraryType, id: libraryId },
      apiKey: apiKey || undefined,
    })
  }, [mode, baseUrl, libraryType, libraryId, apiKey])

  return <ZoteroSourceContext.Provider value={source}>{children}</ZoteroSourceContext.Provider>
}

export function useZoteroSource(): ZoteroSource {
  const source = useContext(ZoteroSourceContext)
  if (!source) throw new Error('useZoteroSource must be used inside <ZoteroProvider>')
  return source
}

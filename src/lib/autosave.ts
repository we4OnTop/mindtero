import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'

/** Ambient API injected by the Electron preload; absent in a normal browser. */
interface MindteroDesktop {
  isDesktop: boolean
  autoSave: (json: string) => Promise<{ ok: boolean; path?: string; error?: string }>
  loadAutosave: () => Promise<{ ok: boolean; json?: string; path?: string; error?: string }>
  autosavePath: () => Promise<string>
  revealAutosave: () => void
}

declare global {
  interface Window {
    mindtero?: MindteroDesktop
  }
}

const SAVE_INTERVAL_MS = 4000
const MIN_GAP_MS = 4000

const desktop = (): MindteroDesktop | null => window.mindtero ?? null

/** Snapshot of every board as one string — cheap enough for a debounce loop. */
function serializeBoards(): string {
  const state = useBoards.getState()
  const boards = state.order.map((id) => state.boards[id]).filter(Boolean)
  return JSON.stringify({
    format: 'mindtero.autosave',
    version: 1,
    savedAt: new Date().toISOString(),
    boards,
  })
}

/**
 * In the desktop shell, changes are flushed into <Documents>/Mindtero every
 * few seconds. In the browser this is a no-op (IndexedDB already persists).
 */
export function initAutoSave(): void {
  if (!desktop()?.isDesktop) return

  let timer: number | null = null
  let lastPayload = serializeBoards()
  let lastSave = 0

  useBoards.subscribe(() => {
    if (timer !== null) return
    timer = window.setTimeout(() => {
      timer = null
      const next = serializeBoards()
      if (next === lastPayload) return
      if (Date.now() - lastSave < MIN_GAP_MS) return
      lastPayload = next
      lastSave = Date.now()
      void desktop()
        ?.autoSave(next)
        .then((result) => {
          if (!result.ok) console.warn('Mindtero autosave failed', result.error)
        })
    }, SAVE_INTERVAL_MS)
  })
}

/** Offers to restore the last autosave before IndexedDB takes over. */
export async function restoreFromAutosave(): Promise<number | null> {
  const result = await desktop()?.loadAutosave()
  if (!result?.ok || !result.json) return null
  try {
    const parsed = JSON.parse(result.json) as {
      format: string
      boards: Board[]
    }
    if (parsed.format !== 'mindtero.autosave' || !Array.isArray(parsed.boards)) return null
    const state = useBoards.getState()
    const ids = parsed.boards.map((board) => state.importBoard(board))
    return ids.length
  } catch {
    return null
  }
}

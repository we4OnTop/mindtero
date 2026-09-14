import type { Board } from '@/features/graph/types'

/** Storage details reported by the Electron main process. */
export interface DesktopStorageInfo {
  projectDir: string
  defaultProjectDir: string
  autosaveFile: string
  isDefault: boolean
  /** Board id → file path the user picked for that board. */
  boardFiles: Record<string, string>
  rescueDone: boolean
}

interface SaveResult {
  ok: boolean
  path?: string
  error?: string
}

/** Ambient API injected by the Electron preload; absent in a normal browser. */
export interface MindteroDesktop {
  isDesktop: boolean
  autoSave: (json: string) => Promise<SaveResult>
  autoSaveSync: (json: string) => SaveResult
  loadAutosave: () => Promise<{ ok: boolean; json?: string; path?: string; error?: string }>
  autosavePath: () => Promise<string>
  revealAutosave: () => Promise<void>
  storageInfo: () => Promise<DesktopStorageInfo>
  chooseProjectDir: () => Promise<DesktopStorageInfo | null>
  resetProjectDir: () => Promise<DesktopStorageInfo>
  chooseBoardFile: (boardId: string, boardName: string) => Promise<DesktopStorageInfo | null>
  clearBoardFile: (boardId: string) => Promise<DesktopStorageInfo>
  saveBoardFile: (boardId: string, json: string) => Promise<SaveResult>
  loadBoardFiles: () => Promise<{ boardId: string; path: string; json?: string; error?: string }[]>
  revealBoardFile: (boardId: string) => Promise<void>
  openExternal: (url: string) => Promise<boolean>
  rescueBoards: () => Promise<{ scanned: number; boards: Board[] }>
  markRescueDone: () => Promise<void>
}

declare global {
  interface Window {
    mindtero?: MindteroDesktop
  }
}

export function desktop(): MindteroDesktop | null {
  return typeof window !== 'undefined' && window.mindtero?.isDesktop ? window.mindtero : null
}

/**
 * Opens zotero://, http(s):// and mailto: links. In Electron the main process
 * validates the scheme and hands the URL to the OS; in a browser the protocol
 * handler (Zotero) is triggered directly.
 */
export function openExternal(url: string): void {
  const shell = desktop()
  if (shell) {
    void shell.openExternal(url)
    return
  }
  if (/^https?:/i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.href = url
}

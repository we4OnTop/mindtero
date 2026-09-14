import { create } from 'zustand'
import { parseBoardsFile, serializeBoardFile } from '@/features/graph/board-io'
import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'
import { desktop, type DesktopStorageInfo, type MindteroDesktop } from './desktop'

/**
 * Desktop persistence. The project file is the durable copy of every board;
 * IndexedDB is only the fast local cache.
 *
 * Order matters: the file is read and merged into the store *before* the first
 * write. Saving first would let a session that starts with an empty cache (a new
 * origin, a cleared profile) overwrite the project file with nothing.
 */

const SAVE_DEBOUNCE_MS = 1200
const SAVE_MAX_WAIT_MS = 6000

export interface DesktopStorageState {
  /** True once the project files have been merged and autosave is running. */
  ready: boolean
  /** True once loading finished, successfully or not. */
  loaded: boolean
  info: DesktopStorageInfo | null
  lastSavedAt: string | null
  error: string | null
  /** Boards found in old app sessions that are missing or newer than local ones. */
  rescueCandidates: Board[] | null
}

export const useDesktopStorage = create<DesktopStorageState>()(() => ({
  ready: false,
  loaded: false,
  info: null,
  lastSavedAt: null,
  error: null,
  rescueCandidates: null,
}))

function currentBoards(): Board[] {
  const state = useBoards.getState()
  return state.order.map((id) => state.boards[id]).filter((board): board is Board => Boolean(board))
}

function serializeAutosave(boards: Board[]): string {
  return JSON.stringify({
    format: 'mindtero.autosave',
    version: 1,
    savedAt: new Date().toISOString(),
    boards,
  })
}

function waitForHydration(): Promise<void> {
  if (useBoards.persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const unsubscribe = useBoards.persist.onFinishHydration(() => {
      unsubscribe()
      resolve()
    })
  })
}

/** Merges the project file and every linked board file into the store. */
async function loadProjectFiles(shell: MindteroDesktop): Promise<number> {
  const incoming: Board[] = []
  const autosave = await shell.loadAutosave()
  if (autosave.ok && autosave.json) {
    // Deliberately not caught: an unreadable project file must stop autosave
    // rather than be overwritten (see initAutoSave).
    incoming.push(...parseBoardsFile(autosave.json).boards)
  }
  for (const file of await shell.loadBoardFiles()) {
    if (!file.json) continue
    try {
      // A board file always belongs to the board it was linked to.
      incoming.push(...parseBoardsFile(file.json).boards.map((board) => ({ ...board, id: file.boardId })))
    } catch {
      // A broken board file must not block the rest; it is reported on save.
    }
  }
  const { added, updated } = useBoards.getState().mergeBoards(incoming)
  return added.length + updated.length
}

let flushNow: (() => void) | null = null

function startSaving(shell: MindteroDesktop): void {
  let lastBody = JSON.stringify(currentBoards())
  const writtenBoardFiles = new Map<string, string>()
  let timer: number | null = null
  let firstPendingAt = 0

  const saveBoardFiles = () => {
    const files = useDesktopStorage.getState().info?.boardFiles ?? {}
    const { boards } = useBoards.getState()
    for (const boardId of Object.keys(files)) {
      const board = boards[boardId]
      if (!board || writtenBoardFiles.get(boardId) === board.updatedAt) continue
      writtenBoardFiles.set(boardId, board.updatedAt)
      void shell.saveBoardFile(boardId, serializeBoardFile(board)).then((result) => {
        if (!result.ok) {
          writtenBoardFiles.delete(boardId)
          useDesktopStorage.setState({ error: `Could not write ${result.path ?? 'board file'}: ${result.error}` })
        }
      })
    }
  }

  const save = (force = false) => {
    timer = null
    firstPendingAt = 0
    const boards = currentBoards()
    const body = JSON.stringify(boards)
    saveBoardFiles()
    if (!force && body === lastBody) return
    lastBody = body
    void shell.autoSave(serializeAutosave(boards)).then((result) => {
      if (result.ok) {
        useDesktopStorage.setState({ lastSavedAt: new Date().toISOString(), error: null })
      } else {
        lastBody = ''
        useDesktopStorage.setState({ error: result.error ?? 'Autosave failed' })
      }
    })
  }

  flushNow = () => {
    if (timer !== null) window.clearTimeout(timer)
    writtenBoardFiles.clear()
    save(true)
  }

  useBoards.subscribe((state, previous) => {
    if (state.boards === previous.boards && state.order === previous.order) return
    const now = Date.now()
    if (!firstPendingAt) firstPendingAt = now
    if (timer !== null) window.clearTimeout(timer)
    // Debounce bursts (dragging), but never postpone a save indefinitely.
    const wait = now - firstPendingAt > SAVE_MAX_WAIT_MS ? 0 : SAVE_DEBOUNCE_MS
    timer = window.setTimeout(() => save(), wait)
  })

  // A pending debounce would be lost on close, so flush synchronously.
  window.addEventListener('beforeunload', () => {
    if (timer === null) return
    window.clearTimeout(timer)
    shell.autoSaveSync(serializeAutosave(currentBoards()))
  })
}

/** Boards from a rescue scan that are not already here in the same or a newer state. */
function rescuable(found: Board[]): Board[] {
  const { boards } = useBoards.getState()
  return found.filter((board) => {
    const local = boards[board.id]
    return !local || board.updatedAt > local.updatedAt
  })
}

/** Scans old app sessions for stranded boards and exposes them for restoring. */
export async function scanForRescuableBoards(): Promise<{ scanned: number; found: number }> {
  const shell = desktop()
  if (!shell) return { scanned: 0, found: 0 }
  const result = await shell.rescueBoards()
  const candidates = rescuable(result.boards)
  useDesktopStorage.setState({ rescueCandidates: candidates.length ? candidates : null })
  return { scanned: result.scanned, found: candidates.length }
}

export function restoreRescuedBoards(ids: string[]): number {
  const candidates = useDesktopStorage.getState().rescueCandidates ?? []
  const picked = candidates.filter((board) => ids.includes(board.id))
  const { added, updated } = useBoards.getState().mergeBoards(picked)
  useDesktopStorage.setState({ rescueCandidates: null })
  return added.length + updated.length
}

export function dismissRescue(): void {
  useDesktopStorage.setState({ rescueCandidates: null })
}

/** Lets the user move the project folder; boards already in that folder are merged in. */
export async function changeProjectDir(reset = false): Promise<boolean> {
  const shell = desktop()
  if (!shell) return false
  const info = reset ? await shell.resetProjectDir() : await shell.chooseProjectDir()
  if (!info) return false
  useDesktopStorage.setState({ info })
  await loadProjectFiles(shell)
  flushNow?.()
  return true
}

export async function linkBoardFile(board: Board): Promise<boolean> {
  const shell = desktop()
  if (!shell) return false
  const info = await shell.chooseBoardFile(board.id, board.name)
  if (!info) return false
  useDesktopStorage.setState({ info })
  flushNow?.()
  return true
}

export async function unlinkBoardFile(boardId: string): Promise<void> {
  const shell = desktop()
  if (!shell) return
  useDesktopStorage.setState({ info: await shell.clearBoardFile(boardId) })
}

/**
 * In the desktop shell, loads the project files and then keeps them in sync.
 * In the browser this is a no-op (IndexedDB already persists).
 */
export async function initAutoSave(): Promise<void> {
  const shell = desktop()
  if (!shell) return
  try {
    await waitForHydration()
    useDesktopStorage.setState({ info: await shell.storageInfo() })
    await loadProjectFiles(shell)
  } catch (error) {
    // Never write over a project file we could not read: autosave stays off and
    // the gallery shows why. IndexedDB keeps working in the meantime.
    useDesktopStorage.setState({
      loaded: true,
      error: `Autosave is paused — the project file could not be read: ${(error as Error).message}`,
    })
    return
  }
  startSaving(shell)
  useDesktopStorage.setState({ ready: true, loaded: true })
  // Make sure the project file reflects the merged state right away.
  flushNow?.()

  if (!useDesktopStorage.getState().info?.rescueDone) {
    try {
      await scanForRescuableBoards()
    } catch {
      // Recovery is best-effort and can be retried from the board gallery.
    }
  }
}

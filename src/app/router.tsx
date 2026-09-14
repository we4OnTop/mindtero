import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import BoardGallery from '@/features/boards/boards-page'
import { BoardPage } from '@/features/graph/board-page'
import { useBoards } from '@/features/graph/store'
import { useDesktopStorage } from '@/lib/autosave'
import { desktop } from '@/lib/desktop'

/**
 * Boards arrive asynchronously: IndexedDB hydration first, then (on desktop) the
 * project file. Deciding "this board does not exist" before both finished sent
 * every reload of a board URL back to the gallery.
 */
function useBoardsLoaded(): boolean {
  const hydrated = useSyncExternalStore(
    (notify) => useBoards.persist.onFinishHydration(notify),
    () => useBoards.persist.hasHydrated(),
  )
  const filesLoaded = useDesktopStorage((state) => state.loaded)
  return hydrated && (!desktop() || filesLoaded)
}

function RequireBoard({ id, children }: { id: string; children: ReactNode }) {
  const setActiveBoard = useBoards((state) => state.setActiveBoard)
  const exists = useBoards((state) =>
    Object.prototype.hasOwnProperty.call(state.boards, id),
  )
  const loaded = useBoardsLoaded()

  useEffect(() => {
    if (exists) setActiveBoard(id)
  }, [exists, id, setActiveBoard])

  if (!exists && !loaded) return null
  if (!exists) return <Navigate to="/boards" replace />
  return <>{children}</>
}

function BoardScreen() {
  const { id = '' } = useParams()
  return (
    <RequireBoard id={id}>
      <BoardPage />
    </RequireBoard>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/boards" replace />} />
        <Route path="/boards" element={<BoardGallery />} />
        <Route path="/boards/:id" element={<BoardScreen />} />
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

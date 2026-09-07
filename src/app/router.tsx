import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import BoardGallery from '@/features/boards/boards-page'
import { BoardPage } from '@/features/graph/board-page'
import { useBoards } from '@/features/graph/store'

function RequireBoard({ id, children }: { id: string; children: ReactNode }) {
  const setActiveBoard = useBoards((state) => state.setActiveBoard)
  const exists = useBoards((state) =>
    Object.prototype.hasOwnProperty.call(state.boards, id),
  )

  useEffect(() => {
    if (exists) setActiveBoard(id)
  }, [exists, id, setActiveBoard])

  // Boards persist in IndexedDB, so there is no async loading state: an
  // unknown id simply never materialises in the store and we redirect.
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

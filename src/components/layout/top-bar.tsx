import { ArrowLeft, Eye, EyeOff, PenLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConnectionBadge } from '@/components/layout/connection-badge'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'
import { useSettings } from '@/lib/settings'

function ViewOnlyToggle() {
  const viewOnly = useSettings((state) => state.viewOnly)
  const toggle = useSettings((state) => state.toggleViewOnly)
  return (
    <Button
      size="icon-sm"
      variant={viewOnly ? 'secondary' : 'ghost'}
      onClick={() => {
        toggle()
        toast.success(viewOnly ? 'Editing enabled' : 'View-only mode — the board cannot be changed')
      }}
      aria-pressed={viewOnly}
      aria-label={viewOnly ? 'Switch to edit mode' : 'Switch to view-only mode'}
      title={viewOnly ? 'Back to editing' : 'Protect the board (view-only)'}
    >
      {viewOnly ? <EyeOff /> : <Eye />}
    </Button>
  )
}

function BoardName({ board }: { board: Board }) {
  const updateBoardMeta = useBoards((state) => state.updateBoardMeta)
  const edit = () => {
    const next = window.prompt('Board name', board.name)?.trim()
    if (!next || next === board.name) return
    updateBoardMeta(board.id, { name: next })
    toast.success('Board renamed')
  }
  return (
    <button
      type="button"
      onClick={edit}
      className="hover:bg-accent flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium"
      title="Rename board"
    >
      <span className="truncate">{board.name}</span>
      <PenLine className="text-muted-foreground size-3 shrink-0" />
    </button>
  )
}

export function TopBar({ board }: { board: Board }) {
  return (
    <header className="bg-background/95 supports-backdrop-filter:backdrop-blur flex items-center gap-2 border-b px-3 py-2 backdrop-blur">
      <Button size="icon-sm" variant="ghost" asChild aria-label="Back to boards">
        <Link to="/boards">
          <ArrowLeft />
        </Link>
      </Button>
      <div className="flex min-w-0 items-center gap-1">
        <BoardName board={board} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ViewOnlyToggle />
        <ConnectionBadge />
        <ThemeToggle />
      </div>
    </header>
  )
}

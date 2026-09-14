import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, FileDown, FolderOpen, PenLine, Unlink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BoardNameInput } from '@/components/layout/board-name'
import { linkBoardFile, unlinkBoardFile, useDesktopStorage } from '@/lib/autosave'
import { desktop } from '@/lib/desktop'
import { ConnectionBadge } from '@/components/layout/connection-badge'
import { ThemeToggle } from '@/components/layout/theme-toggle'
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
  const [editing, setEditing] = useState(false)
  if (editing) {
    return <BoardNameInput board={board} autoFocus onDone={() => setEditing(false)} className="w-72" />
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="hover:bg-accent flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium"
      title="Rename board"
    >
      <span className="truncate">{board.name}</span>
      <PenLine className="text-muted-foreground size-3 shrink-0" />
    </button>
  )
}

/** Desktop only: autosave state and an optional dedicated file for this board. */
function SaveStatus({ board }: { board: Board }) {
  const { info, error, ready } = useDesktopStorage()
  if (!desktop()) return null
  const linkedFile = info?.boardFiles[board.id]

  const link = async () => {
    try {
      if (await linkBoardFile(board)) toast.success('This board is now also saved to its own file')
    } catch (err) {
      toast.error('Could not use that file', { description: (err as Error).message })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className={error ? 'text-destructive' : 'text-muted-foreground'}>
          {error ? <AlertTriangle /> : <Check />}
          {error ? 'Save problem' : ready ? 'Autosaved' : 'Loading…'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="space-y-1">
          <span className="block">Saved to</span>
          <span className="text-muted-foreground block font-mono text-[11px] font-normal break-all">
            {info?.autosaveFile ?? '…'}
          </span>
          {linkedFile && (
            <span className="text-muted-foreground block font-mono text-[11px] font-normal break-all">
              + {linkedFile}
            </span>
          )}
          {error && <span className="text-destructive block text-xs font-normal">{error}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void link()}>
          <FileDown /> {linkedFile ? 'Move this board’s own file…' : 'Also save this board to a file…'}
        </DropdownMenuItem>
        {linkedFile && (
          <>
            <DropdownMenuItem onSelect={() => void desktop()?.revealBoardFile(board.id)}>
              <FolderOpen /> Show board file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void unlinkBoardFile(board.id)}>
              <Unlink /> Stop saving to that file
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => void desktop()?.revealAutosave()}>
          <FolderOpen /> Show project folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <SaveStatus board={board} />
        <ViewOnlyToggle />
        <ConnectionBadge />
        <ThemeToggle />
      </div>
    </header>
  )
}

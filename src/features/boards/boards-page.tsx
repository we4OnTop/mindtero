import {
  Clipboard,
  Copy,
  FileInput,
  History,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { ConnectionBadge } from '@/components/layout/connection-badge'
import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'
import { useShallow } from 'zustand/react/shallow'
import { BOARD_FILE_VERSION, downloadBlob } from '@/features/graph/export'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['application/json']

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}

function BoardCard({ board }: { board: Board }) {
  const navigate = useNavigate()
  const setActiveBoard = useBoards((state) => state.setActiveBoard)
  const deleteBoard = useBoards((state) => state.deleteBoard)
  const duplicateBoard = useBoards((state) => state.duplicateBoard)

  const open = () => {
    setActiveBoard(board.id)
    navigate(`/boards/${board.id}`)
  }

  const onDuplicate = () => {
    const id = duplicateBoard(board.id)
    if (id) toast.success('Board duplicated')
  }

  const onDelete = () => {
    if (!window.confirm(`Delete “${board.name}”? This cannot be undone.`)) return
    deleteBoard(board.id)
    toast.success('Board deleted')
  }

  const copyJson = () => {
    void navigator.clipboard.writeText(JSON.stringify(board, null, 2))
    toast.success('Board JSON copied')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          size="sm"
          onClick={open}
          className="cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-hidden"
          tabIndex={0}
          role="button"
          aria-label={`Open board ${board.name}`}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') open()
          }}
        >
          <CardHeader>
            <CardTitle className="truncate">{board.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'relative inline-flex size-1.5 shrink-0 rounded-full',
                  board.nodes.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                )}
              />
              {board.nodes.length} nodes · {board.edges.length} links ·{' '}
              {relativeTime(board.updatedAt)}
            </CardDescription>
          </CardHeader>
          <CardFooter className="text-xs">
            <Badge variant="secondary" className="pointer-events-none font-normal">
              Created {relativeTime(board.createdAt)}
            </Badge>
          </CardFooter>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={copyJson}>
          <Clipboard /> Copy JSON to clipboard
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy /> Duplicate board
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDelete} className="text-destructive">
          <Trash2 /> Delete board
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function useHiddenFileInput(onLoad: (board: Board) => void) {
  const parse = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as Board
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes)) {
          throw new Error('Not a Mindtero board file')
        }
        onLoad(parsed)
      } catch (error) {
        toast.error('Import failed', { description: (error as Error).message })
      }
    })
  }
  return { ACCEPTED_TYPES, parse }
}

/** One file holding every board, to restore a library overlay later. */
interface BackupFile {
  format: 'mindtero.backup'
  version: number
  exportedAt: string
  boards: Board[]
}

function exportBackup(): void {
  const state = useBoards.getState()
  const boards = state.order
    .map((id) => state.boards[id])
    .filter((board): board is Board => Boolean(board))
    .map((board) => ({ ...board, nodes: board.nodes }))
  if (boards.length === 0) {
    toast.info('Nothing to back up yet')
    return
  }
  const backup: BackupFile = {
    format: 'mindtero.backup',
    version: BOARD_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    boards,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `mindtero-backup-${stamp.slice(0, 10)}.json`,
  )
  toast.success('Backup created', { description: `${boards.length} board(s) exported` })
}

function BoardGallery() {
  const boards = useBoards(
    useShallow((state) =>
      state.order
        .map((id) => state.boards[id])
        .filter((board): board is Board => Boolean(board)),
    ),
  )
  const createBoard = useBoards((state) => state.createBoard)
  const importBoard = useBoards((state) => state.importBoard)
  const navigate = useNavigate()
  const { parse } = useHiddenFileInput((board) => {
    const id = importBoard({ ...board, viewport: board.viewport ?? { x: 0, y: 0, zoom: 1 } })
    toast.success('Board imported')
    navigate(`/boards/${id}`)
  })

  // The same file input accepts single board files *and* whole-backup files.
  const restoreAll = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as BackupFile | { format?: string }
        if ((parsed as BackupFile).format === 'mindtero.backup') {
          const backup = parsed as BackupFile
          if (!Array.isArray(backup.boards)) throw new Error('Backup contains no boards')
          const ids = backup.boards.map((board) =>
            importBoard({ ...board, viewport: board.viewport ?? { x: 0, y: 0, zoom: 1 } }),
          )
          toast.success('Backup restored', { description: `${ids.length} board(s) imported` })
          return
        }
        // Otherwise treat it like the plain JSON import.
        if (!parsed || typeof parsed !== 'object' || !('nodes' in (parsed as object))) {
          throw new Error('Not a Mindtero board file')
        }
        const id = importBoard(parsed as Board)
        navigate(`/boards/${id}`)
      } catch (error) {
        toast.error('Import failed', { description: (error as Error).message })
      }
    })
  }

  const create = () => {
    const id = createBoard()
    navigate(`/boards/${id}`)
  }

  return (
    <div className="bg-sidebar min-h-dvh">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Mindtero</h1>
            <p className="text-muted-foreground text-sm">
              Visual thinking layer for your local Zotero library.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <ThemeToggle />
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button onClick={create}>
            <Plus /> New board
          </Button>
          <Button variant="outline" asChild>
            <label className="[&>svg]:text-muted-foreground cursor-pointer">
              <FileInput /> Import JSON…
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                className="sr-only"
                onChange={parse}
              />
            </label>
          </Button>
          <Button variant="outline" onClick={exportBackup}>
            <Clipboard /> Backup (all boards)
          </Button>
          <Button variant="outline" asChild>
            <label className="[&>svg]:text-muted-foreground cursor-pointer">
              <History /> Restore backup…
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={restoreAll}
              />
            </label>
          </Button>
        </div>

        {boards.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            No boards yet — create one and drag Zotero items onto it.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BoardGallery

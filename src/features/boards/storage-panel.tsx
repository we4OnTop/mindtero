import { AlertTriangle, FolderOpen, FolderSearch, HardDrive, LifeBuoy, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  changeProjectDir,
  dismissRescue,
  restoreRescuedBoards,
  scanForRescuableBoards,
  useDesktopStorage,
} from '@/lib/autosave'
import { desktop } from '@/lib/desktop'
import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'
import { cn } from '@/lib/utils'

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function savedLabel(lastSavedAt: string | null, now: number): string {
  if (!lastSavedAt) return 'not saved yet this session'
  const seconds = Math.round((now - new Date(lastSavedAt).getTime()) / 1000)
  if (seconds < 10) return 'saved just now'
  if (seconds < 60) return `saved ${seconds}s ago`
  return `saved ${Math.round(seconds / 60)}m ago`
}

/** Desktop only: where boards are written, and a way to move that folder. */
export function StoragePanel() {
  const { info, lastSavedAt, error, ready } = useDesktopStorage()
  const now = useNow(15_000)
  const [scanning, setScanning] = useState(false)
  if (!desktop()) return null

  const choose = async (reset = false) => {
    try {
      if (await changeProjectDir(reset)) toast.success('Project folder updated')
    } catch (err) {
      toast.error('Could not use that folder', { description: (err as Error).message })
    }
  }

  const scan = async () => {
    setScanning(true)
    try {
      const { scanned, found } = await scanForRescuableBoards()
      if (found === 0) {
        toast.info('Nothing to recover', {
          description: `${scanned} earlier session(s) checked — every board is already here.`,
        })
      }
    } catch (err) {
      toast.error('Recovery scan failed', { description: (err as Error).message })
    } finally {
      setScanning(false)
    }
  }

  return (
    <section
      className={cn(
        'bg-card mb-6 space-y-2 rounded-xl border p-4 text-sm',
        error && 'border-destructive/50',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <HardDrive className="text-muted-foreground size-4" />
        <span className="font-medium">Autosave</span>
        <span className="text-muted-foreground text-xs">
          {ready ? savedLabel(lastSavedAt, now) : 'loading project file…'}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => void choose()}>
            <FolderSearch /> Change folder…
          </Button>
          {info && !info.isDefault && (
            <Button size="sm" variant="ghost" onClick={() => void choose(true)}>
              <RotateCcw /> Default folder
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void desktop()?.revealAutosave()}>
            <FolderOpen /> Show
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void scan()} disabled={scanning}>
            <LifeBuoy /> {scanning ? 'Scanning…' : 'Recover old boards'}
          </Button>
        </div>
      </div>
      {info && (
        <p className="text-muted-foreground font-mono text-xs break-all" title={info.autosaveFile}>
          {info.autosaveFile}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Every change is written to this file. Older versions are kept in its{' '}
        <code>backups</code> folder. Single boards can additionally be saved to their own file
        from the board&apos;s top bar.
      </p>
      {error && (
        <p className="text-destructive flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}
    </section>
  )
}

/** Offers boards found in earlier app sessions (see electron/rescue.cjs). */
export function RescueDialog() {
  const candidates = useDesktopStorage((state) => state.rescueCandidates)
  if (!candidates?.length) return null
  // Keyed by the scan result, so every new scan starts with all boards ticked.
  return <RescueDialogContent key={candidates.map((board) => board.id).join()} candidates={candidates} />
}

function RescueDialogContent({ candidates }: { candidates: Board[] }) {
  const localBoards = useBoards((state) => state.boards)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((board) => board.id)))

  const restore = () => {
    const count = restoreRescuedBoards([...picked])
    toast.success(`${count} board(s) recovered`)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && dismissRescue()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Boards from earlier sessions found</DialogTitle>
          <DialogDescription>
            Earlier versions of Mindtero kept boards in storage that a restart could no longer
            reach. These are not in your current workspace (or are newer there). Nothing is
            deleted if you skip this — you can scan again any time.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {candidates.map((board) => {
            const checked = picked.has(board.id)
            return (
              <li key={board.id}>
                <label
                  className={cn(
                    'hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2',
                    checked && 'border-border bg-accent',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="accent-primary mt-1 size-3.5"
                    onChange={() =>
                      setPicked((previous) => {
                        const next = new Set(previous)
                        if (next.has(board.id)) next.delete(board.id)
                        else next.add(board.id)
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{board.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {board.nodes.length} nodes · {board.edges.length} links · last edited{' '}
                      {new Date(board.updatedAt).toLocaleString()}
                      {localBoards[board.id] && ' · newer than your copy'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={dismissRescue}>
            Not now
          </Button>
          <Button onClick={restore} disabled={picked.size === 0}>
            Recover {picked.size} board(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

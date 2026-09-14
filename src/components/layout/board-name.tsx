import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useBoards } from '@/features/graph/store'
import type { Board } from '@/features/graph/types'
import { cn } from '@/lib/utils'

/**
 * Inline rename field. Replaces `window.prompt`, which Electron does not
 * implement (it returns nothing), so renaming silently did nothing on desktop.
 */
export function BoardNameInput({
  board,
  onDone,
  autoFocus,
  className,
}: {
  board: Board
  onDone: () => void
  autoFocus?: boolean
  className?: string
}) {
  const updateBoardMeta = useBoards((state) => state.updateBoardMeta)
  const [value, setValue] = useState(board.name)
  // Escape unmounts the field, which can still fire a blur; that must not save.
  const cancelled = useRef(false)

  const commit = () => {
    if (cancelled.current) return
    const next = value.trim()
    if (next && next !== board.name) {
      updateBoardMeta(board.id, { name: next })
      toast.success('Board renamed')
    }
    onDone()
  }

  return (
    <input
      value={value}
      autoFocus={autoFocus}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      // The field sits inside clickable cards; keep its events to itself.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          onDone()
        }
      }}
      aria-label="Board name"
      maxLength={120}
      className={cn(
        'border-input focus-visible:ring-ring/50 bg-background min-w-0 rounded-md border px-2 py-1 text-sm font-medium outline-none focus-visible:ring-3',
        className,
      )}
    />
  )
}

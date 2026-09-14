import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Scale, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { CLAIM_STATUS, useClaimCounts } from '../claim-status'
import { useBoards } from '../store'
import type { ClaimNode } from '../types'
import { EdgeZones } from './handles'
import { NodeTags } from './node-tags'
import { WidthResizer } from './width-resizer'

/**
 * A statement the thesis makes, with a live tally of what backs and what
 * challenges it. Link quotes and sources with "Supports" / "Contradicts" lines.
 */
function ClaimNodeComponent({ id, data, selected }: NodeProps<ClaimNode>) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const [editing, setEditing] = useState(!data.text && !viewOnly)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { supporting, contradicting, status } = useClaimCounts(id)
  const style = CLAIM_STATUS[status]
  const total = supporting + contradicting

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  return (
    <>
      <WidthResizer visible={selected && !viewOnly} minWidth={200} onResizeStart={commit} />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <Button size="icon-xs" variant="ghost" disabled={viewOnly} onClick={() => removeNodes([id])} aria-label="Delete claim">
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'bg-card text-card-foreground relative w-full overflow-hidden rounded-xl border-2 py-2.5 pr-3 pl-4 shadow-sm',
          selected && 'ring-primary/60 ring-2',
        )}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (!viewOnly) setEditing(true)
        }}
      >
        <span className={cn('absolute inset-y-0 left-0 w-1.5', style.bar)} aria-hidden />
        <div className="mb-1 flex items-center gap-1.5">
          <Scale className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">Claim</span>
          <span className={cn('ml-auto rounded-full px-1.5 py-px text-[10px] font-medium', style.pill)}>{style.label}</span>
        </div>

        {editing ? (
          <textarea
            ref={textareaRef}
            value={data.text}
            onChange={(event) => updateNodeData(id, { text: event.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setEditing(false)
              }
            }}
            placeholder="What does your thesis claim?"
            className="mindtero-autogrow nodrag nowheel placeholder:text-muted-foreground/70 min-h-10 w-full resize-none bg-transparent text-sm leading-snug font-medium outline-none"
          />
        ) : (
          <p className="mindtero-note-text text-sm leading-snug font-medium">
            {data.text || <span className="text-muted-foreground/70 font-normal">Double-click to state the claim…</span>}
          </p>
        )}

        <div className="mt-2 space-y-1">
          <div className="bg-muted flex h-1.5 overflow-hidden rounded-full" aria-hidden>
            {total > 0 && (
              <>
                <span className="bg-[var(--rel-supports)]" style={{ width: `${(supporting / total) * 100}%` }} />
                <span className="bg-[var(--rel-contradicts)]" style={{ width: `${(contradicting / total) * 100}%` }} />
              </>
            )}
          </div>
          <p className="text-muted-foreground text-[11px] tabular-nums">
            {total === 0
              ? 'Link sources with a “Supports” or “Contradicts” line'
              : `${supporting} supporting · ${contradicting} contradicting`}
          </p>
        </div>
        <NodeTags id={id} own={data.tags} />
      </div>

      <EdgeZones />
    </>
  )
}

export const ClaimNodeView = memo(ClaimNodeComponent)

import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Quote, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { accentClasses } from '../accents'
import { useBoards } from '../store'
import type { NoteNode } from '../types'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'

function NoteNodeComponent({ id, data, selected }: NodeProps<NoteNode>) {
  const accents = accentClasses(data.accent ?? 'amber')
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const viewOnly = useSettings((state) => state.viewOnly)
  const [editing, setEditing] = useState(!data.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={96}
        lineClassName="!border-primary/40"
        handleClassName="!size-2 !rounded-sm !bg-primary !border-none"
      />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Note colour">
                <span className={cn('size-3 rounded-full', accents.dot)} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <AccentMenuItems
                value={data.accent}
                onSelect={(accent) => updateNodeData(id, { accent })}
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={viewOnly}
            onClick={() => removeNodes([id])}
            aria-label="Delete note"
          >
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'flex h-full min-h-[96px] w-full flex-col rounded-xl border p-3 shadow-sm transition-shadow',
          accents.soft,
          selected && 'ring-primary/60 ring-2',
        )}
        onDoubleClick={() => setEditing(true)}
      >
        {(data.sourceTitle ?? data.page) && !editing && (
          <p className="text-muted-foreground/80 mb-1.5 flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
            <Quote className="size-3" />
            {data.page ? `p. ${data.page}` : ''} {data.sourceTitle ? `· ${data.sourceTitle}` : ''}
          </p>
        )}
        {editing ? (
          <textarea
            ref={textareaRef}
            value={data.text}
            onChange={(event) => updateNodeData(id, { text: event.target.value })}
            onBlur={() => setEditing(false)}
            placeholder="Your thought…"
            // nodrag/nowheel keep React Flow from hijacking pointer and scroll events.
            className="nodrag nowheel placeholder:text-muted-foreground/70 h-full w-full resize-none bg-transparent text-sm leading-snug outline-none"
          />
        ) : (
          <p className="mindtero-note-text text-sm leading-snug">
            {data.text || <span className="text-muted-foreground/70">Double-click to write…</span>}
          </p>
        )}
      </div>

      <EdgeZones />
    </>
  )
}

export const NoteNodeView = memo(NoteNodeComponent)

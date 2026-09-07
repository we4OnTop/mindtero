import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Hash, Trash2 } from 'lucide-react'
import { memo } from 'react'
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
import type { FrameNode } from '../types'
import { AccentMenuItems } from './accent-menu'

/**
 * A background region used to cluster cards visually. It is deliberately *not* a
 * React Flow parent node: dragging a frame should not drag its contents, because
 * membership here is a reading aid rather than a data relationship.
 */
function FrameNodeComponent({ id, data, selected }: NodeProps<FrameNode>) {
  const accents = accentClasses(data.accent)
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const viewOnly = useSettings((state) => state.viewOnly)

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={160}
        lineClassName="!border-primary/40"
        handleClassName="!size-2 !rounded-sm !bg-primary !border-none"
      />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Frame colour">
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
            aria-label="Delete frame"
          >
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'h-full w-full rounded-2xl border-2 border-dashed',
          accents.soft,
          selected ? 'border-primary/50' : 'border-border',
        )}
      >
        <div className="flex items-start gap-2 px-4 pt-3">
          <input
            value={data.label}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
            aria-label="Frame title"
            className="nodrag text-muted-foreground min-w-0 flex-1 truncate bg-transparent text-xs font-semibold tracking-wide uppercase outline-none"
          />
          {data.tag && (
            <span className="text-muted-foreground/80 bg-background/70 nodrag inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
              <Hash className="size-3" />
              {data.tag}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export const FrameNodeView = memo(FrameNodeComponent)

import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Crosshair, HelpCircle, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { isEvidence, questionScope } from '../argument'
import { useCanvasUi } from '../canvas-ui'
import { useBoards } from '../store'
import type { QuestionNode } from '../types'
import { EdgeZones } from './handles'
import { NodeTags } from './node-tags'
import { WidthResizer } from './width-resizer'

/** Claims and sources anchored to a question, re-read whenever the board changes. */
function useQuestionCounts(id: string): { claims: number; sources: number } {
  const [claims, sources] = useBoards(
    useShallow((state) => {
      const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
      if (!board) return [0, 0] as const
      const scope = questionScope(id, board.nodes, board.edges)
      const members = board.nodes.filter((node) => scope.has(node.id))
      return [members.filter((node) => node.type === 'claim').length, members.filter(isEvidence).length] as const
    }),
  )
  return { claims, sources }
}

/**
 * A research question as an anchor: whatever is connected to it — directly or
 * through claims and groups — belongs to it, and "Focus" shows only that.
 */
function QuestionNodeComponent({ id, data, selected }: NodeProps<QuestionNode>) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const focused = useCanvasUi((state) => state.focusQuestion === id)
  const setFocusQuestion = useCanvasUi((state) => state.setFocusQuestion)
  const [editing, setEditing] = useState(!data.text && !viewOnly)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { claims, sources } = useQuestionCounts(id)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  return (
    <>
      <WidthResizer visible={selected && !viewOnly} minWidth={220} onResizeStart={commit} />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <Button size="icon-xs" variant="ghost" disabled={viewOnly} onClick={() => removeNodes([id])} aria-label="Delete question">
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'w-full rounded-xl border-2 border-sky-500/50 bg-sky-500/8 px-3 py-2.5 shadow-sm dark:bg-sky-500/10',
          selected && 'ring-primary/60 ring-2',
          focused && 'border-sky-500',
        )}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (!viewOnly) setEditing(true)
        }}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <HelpCircle className="size-4 text-sky-600 dark:text-sky-400" />
          <input
            value={data.code}
            readOnly={viewOnly}
            onChange={(event) => updateNodeData(id, { code: event.target.value.slice(0, 12) })}
            aria-label="Question code"
            className="nodrag w-16 bg-transparent text-xs font-bold tracking-wide text-sky-700 uppercase outline-none dark:text-sky-300"
          />
          <Button
            size="xs"
            variant={focused ? 'secondary' : 'ghost'}
            className="nodrag ml-auto"
            onClick={() => setFocusQuestion(focused ? null : id)}
            title={focused ? 'Show the whole board again' : 'Show only what belongs to this question'}
          >
            <Crosshair /> {focused ? 'Focused' : 'Focus'}
          </Button>
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
            placeholder="Which question does your research answer?"
            className="mindtero-autogrow nodrag nowheel placeholder:text-muted-foreground/70 min-h-10 w-full resize-none bg-transparent text-[15px] leading-snug font-semibold outline-none"
          />
        ) : (
          <p className="mindtero-note-text text-[15px] leading-snug font-semibold">
            {data.text || <span className="text-muted-foreground/70 font-normal">Double-click to write the question…</span>}
          </p>
        )}

        <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
          {claims} claim{claims === 1 ? '' : 's'} · {sources} source{sources === 1 ? '' : 's'} anchored — connect claims to this card
        </p>
        <NodeTags id={id} own={data.tags} />
      </div>

      <EdgeZones />
    </>
  )
}

export const QuestionNodeView = memo(QuestionNodeComponent)

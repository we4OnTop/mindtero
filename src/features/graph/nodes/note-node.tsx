import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { BookOpen, ExternalLink, Quote, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openExternal } from '@/lib/desktop'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { accentClasses } from '../accents'
import { quoteOpenPdfUrl } from '../quote-parse'
import { useBoards } from '../store'
import type { NoteNode, NoteNodeData } from '../types'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'
import { NodeTags } from './node-tags'
import { WidthResizer } from './width-resizer'

const ITEM_KEY = /^[A-Z0-9]{8}$/
const SCOPE = /^(library|groups\/\d+)$/

function zoteroSelectLink(data: NoteNodeData): string | null {
  if (!data.itemKey || !ITEM_KEY.test(data.itemKey)) return null
  const scope = data.libraryScope && SCOPE.test(data.libraryScope) ? data.libraryScope : 'library'
  return `zotero://select/${scope}/items/${data.itemKey}`
}

function NoteNodeComponent({ id, data, selected }: NodeProps<NoteNode>) {
  const accents = accentClasses(data.accent ?? 'amber')
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const [editing, setEditing] = useState(!data.text && !viewOnly)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const pdfUrl = quoteOpenPdfUrl(data)
  const selectUrl = zoteroSelectLink(data)
  const isQuote = Boolean(data.sourceTitle ?? data.page ?? data.citation)

  return (
    <>
      <WidthResizer visible={selected && !viewOnly} minWidth={160} onResizeStart={commit} />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          {pdfUrl && (
            <Button size="xs" variant="ghost" onClick={() => openExternal(pdfUrl)}>
              <BookOpen /> Open PDF{data.pdfPage ? ` p. ${data.pdfPage}` : ''}
            </Button>
          )}
          {selectUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-xs" variant="ghost" aria-label="Show source in Zotero" onClick={() => openExternal(selectUrl)}>
                  <ExternalLink />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show the source in Zotero</TooltipContent>
            </Tooltip>
          )}
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
          'flex min-h-[72px] w-full flex-col rounded-xl border p-3 shadow-sm transition-shadow',
          accents.soft,
          selected && 'ring-primary/60 ring-2',
        )}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (!viewOnly) setEditing(true)
        }}
      >
        {isQuote && !editing && (
          <p className="text-muted-foreground/80 mb-1.5 flex items-start gap-1 text-[10px] font-medium tracking-wide uppercase">
            <Quote className="mt-px size-3 shrink-0" />
            <span className="min-w-0">
              {data.citation ?? [data.page ? `p. ${data.page}` : '', data.sourceTitle].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
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
            placeholder="Your thought…"
            // nodrag/nowheel keep React Flow from hijacking pointer and scroll events.
            className="mindtero-autogrow nodrag nowheel placeholder:text-muted-foreground/70 min-h-12 w-full resize-none bg-transparent text-sm leading-snug outline-none"
          />
        ) : (
          <p className="mindtero-note-text text-sm leading-snug">
            {data.text || <span className="text-muted-foreground/70">Double-click to write…</span>}
          </p>
        )}
        {isQuote && !editing && data.citation && data.sourceTitle && (
          <p className="text-muted-foreground mt-1.5 truncate text-[11px]">{data.sourceTitle}</p>
        )}
        {!editing && <NodeTags id={id} own={data.tags} />}
      </div>

      <EdgeZones />
    </>
  )
}

export const NoteNodeView = memo(NoteNodeComponent)

import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { GanttChart, Link2, LocateFixed, Trash2, Unlink, X } from 'lucide-react'
import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { accentClasses } from '../accents'
import { useCanvasUi } from '../canvas-ui'
import { useBoards } from '../store'
import {
  dragEntry,
  spanPercent,
  timelineAxis,
  timelineRows,
  yearCoverage,
  yearPercent,
  type Period,
  type TimelineRow,
} from '../timeline'
import { canLinkToTimeline, linkToTimeline } from '../timeline-links'
import type { Accent, TimelineNode } from '../types'
import { useFocusNode } from '../use-focus-node'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'
import { WidthResizer } from './width-resizer'
import { YearInput } from './year-input'

const LABEL_COLUMN = 'w-48 shrink-0'

/** Gantt rows for one timeline, recomputed only when their content changes. */
function useTimelineRows(id: string): TimelineRow[] {
  // The selector returns a string so unrelated board edits (dragging other cards)
  // do not re-render the chart.
  const json = useBoards((state) => {
    const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
    const timeline = board?.nodes.find((node) => node.id === id)
    if (!board || timeline?.type !== 'timeline') return '[]'
    return JSON.stringify(timelineRows(id, board.nodes, board.edges, timeline.data.entries))
  })
  return useMemo(() => JSON.parse(json) as TimelineRow[], [json])
}

/**
 * A Gantt chart of the research periods sources cover. Draw a line from the
 * timeline to a source card (or drop library items onto it); the period lives on
 * that line and is edited by dragging the bar or in the line's inspector.
 * Hovering a bar lights up its card, hovering a card lights up its bar.
 */
function TimelineNodeComponent({ id, data, selected }: NodeProps<TimelineNode>) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const updateEdgeData = useBoards((state) => state.updateEdgeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const removeEdges = useBoards((state) => state.removeEdges)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const setHighlight = useCanvasUi((state) => state.setHighlight)
  const hoverNodeId = useCanvasUi((state) => state.hoverNodeId)
  const focusNode = useFocusNode()
  const [openRow, setOpenRow] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ row: TimelineRow; grip: 'start' | 'end' | 'body'; x: number; last: Period } | null>(null)

  const rows = useTimelineRows(id)
  // While a bar is dragged the axis stays put; otherwise stretching a bar past the
  // edge would rescale the chart under the pointer.
  const [frozenAxis, setFrozenAxis] = useState<Period | null>(null)
  const axis = timelineAxis({ from: frozenAxis?.from ?? data.from, to: frozenAxis?.to ?? data.to, entries: rows })
  const coverage = yearCoverage(rows, axis)
  const maxCoverage = Math.max(1, ...coverage)

  const setPeriod = (row: TimelineRow, period: Period) => {
    if (row.kind === 'link' && row.edgeId) updateEdgeData(row.edgeId, { period })
    else if (row.entryId) {
      updateNodeData(id, {
        entries: data.entries.map((entry) => (entry.id === row.entryId ? { ...entry, ...period } : entry)),
      })
    }
  }

  const setRowField = (row: TimelineRow, patch: { note?: string; accent?: Accent }) => {
    if (row.kind === 'link' && row.edgeId) updateEdgeData(row.edgeId, patch)
    else if (row.entryId) {
      updateNodeData(id, {
        entries: data.entries.map((entry) => (entry.id === row.entryId ? { ...entry, ...patch } : entry)),
      })
    }
  }

  const removeRow = (row: TimelineRow) => {
    if (row.kind === 'link' && row.edgeId) removeEdges([row.edgeId])
    else {
      commit()
      updateNodeData(id, { entries: data.entries.filter((entry) => entry.id !== row.entryId) })
    }
    setOpenRow(null)
    setHighlight(null)
  }

  const linkSelected = () => {
    const board = useBoards.getState()
    const nodes = board.activeBoardId ? (board.boards[board.activeBoardId]?.nodes ?? []) : []
    const cards = nodes.filter((node) => node.selected && node.id !== id && canLinkToTimeline(node))
    if (cards.length === 0) {
      toast.info('Select source cards first', {
        description: 'Ctrl+click cards and the timeline — or simply draw a line from the timeline to a card.',
      })
      return
    }
    commit()
    const linked = linkToTimeline(id, cards)
    if (linked === 0) toast.info('Those cards are already on this timeline')
  }

  const onGripDown = (event: ReactPointerEvent, row: TimelineRow, grip: 'start' | 'end' | 'body') => {
    if (viewOnly || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    commit()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { row, grip, x: event.clientX, last: { from: row.from, to: row.to } }
    setFrozenAxis({ from: axis.from, to: axis.to })
  }

  const onGripMove = (event: ReactPointerEvent) => {
    const current = drag.current
    const track = trackRef.current
    if (!current || !track) return
    // Track width is in screen pixels, so the canvas zoom is already accounted for.
    const yearsPerPixel = axis.span / track.getBoundingClientRect().width
    const next = dragEntry(current.row, current.grip, (event.clientX - current.x) * yearsPerPixel)
    if (next.from === current.last.from && next.to === current.last.to) return
    current.last = next
    setPeriod(current.row, next)
  }

  const onGripUp = (event: ReactPointerEvent) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    drag.current = null
    setFrozenAxis(null)
  }

  const grid = (
    <>
      {axis.ticks.map((year) => (
        <span
          key={year}
          className="bg-border absolute inset-y-0 w-px"
          style={{ left: `${((year - axis.from) / axis.span) * 100}%` }}
          aria-hidden
        />
      ))}
    </>
  )

  return (
    <>
      <WidthResizer visible={selected && !viewOnly} minWidth={520} maxWidth={2400} onResizeStart={commit} />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-1 rounded-lg border p-1 shadow-md">
          <Button size="xs" variant="ghost" disabled={viewOnly} onClick={linkSelected}>
            <Link2 /> Link selected cards
          </Button>
          <span className="text-muted-foreground px-1 text-xs">Axis</span>
          <YearInput
            key={`from-${data.from}`}
            label="Axis start"
            value={data.from}
            placeholder={String(axis.from)}
            disabled={viewOnly}
            onChange={(from) => updateNodeData(id, { from })}
          />
          <span className="text-muted-foreground text-xs">–</span>
          <YearInput
            key={`to-${data.to}`}
            label="Axis end"
            value={data.to}
            placeholder={String(axis.to)}
            disabled={viewOnly}
            onChange={(to) => updateNodeData(id, { to })}
          />
          <Button size="icon-xs" variant="ghost" disabled={viewOnly} onClick={() => removeNodes([id])} aria-label="Delete timeline">
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div className={cn('bg-card text-card-foreground w-full rounded-xl border shadow-sm', selected && 'ring-primary/60 ring-2')}>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <GanttChart className="text-muted-foreground size-4 shrink-0" />
          <input
            value={data.label}
            readOnly={viewOnly}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
            aria-label="Timeline title"
            className="nodrag min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {rows.length} source{rows.length === 1 ? '' : 's'} · {axis.from}–{axis.to}
          </span>
        </div>

        <div className="px-3 pt-2 pb-3">
          {/* Year axis */}
          <div className="flex items-end gap-2">
            <div className={cn(LABEL_COLUMN, 'text-muted-foreground text-[10px]')}>Source</div>
            <div className="text-muted-foreground relative h-4 flex-1 text-[10px] tabular-nums">
              {axis.ticks.map((year) => (
                <span key={year} className="absolute -translate-x-1/2" style={{ left: `${yearPercent(axis, year)}%` }}>
                  {year}
                </span>
              ))}
            </div>
          </div>

          {/* Coverage: how many sources look at each year */}
          {rows.length > 0 && (
            <div className="mt-1 flex items-end gap-2">
              <div className={cn(LABEL_COLUMN, 'text-muted-foreground text-[10px]')}>Sources per year</div>
              <div className="relative flex h-6 flex-1 items-end">
                {coverage.map((count, index) => (
                  <Tooltip key={axis.from + index}>
                    <TooltipTrigger asChild>
                      <span
                        className="nodrag mx-px block flex-1 rounded-t-sm bg-sky-500/70 transition-colors hover:bg-sky-500"
                        style={{ height: count ? `${Math.max(12, (count / maxCoverage) * 100)}%` : '2px', opacity: count ? 1 : 0.25 }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {axis.from + index}: {count} source{count === 1 ? '' : 's'}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <p className="text-muted-foreground mt-2 rounded-lg border border-dashed p-4 text-center text-xs">
              Draw a line from this timeline to a book, paper or quote — or drop library items here. Each
              source gets a bar; drag its ends to the years of research it covers.
            </p>
          )}

          <ul className="mt-1.5 space-y-0.5">
            {rows.map((row, index) => {
              const accents = accentClasses(row.accent ?? 'violet')
              const bar = spanPercent(axis, row.from, row.to)
              const published = Number.parseInt(row.year ?? '', 10)
              const expanded = openRow === row.key
              const lit = Boolean(row.nodeId && row.nodeId === hoverNodeId)
              return (
                <li
                  key={row.key}
                  onMouseEnter={() => row.nodeId && setHighlight({ nodeId: row.nodeId, edgeId: row.edgeId })}
                  onMouseLeave={() => setHighlight(null)}
                  className={cn('rounded-md transition-colors', (lit || expanded) && 'bg-primary/10')}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenRow(expanded ? null : row.key)}
                      className={cn(LABEL_COLUMN, 'nodrag hover:bg-muted min-w-0 rounded px-1 py-0.5 text-left')}
                      title={row.title}
                    >
                      <span className="block truncate text-xs font-medium">{row.title}</span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {[row.subtitle, row.kind === 'entry' ? 'not linked' : undefined].filter(Boolean).join(' · ') || ' '}
                      </span>
                    </button>
                    <div
                      ref={index === 0 ? trackRef : undefined}
                      className="nodrag nowheel relative h-7 flex-1"
                      // Captured pointer events from the grips bubble up to here.
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                    >
                      {grid}
                      <div
                        role="slider"
                        aria-label={`${row.title}: ${row.from} to ${row.to}`}
                        aria-valuemin={axis.from}
                        aria-valuemax={axis.to}
                        aria-valuenow={row.from}
                        className={cn(
                          'absolute inset-y-1 flex items-center overflow-hidden rounded-md px-1.5 text-white shadow-sm',
                          accents.bar,
                          lit && 'ring-primary ring-2',
                          !viewOnly && 'cursor-grab active:cursor-grabbing',
                        )}
                        style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                        onPointerDown={(event) => onGripDown(event, row, 'body')}
                      >
                        <span className="pointer-events-none truncate text-[10px] font-medium tabular-nums">
                          {row.from === row.to ? row.from : `${row.from}–${row.to}`}
                        </span>
                        {!viewOnly && (
                          <>
                            <span
                              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                              onPointerDown={(event) => onGripDown(event, row, 'start')}
                            />
                            <span
                              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                              onPointerDown={(event) => onGripDown(event, row, 'end')}
                            />
                          </>
                        )}
                      </div>
                      {Number.isFinite(published) && published >= axis.from && published <= axis.to && (
                        <span
                          // Hollow ring so the marker stays visible on top of the bar.
                          className="bg-card ring-foreground/80 pointer-events-none absolute top-1/2 size-2.5 -translate-1/2 rounded-full ring-2"
                          style={{ left: `${yearPercent(axis, published)}%` }}
                          title={`Published ${published}`}
                        />
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="nodrag bg-muted/40 mx-1 mt-1 mb-2 flex flex-wrap items-center gap-2 rounded-lg p-2 text-xs">
                      <span className="text-muted-foreground">Covers</span>
                      <YearInput
                        key={`from-${row.from}`}
                        label="Period start"
                        value={row.from}
                        disabled={viewOnly}
                        onChange={(from) => {
                          if (from === undefined) return
                          commit()
                          setPeriod(row, { from: Math.min(from, row.to), to: row.to })
                        }}
                      />
                      <span className="text-muted-foreground">–</span>
                      <YearInput
                        key={`to-${row.to}`}
                        label="Period end"
                        value={row.to}
                        disabled={viewOnly}
                        onChange={(to) => {
                          if (to === undefined) return
                          commit()
                          setPeriod(row, { from: row.from, to: Math.max(to, row.from) })
                        }}
                      />
                      <input
                        value={row.note ?? ''}
                        readOnly={viewOnly}
                        onChange={(event) => setRowField(row, { note: event.target.value || undefined })}
                        placeholder="e.g. “reviews studies 2015–2024”"
                        className="border-input bg-background h-6 min-w-40 flex-1 rounded-md border px-2 outline-none"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-xs" variant="ghost" aria-label="Bar colour">
                            <span className={cn('size-3 rounded-full', accents.dot)} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <AccentMenuItems value={row.accent} onSelect={(accent) => setRowField(row, { accent })} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {row.nodeId && (
                        <Button size="icon-xs" variant="ghost" aria-label="Show the source card" onClick={() => focusNode(row.nodeId!)}>
                          <LocateFixed />
                        </Button>
                      )}
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={viewOnly}
                        aria-label={row.kind === 'link' ? 'Remove the line to this source' : 'Remove from timeline'}
                        title={row.kind === 'link' ? 'Remove from the timeline (the card stays on the board)' : 'Remove'}
                        onClick={() => removeRow(row)}
                      >
                        {row.kind === 'link' ? <Unlink /> : <X />}
                      </Button>
                    </div>
                  )}
                  {!expanded && row.note && (
                    <p className="text-muted-foreground ml-[12.5rem] truncate pb-0.5 text-[10px] italic">{row.note}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <EdgeZones />
    </>
  )
}

export const TimelineNodeView = memo(TimelineNodeComponent)

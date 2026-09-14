import { GanttChart } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/lib/settings'
import { YearInput } from '../nodes/year-input'
import { useActiveBoard, useBoards } from '../store'
import { defaultPeriod, publicationYear } from '../timeline'
import type { MindEdge } from '../types'

/**
 * For a line between a research timeline and a source: the years of research the
 * source covers. This is the same period the Gantt bar shows.
 */
export function PeriodEditor({ edge }: { edge: MindEdge }) {
  const board = useActiveBoard()
  const updateEdgeData = useBoards((state) => state.updateEdgeData)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const byId = new Map((board?.nodes ?? []).map((node) => [node.id, node]))
  const source = byId.get(edge.source)
  const target = byId.get(edge.target)
  const timeline = source?.type === 'timeline' ? source : target?.type === 'timeline' ? target : undefined
  if (!timeline && !edge.data?.period) return null

  const other = timeline === source ? target : source
  const period = edge.data?.period ?? defaultPeriod(other ? publicationYear(other, byId) : undefined)
  const setPeriod = (from: number, to: number) => {
    commit()
    updateEdgeData(edge.id, { period: { from: Math.min(from, to), to: Math.max(from, to) } })
  }

  return (
    <div className="bg-muted/40 space-y-2 rounded-lg p-3">
      <Label className="flex items-center gap-1.5 text-xs">
        <GanttChart className="size-3.5" /> Research period this source covers
      </Label>
      <div className="flex items-center gap-2 text-xs">
        <YearInput
          key={`from-${period.from}`}
          label="Period start"
          value={period.from}
          disabled={viewOnly}
          onChange={(from) => from !== undefined && setPeriod(from, period.to)}
        />
        <span className="text-muted-foreground">to</span>
        <YearInput
          key={`to-${period.to}`}
          label="Period end"
          value={period.to}
          disabled={viewOnly}
          onChange={(to) => to !== undefined && setPeriod(period.from, to)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Shown as the bar on {timeline?.type === 'timeline' ? `“${timeline.data.label}”` : 'the timeline'} — you can
        also drag the bar’s ends there.
      </p>
    </div>
  )
}

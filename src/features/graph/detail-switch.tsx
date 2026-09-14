import { Boxes, LayoutDashboard, SquareDashed } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCanvasUi } from './canvas-ui'
import { DETAIL_LABELS, DETAIL_LEVELS, type DetailLevel } from './groups'

const ICONS: Record<DetailLevel, ReactNode> = {
  groups: <SquareDashed />,
  contents: <Boxes />,
  all: <LayoutDashboard />,
}

const HINTS: Record<DetailLevel, string> = {
  groups: 'Only group frames, with thick lines summarising how their contents connect. Dragging a group moves its contents.',
  contents: 'Groups and what is inside them; loose cards are hidden.',
  all: 'Every card and connection.',
}

/** Zoom-out-to-think: switch between groups only, their contents, or everything. */
export function DetailSwitch() {
  const detail = useCanvasUi((state) => state.detail)
  const setDetail = useCanvasUi((state) => state.setDetail)

  return (
    <div
      role="radiogroup"
      aria-label="Detail level"
      className="bg-card/95 flex items-center gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur"
    >
      {DETAIL_LEVELS.map((level) => (
        <Tooltip key={level}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={detail === level}
              onClick={() => setDetail(level)}
              className={cn(
                'text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
                detail === level && 'bg-secondary text-foreground',
              )}
            >
              {ICONS[level]}
              {/* Only the active level is spelled out; the others explain themselves on hover. */}
              {detail === level ? DETAIL_LABELS[level] : <span className="sr-only">{DETAIL_LABELS[level]}</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <span className="font-medium">{DETAIL_LABELS[level]}</span> — {HINTS[level]}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

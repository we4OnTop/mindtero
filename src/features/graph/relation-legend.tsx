import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { RELATIONS, RELATION_KINDS } from './relations'

/**
 * Always-present legend. Relation colours sit close together on a dense canvas, so
 * the dash pattern, arrowhead and written name carry the identity as much as hue does.
 */
export function RelationLegend() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card/95 w-56 rounded-xl border shadow-sm backdrop-blur">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-3">
            <span className="text-muted-foreground text-xs font-medium">Relation types</span>
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-2 px-3 pt-1 pb-3">
            {RELATION_KINDS.map((kind) => {
              const spec = RELATIONS[kind]
              return (
                <li key={kind} className="flex items-center gap-2">
                  <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden className="shrink-0">
                    <line
                      x1="1"
                      y1="5"
                      x2={spec.marker === 'none' ? 33 : 27}
                      y2="5"
                      stroke={spec.color}
                      strokeWidth={spec.strokeWidth}
                      strokeDasharray={spec.dash || undefined}
                      strokeLinecap="round"
                    />
                    {spec.marker !== 'none' && (
                      <path
                        d="M 27 1.5 L 33 5 L 27 8.5 z"
                        fill={spec.marker === 'arrowclosed' ? spec.color : 'none'}
                        stroke={spec.color}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <span className="text-xs">{spec.label}</span>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

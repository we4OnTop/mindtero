import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ExternalLink, MessageSquareText, Sparkles, Trash2 } from 'lucide-react'
import { memo, useState } from 'react'
import { toast } from 'sonner'
import { ItemTypeIcon } from '@/components/common/item-type-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { itemTypeLabel, zoteroSelectUrl } from '@/features/zotero/format'
import { useZoteroSource } from '@/features/zotero/provider'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { accentClasses } from '../accents'
import { EXPANSIONS, useExpandNode, type ExpansionKind } from '../expand'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'
import { useBoards } from '../store'
import type { ItemNode } from '../types'

function ItemNodeComponent({
  id,
  data,
  selected,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<ItemNode>) {
  const { snapshot, accent, collapsed, comment } = data
  const accents = accentClasses(accent)
  const source = useZoteroSource()
  const expand = useExpandNode()
  const removeNodes = useBoards((state) => state.removeNodes)
  const viewOnly = useSettings((state) => state.viewOnly)
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const [expanding, setExpanding] = useState<ExpansionKind | null>(null)

  const runExpansion = async (kind: ExpansionKind) => {
    setExpanding(kind)
    try {
      const { added, skipped } = await expand(
        { itemKey: data.itemKey, position: { x: positionAbsoluteX, y: positionAbsoluteY } },
        kind,
      )
      if (added === 0 && skipped === 0) {
        toast.info('Nothing to add', {
          description: 'Zotero returned no matches for that expansion.',
        })
      } else {
        toast.success(`Added ${added} node${added === 1 ? '' : 's'}`, {
          description: skipped ? `${skipped} were already on the board` : undefined,
        })
      }
    } catch (error) {
      toast.error('Expansion failed', { description: (error as Error).message })
    } finally {
      setExpanding(null)
    }
  }

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost" disabled={Boolean(expanding)}>
                <Sparkles /> Expand <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Grow the graph from here</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {EXPANSIONS.map((expansion) => (
                <DropdownMenuItem
                  key={expansion.kind}
                  onSelect={() => void runExpansion(expansion.kind)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{expansion.label}</span>
                  <span className="text-muted-foreground text-xs">{expansion.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Node colour">
                <span className={cn('size-3 rounded-full', accents.dot)} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <AccentMenuItems
                value={accent}
                onSelect={(next) => updateNodeData(id, { accent: next })}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-xs" variant="ghost" asChild>
                <a
                  href={zoteroSelectUrl(snapshot.key, source.library)}
                  aria-label="Open in Zotero"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ExternalLink />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in Zotero</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => updateNodeData(id, { collapsed: !collapsed })}
                aria-label={collapsed ? 'Expand card' : 'Collapse card'}
              >
                <ChevronDown className={cn('transition-transform', collapsed && '-rotate-90')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{collapsed ? 'Show details' : 'Collapse'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={viewOnly}
                onClick={() => removeNodes([id])}
                aria-label="Remove from board"
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from board (Zotero is untouched)</TooltipContent>
          </Tooltip>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'bg-card text-card-foreground relative w-[268px] overflow-hidden rounded-xl border shadow-sm transition-shadow',
          'hover:shadow-md',
          selected && 'ring-primary/60 ring-2',
          expanding && 'animate-pulse',
        )}
      >
        <span className={cn('absolute inset-y-0 left-0 w-1', accents.bar)} aria-hidden />

        <div className="space-y-1.5 py-2.5 pr-3 pl-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <ItemTypeIcon itemType={snapshot.itemType} className="size-3.5" />
            <span className="truncate">{itemTypeLabel(snapshot.itemType)}</span>
            {snapshot.year && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{snapshot.year}</span>
              </>
            )}
            {comment && <MessageSquareText className="ml-auto size-3.5" aria-label="Has a comment" />}
          </div>

          <p className={cn('text-sm leading-snug font-medium', collapsed ? 'line-clamp-1' : 'line-clamp-3')}>
            {snapshot.title}
          </p>

          {!collapsed && (
            <>
              {snapshot.creatorSummary && (
                <p className="text-muted-foreground truncate text-xs">{snapshot.creatorSummary}</p>
              )}
              {snapshot.source && (
                <p className="text-muted-foreground/80 truncate text-[11px] italic">{snapshot.source}</p>
              )}
              {snapshot.tags && snapshot.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {snapshot.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                      {tag}
                    </Badge>
                  ))}
                  {snapshot.tags.length > 3 && (
                    <span className="text-muted-foreground text-[10px]">
                      +{snapshot.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <EdgeZones />
    </>
  )
}

export const ItemNodeView = memo(ItemNodeComponent)

import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { Hash, Minus, Tags, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { accentClasses } from '../accents'
import { frameTag } from '../board-search'
import { useCanvasUi } from '../canvas-ui'
import { useBoards } from '../store'
import { FRAME_WEIGHTS, type FrameNode, type FrameWeight, type ItemNodeData, type MindNode } from '../types'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'

/** Border width in px per weight. */
const FRAME_BORDER_PX: Record<FrameWeight, number> = { thin: 1, medium: 2, thick: 4, heavy: 7 }

const WEIGHT_LABELS: Record<FrameWeight, string> = {
  thin: 'Thin',
  medium: 'Medium',
  thick: 'Thick',
  heavy: 'Extra thick',
}

const EMPTY: MindNode[] = []

function memberLabel(node: MindNode): string {
  switch (node.type) {
    case 'zoteroItem':
      return (node.data as ItemNodeData).snapshot.title
    case 'note':
      return node.data.citation ?? node.data.text
    case 'tag':
      return `#${node.data.tag}`
    case 'creator':
      return node.data.name
    case 'collection':
      return node.data.name
    case 'timeline':
      return node.data.label
    case 'image':
      return node.data.caption ?? 'Image'
    case 'claim':
      return `Claim: ${node.data.text}`
    case 'question':
      return `${node.data.code}: ${node.data.text}`
    default:
      return 'Text block'
  }
}

/**
 * A background region used to cluster cards visually. It is deliberately *not* a
 * React Flow parent node: membership is geometric (see groups.ts), so cards can
 * be dropped in and out freely. At the "groups" detail level the frame stands in
 * for its contents and lists them.
 */
function FrameNodeComponent({ id, data, selected }: NodeProps<FrameNode>) {
  const accents = accentClasses(data.accent)
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const collapsed = useCanvasUi((state) => state.detail === 'groups')
  const members = useCanvasUi((state) => state.groupMembers.get(id) ?? EMPTY)

  const isTagGroup = data.variant === 'tag' || Boolean(data.tag)
  const tag = frameTag({ id, type: 'frame', position: { x: 0, y: 0 }, data })
  // How many cards currently inherit this group's tag (selector returns a number,
  // so the frame only re-renders when the count changes).
  const taggedCount = useCanvasUi((state) => {
    if (!tag) return 0
    const key = tag.toLowerCase()
    let count = 0
    for (const tags of state.inheritedTags.values()) if (tags.some((entry) => entry.toLowerCase() === key)) count += 1
    return count
  })

  const weight = data.weight ?? 'medium'
  const lineStyle = data.lineStyle ?? 'dashed'

  return (
    <>
      <NodeResizer
        isVisible={selected && !viewOnly}
        // Resizing is a discrete edit, so it gets its own undo step.
        onResizeStart={commit}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost" aria-label="Border" disabled={viewOnly}>
                <Minus style={{ strokeWidth: 1 + FRAME_BORDER_PX[weight] / 2 }} /> Border
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Thickness</DropdownMenuLabel>
              {FRAME_WEIGHTS.map((option) => (
                <DropdownMenuItem key={option} onSelect={() => updateNodeData(id, { weight: option })}>
                  <span
                    className="bg-foreground w-6 rounded-full"
                    style={{ height: FRAME_BORDER_PX[option] }}
                    aria-hidden
                  />
                  {WEIGHT_LABELS[option]}
                  {weight === option && ' ✓'}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Line</DropdownMenuLabel>
              {(['dashed', 'solid'] as const).map((option) => (
                <DropdownMenuItem key={option} onSelect={() => updateNodeData(id, { lineStyle: option })}>
                  {option === 'dashed' ? 'Dashed' : 'Solid'}
                  {lineStyle === option && ' ✓'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="xs"
            variant={isTagGroup ? 'secondary' : 'ghost'}
            disabled={viewOnly}
            title={
              isTagGroup
                ? 'Turn back into a plain group — cards inside lose the tag'
                : 'Give every card inside this group a tag'
            }
            onClick={() => {
              commit()
              updateNodeData(
                id,
                isTagGroup
                  ? { variant: undefined, tag: undefined }
                  : { variant: 'tag', tag: data.tag ?? '', accent: data.accent === 'neutral' || !data.accent ? 'emerald' : data.accent },
              )
            }}
          >
            <Tags /> {isTagGroup ? 'Tag group' : 'Tag contents'}
          </Button>
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
          'flex h-full w-full flex-col rounded-2xl',
          accents.soft,
          selected ? 'border-primary/60' : weight === 'thin' || weight === 'medium' ? 'border-border' : 'border-foreground/45',
        )}
        style={{ borderWidth: FRAME_BORDER_PX[weight], borderStyle: lineStyle }}
      >
        <div className="flex items-start gap-2 px-4 pt-3">
          <input
            value={data.label}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
            readOnly={viewOnly}
            aria-label="Frame title"
            className={cn(
              'nodrag text-muted-foreground min-w-0 flex-1 truncate bg-transparent font-semibold tracking-wide uppercase outline-none',
              collapsed ? 'text-sm' : 'text-xs',
            )}
          />
          {isTagGroup && (
            <label
              className="nodrag inline-flex max-w-[60%] shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
              title="Every card inside this group carries this tag"
            >
              <Hash className="size-3.5 shrink-0" />
              <input
                value={data.tag ?? ''}
                readOnly={viewOnly}
                onChange={(event) => updateNodeData(id, { tag: event.target.value.replace(/^#+/, '') })}
                placeholder="tag for everything inside"
                aria-label="Tag for the cards in this group"
                size={Math.max(8, (data.tag ?? '').length + 1)}
                className="placeholder:text-emerald-700/50 dark:placeholder:text-emerald-300/50 min-w-0 bg-transparent text-xs font-semibold outline-none"
              />
            </label>
          )}
        </div>
        {isTagGroup && !collapsed && (
          <p className="text-muted-foreground px-4 pt-1 text-[10px]">
            {tag
              ? `${taggedCount} card${taggedCount === 1 ? '' : 's'} tagged #${tag} — drag cards in or out to tag or untag them`
              : 'Name the tag — every card inside gets it, which makes them easy to find in search (Ctrl+F)'}
          </p>
        )}
        {collapsed && (
          <div className="min-h-0 flex-1 overflow-hidden px-4 pt-2 pb-3">
            <p className="text-muted-foreground mb-1 text-xs">
              {members.length} card{members.length === 1 ? '' : 's'} inside
            </p>
            <ul className="text-foreground/80 space-y-0.5 text-xs">
              {members.slice(0, 8).map((member) => (
                <li key={member.id} className="truncate">
                  · {memberLabel(member)}
                </li>
              ))}
              {members.length > 8 && <li className="text-muted-foreground">+ {members.length - 8} more</li>}
            </ul>
          </div>
        )}
      </div>

      <EdgeZones />
    </>
  )
}

export const FrameNodeView = memo(FrameNodeComponent)

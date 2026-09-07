import { Layers, MousePointerClick, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { ACCENT_CLASSES, ACCENT_LABELS } from '../accents'
import { createTagFrame, frameBounds } from '../factory'
import { EDGE_SHAPES, EDGE_SHAPE_LABELS } from '../types'
import { RELATIONS, RELATION_KINDS } from '../relations'
import { useActiveBoard, useBoards } from '../store'
import { ACCENTS, type Accent, type MindEdge, type MindNode } from '../types'
import { ItemInspector } from './item-inspector'

function AccentPicker({
  value,
  onChange,
}: {
  value: Accent | undefined
  onChange: (accent: Accent) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACCENTS.map((accent) => (
        <button
          key={accent}
          type="button"
          aria-label={ACCENT_LABELS[accent]}
          onClick={() => onChange(accent)}
          className={cn(
            'size-5 rounded-full ring-offset-2 ring-offset-background transition',
            ACCENT_CLASSES[accent].dot,
            (value ?? 'neutral') === accent && 'ring-primary ring-2',
          )}
        />
      ))}
    </div>
  )
}

function NoteInspector({ node }: { node: Extract<MindNode, { type: 'note' }> }) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold">Note</h2>
      <Textarea
        value={node.data.text}
        onChange={(event) => updateNodeData(node.id, { text: event.target.value })}
        placeholder="Your thought…"
        className="min-h-40 text-sm"
      />
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Colour</Label>
        <AccentPicker
          value={node.data.accent}
          onChange={(accent) => updateNodeData(node.id, { accent })}
        />
      </div>
    </div>
  )
}

function ImageInspector({ node }: { node: Extract<MindNode, { type: 'image' }> }) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold">Image</h2>
      {/* Live preview; the file swap button lives on the node toolbar. */}
      <img
        src={node.data.src}
        alt={node.data.caption ?? 'Board image'}
        className="border-bg placeholder: w-full rounded-lg border"
      />
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Caption</Label>
        <Textarea
          value={node.data.caption ?? ''}
          onChange={(event) => updateNodeData(node.id, { caption: event.target.value })}
          placeholder="What does this show? (e.g. “Fig. 3, p. 12”)"
          className="min-h-16 text-sm"
        />
      </div>
    </div>
  )
}

function EdgeInspector({ edge }: { edge: MindEdge }) {
  const updateEdgeData = useBoards((state) => state.updateEdgeData)
  const removeEdges = useBoards((state) => state.removeEdges)
  const viewOnly = useSettings((state) => state.viewOnly)
  const current = edge.data?.kind ?? 'related'
  const shape = edge.data?.shape ?? 'bezier'

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold">Connection</h2>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Your label on the line</Label>
        <Input
          value={edge.data?.label ?? ''}
          onChange={(event) => updateEdgeData(edge.id, { label: event.target.value })}
          placeholder="e.g. “contradicts this finding”"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Relation type</Label>
        <div className="grid gap-1">
          {RELATION_KINDS.map((kind) => {
            const spec = RELATIONS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => updateEdgeData(edge.id, { kind, label: undefined })}
                className={cn(
                  'hover:bg-accent flex items-start gap-2 rounded-md border border-transparent p-2 text-left transition-colors',
                  current === kind && 'border-border bg-accent',
                )}
              >
                <span
                  className="mt-1.5 h-0.5 w-5 shrink-0 rounded-full"
                  style={{ background: spec.color }}
                  aria-hidden
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{spec.label}</span>
                  <span className="text-muted-foreground block text-xs">{spec.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Line shape</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {EDGE_SHAPES.map((shapeOption) => (
            <Button
              key={shapeOption}
              size="sm"
              variant={shape === shapeOption ? 'secondary' : 'outline'}
              onClick={() => updateEdgeData(edge.id, { shape: shapeOption })}
            >
              {EDGE_SHAPE_LABELS[shapeOption]}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          To bend the line by hand: select it on the canvas and drag the round
          handle at its middle.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Why are these linked?</Label>
        <Textarea
          value={edge.data?.note ?? ''}
          onChange={(event) => updateEdgeData(edge.id, { note: event.target.value })}
          placeholder="Optional reasoning for this connection"
          className="min-h-20 text-sm"
        />
      </div>

      {!viewOnly && (
        <Button size="sm" variant="destructive" onClick={() => removeEdges([edge.id])}>
          <Trash2 /> Delete connection
        </Button>
      )}
    </div>
  )
}

function MultiSelection({ nodes }: { nodes: MindNode[] }) {
  const removeNodes = useBoards((state) => state.removeNodes)
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const addNodes = useBoards((state) => state.addNodes)
  const addEdges = useBoards((state) => state.addEdges)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const [tag, setTag] = useState('')

  const groupIntoTagFrame = () => {
    const name = tag.trim()
    if (!name) return
    commit()
    // Frames are pre-existing board furniture: only wrap real content nodes.
    const groupable = nodes.filter((node) => node.type !== 'frame')
    const bounds = frameBounds(
      groupable.map((node) => ({
        x: node.position.x,
        y: node.position.y,
        width: typeof node.style?.width === 'number' ? node.style.width : undefined,
        height: typeof node.style?.height === 'number' ? node.style.height : undefined,
      })),
    )
    const group = createTagFrame(name, bounds, groupable.map((node) => node.id))
    addNodes([group.frame])
    addEdges(group.edges)

    // The tag chip id is deterministic; only place it (inside the frame header)
    // when it is not already on the board.
    const board = useBoards.getState()
    const active = board.activeBoardId ? board.boards[board.activeBoardId] : null
    if (!active?.nodes.some((seen) => seen.id === group.tagNode.id)) {
      addNodes([group.tagNode])
    }
    setTag('')
    toast.success(`Grouped ${groupable.length} nodes under “${name}”`)
  }

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold">{nodes.length} nodes selected</h2>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Set colour for all</Label>
        <AccentPicker
          value={undefined}
          onChange={(accent) => {
            for (const node of nodes) updateNodeData(node.id, { accent })
          }}
        />
      </div>

      <Separator />

      {!viewOnly && (
        <>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Group under a tag</Label>
            <div className="flex gap-1.5">
              <Input
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') groupIntoTagFrame()
                }}
                placeholder="e.g. methodology"
                className="min-w-0 flex-1"
              />
              <Button size="sm" variant="outline" onClick={groupIntoTagFrame} disabled={!tag.trim()}>
                <Tags /> Group
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Draws a frame around the selection, adds the tag chip and links every
              member to it. Nodes you drop into the frame later belong to it visually.
            </p>
          </div>

          <Separator />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => removeNodes(nodes.map((node) => node.id))}
          >
            <Trash2 /> Remove from board
          </Button>
        </>
      )}
      {viewOnly && (
        <p className="text-muted-foreground text-xs">
          View-only mode — switch off the eye icon in the top bar to edit.
        </p>
      )}
    </div>
  )
}

function BoardSummary() {
  const board = useActiveBoard()
  if (!board) return null

  const counts = board.nodes.reduce<Record<string, number>>((accumulator, node) => {
    const key = node.type ?? 'unknown'
    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})

  const labels: Record<string, string> = {
    zoteroItem: 'Citations',
    note: 'Notes',
    tag: 'Tags',
    creator: 'Authors',
    collection: 'Collections',
    frame: 'Frames',
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <MousePointerClick className="size-4" />
        Select a node or connection to inspect it
      </div>

      <Separator />

      <section className="space-y-2">
        <Label className="text-muted-foreground text-xs">This board</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="font-normal">
              {count} {labels[type] ?? type}
            </Badge>
          ))}
          <Badge variant="secondary" className="font-normal">
            {board.edges.length} connections
          </Badge>
        </div>
      </section>

      <Separator />

      <section className="text-muted-foreground space-y-2 text-xs leading-relaxed">
        <p className="text-foreground flex items-center gap-1.5 font-medium">
          <Layers className="size-3.5" /> Quick moves
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Drag items from the library onto the canvas.</li>
          <li>Double-click the canvas to drop a note.</li>
          <li>Drag from anywhere on a card's edge to another card to connect them.</li>
          <li>Select a card and use Expand for related items — or “PDF highlights” to pull quote cards out of its annotations.</li>
          <li>Select several nodes and use “Group under a tag” to bundle them.</li>
          <li>
            Press <kbd className="bg-muted rounded px-1">Ctrl</kbd>+
            <kbd className="bg-muted rounded px-1">K</kbd> to search Zotero from anywhere.
          </li>
        </ul>
      </section>
    </div>
  )
}

export function InspectorPanel() {
  const board = useActiveBoard()
  const selectedNodes = (board?.nodes ?? []).filter((node) => node.selected)
  const selectedEdges = (board?.edges ?? []).filter((edge) => edge.selected)

  let content = <BoardSummary />
  if (selectedNodes.length > 1) {
    content = <MultiSelection nodes={selectedNodes} />
  } else if (selectedNodes.length === 1) {
    const node = selectedNodes[0]!
    if (node.type === 'zoteroItem') content = <ItemInspector node={node} />
    else if (node.type === 'note') content = <NoteInspector node={node} />
    else if (node.type === 'image') content = <ImageInspector node={node} />
    else content = <BoardSummary />
  } else if (selectedEdges.length === 1) {
    content = <EdgeInspector edge={selectedEdges[0]!} />
  }

  return (
    <ScrollArea className="h-full">
      <div className="pb-8">{content}</div>
    </ScrollArea>
  )
}

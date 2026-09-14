import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  ViewportPortal,
  type DefaultEdgeOptions,
  type Node,
  type OnConnect,
  type Viewport,
  type XYPosition,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react'
import { toast } from 'sonner'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { hasDroppableContent, MAX_IMAGE_BYTES, nodesFromFiles, nodesFromText, transferText } from './canvas-drop'
import { effectiveTool, PLACEMENT_TOOLS, TOOL_SHORTCUTS, TOOLS, useCanvasUi, type Tool } from './canvas-ui'
import { findGaps, questionScope, type Gap } from './argument'
import { BoardSearch } from './board-search-dialog'
import { inheritedTags } from './board-search'
import { ViewBar } from './view-bar'
import { DEFAULT_RELATION, type RelationKind } from './relations'
import { EdgeMarkerDefs, edgeTypes } from './edges/relation-edge'
import {
  createClaimNode,
  createQuestionNode,
  nextQuestionCode,
  createFrameNode,
  createItemNode,
  createNoteNode,
  createRichTextNode,
  createTimelineNode,
  NODE_SIZE,
} from './factory'
import { GraphToolbar } from './graph-toolbar'
import { frameMembership, groupEdges, groupSummaries, hiddenAtLevel, nodeRect } from './groups'
import { nodeTypes } from './nodes'
import { RelationLegend } from './relation-legend'
import { useBoards, useActiveBoard } from './store'
import { getDragItems } from './dnd'
import { defaultPeriod, publicationYear } from './timeline'
import { linkToTimeline } from './timeline-links'
import { nodeId, type MindEdge, type MindNode, type RelationEdgeData } from './types'

const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: 'relation',
  data: { kind: DEFAULT_RELATION },
}

/**
 * In view-only mode structural changes are blocked at React Flow's input layer:
 * no dragging, no new connections and no Delete/Backspace removal, so a cursor
 * slip cannot damage a board. Node selection still works for the inspector.
 */
const deleteKeyCodes: ['Delete', 'Backspace'] = ['Delete', 'Backspace']

/** Below React Flow's +1000 selection lift, so frames never cover cards. */
const FRAME_Z_INDEX = -1001

/** The viewport a board carries before it has ever been framed or panned. */
function isUnframed(viewport: Viewport): boolean {
  return viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return Boolean(
    element?.isContentEditable ||
      element?.tagName === 'INPUT' ||
      element?.tagName === 'TEXTAREA' ||
      element?.tagName === 'SELECT' ||
      element?.closest?.('[contenteditable="true"]'),
  )
}

const MINIMAP_COLORS: Record<string, string> = {
  zoteroItem: 'var(--color-muted-foreground)',
  note: 'var(--color-chart-2)',
  richText: 'var(--color-chart-3)',
  claim: 'var(--rel-supports)',
  question: 'var(--rel-extends)',
  timeline: 'var(--color-chart-4)',
  tag: 'var(--rel-context)',
  creator: 'var(--rel-extends)',
  collection: 'var(--rel-method)',
  frame: 'transparent',
}

/**
 * Sensible relation for a new connection: anything linked to a claim is most
 * likely evidence for it, and a line to a timeline carries the period the source
 * covers. The line's type can still be changed from its label.
 */
function relationFor(
  source: MindNode | undefined,
  target: MindNode | undefined,
  nodes: MindNode[],
): { kind: RelationKind; data?: Partial<RelationEdgeData> } {
  const types = [source?.type, target?.type]
  if (types.includes('timeline')) {
    const other = source?.type === 'timeline' ? target : source
    if (other && other.type !== 'timeline') {
      const byId = new Map(nodes.map((node) => [node.id, node]))
      return { kind: 'context', data: { period: defaultPeriod(publicationYear(other, byId)) } }
    }
  }
  if (types.includes('question')) return { kind: DEFAULT_RELATION }
  if (types.includes('claim')) return { kind: 'supports' }
  return { kind: DEFAULT_RELATION }
}

/** Gap badges, grouped per card and placed above it in flow coordinates. */
function GapBadges({ gaps, nodes }: { gaps: Gap[]; nodes: MindNode[] }) {
  const byNode = new Map<string, Gap[]>()
  for (const gap of gaps) byNode.set(gap.nodeId, [...(byNode.get(gap.nodeId) ?? []), gap])
  return (
    <ViewportPortal>
      {nodes
        .filter((node) => byNode.has(node.id) && !node.hidden)
        .map((node) => (
          <div
            key={node.id}
            className="pointer-events-none absolute top-0 left-0 flex max-w-72 flex-col items-start gap-0.5 pb-1.5"
            style={{ transform: `translate(${node.position.x}px, ${node.position.y}px) translateY(-100%)` }}
          >
            {byNode.get(node.id)!.map((gap) => (
              <span
                key={gap.message}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-sm',
                  gap.severity === 'high' && 'bg-destructive text-white',
                  gap.severity === 'medium' && 'bg-amber-500 text-black',
                  gap.severity === 'low' && 'bg-muted text-foreground border',
                )}
              >
                {gap.message}
              </span>
            ))}
          </div>
        ))}
    </ViewportPortal>
  )
}


export function BoardCanvas() {
  const board = useActiveBoard()
  const onNodesChange = useBoards((state) => state.onNodesChange)
  const onEdgesChange = useBoards((state) => state.onEdgesChange)
  const connect = useBoards((state) => state.onConnect)
  const commit = useBoards((state) => state.commit)
  const addNodes = useBoards((state) => state.addNodes)
  const addEdges = useBoards((state) => state.addEdges)
  const setNodes = useBoards((state) => state.setNodes)
  const setViewport = useBoards((state) => state.setViewport)
  const dropLastHistory = useBoards((state) => state.dropLastHistory)
  const undo = useBoards((state) => state.undo)
  const redo = useBoards((state) => state.redo)

  const viewOnly = useSettings((state) => state.viewOnly)
  const edgeShape = useSettings((state) => state.edgeShape)

  const tool = useCanvasUi(effectiveTool)
  const detail = useCanvasUi((state) => state.detail)
  const setTool = useCanvasUi((state) => state.setTool)
  const setSpacePan = useCanvasUi((state) => state.setSpacePan)
  const setGroupMembers = useCanvasUi((state) => state.setGroupMembers)
  const setInheritedTags = useCanvasUi((state) => state.setInheritedTags)
  const setSearchOpen = useCanvasUi((state) => state.setSearchOpen)
  const showGaps = useCanvasUi((state) => state.showGaps)
  const focusQuestion = useCanvasUi((state) => state.focusQuestion)
  const highlight = useCanvasUi((state) => state.highlight)
  const setHoverNodeId = useCanvasUi((state) => state.setHoverNodeId)
  /** Serialised inherited tags last pushed to the store, to skip no-op updates. */
  const inheritedKey = useRef('')

  const { screenToFlowPosition, fitView, setViewport: applyViewport } = useReactFlow<
    MindNode,
    MindEdge
  >()
  const wrapperRef = useRef<HTMLDivElement>(null)
  /** Node positions captured at drag start, to tell a real move from a click. */
  const dragOrigin = useRef<Map<string, XYPosition> | null>(null)
  /** Group drag: the frame's start position and the members travelling with it. */
  const groupDrag = useRef<{ start: XYPosition; members: Map<string, XYPosition> } | null>(null)
  /** Last pointer position over the canvas, where pasted content lands. */
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const boardId = board?.id

  // Opening a board restores exactly where its owner left off. `defaultViewport`
  // alone cannot do this: it is read once on mount, while switching boards keeps
  // this component alive. Auto-framing is reserved for boards nobody has panned
  // yet, so it never overwrites a saved viewport.
  useEffect(() => {
    if (!boardId) return
    const timer = window.setTimeout(() => {
      const viewport = useBoards.getState().boards[boardId]?.viewport
      if (viewport && !isUnframed(viewport)) {
        void applyViewport(viewport, { duration: 0 })
        return
      }
      void fitView({ padding: 0.25, maxZoom: 1.1, duration: 250 })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [boardId, fitView, applyViewport])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 'f') {
          event.preventDefault()
          setSearchOpen(true)
          return
        }
        if (event.key.toLowerCase() !== 'z') return
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.altKey) return
      if (event.code === 'Space') {
        // Keeps the page from scrolling while the space bar pans.
        event.preventDefault()
        if (!event.repeat) setSpacePan(true)
        return
      }
      if (event.key === 'Escape') {
        setTool('select')
        return
      }
      const next = TOOLS.find((candidate) => TOOL_SHORTCUTS[candidate].toLowerCase() === event.key.toLowerCase())
      if (next && (!PLACEMENT_TOOLS.has(next) || !useSettings.getState().viewOnly)) setTool(next)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePan(false)
    }
    const release = () => setSpacePan(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [undo, redo, setTool, setSpacePan, setSearchOpen])

  /** Flow position of the pointer, or the middle of the canvas. */
  const pastePosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    const screen = pointer.current ?? (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 })
    return screenToFlowPosition(screen)
  }, [screenToFlowPosition])

  const insertText = useCallback(
    (text: string, position: XYPosition) => {
      const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
      const result = nodesFromText(text, position, nodes)
      if (result.nodes.length === 0) return false
      addNodes(result.nodes)
      addEdges(result.edges)
      const quotes = result.nodes.filter((node) => node.type === 'note' && 'citation' in node.data && node.data.citation)
      if (quotes.length) toast.success(`${quotes.length} quote${quotes.length === 1 ? '' : 's'} added`)
      return true
    },
    [addEdges, addNodes, boardId],
  )

  const insertFiles = useCallback(
    async (files: File[], position: XYPosition) => {
      const { nodes, skipped } = await nodesFromFiles(files, position)
      addNodes(nodes)
      if (skipped) {
        toast.info(`${skipped} file(s) skipped`, {
          description: `Only images up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB can be dropped.`,
        })
      }
    },
    [addNodes],
  )

  // Ctrl+V on the canvas: Zotero quotes become quote cards, text a note, images image cards.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (useSettings.getState().viewOnly || isTypingTarget(event.target)) return
      const data = event.clipboardData
      if (!data) return
      const files = [...data.files]
      if (files.length) {
        event.preventDefault()
        void insertFiles(files, pastePosition())
        return
      }
      const text = transferText(data)
      if (text && insertText(text, pastePosition())) event.preventDefault()
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [insertFiles, insertText, pastePosition])

  // --- detail levels -------------------------------------------------------
  const view = useMemo(() => {
    // React Flow lifts selected nodes by 1000 z-levels, which put a selected frame
    // in front of its own cards (greyed out and unclickable). Frames render far
    // enough behind that even selected they stay under every card.
    const nodes = (board?.nodes ?? []).map((node) =>
      node.type === 'frame' ? { ...node, zIndex: FRAME_Z_INDEX } : node,
    )
    const edges = board?.edges ?? []
    const hidden = new Set<string>()

    // Question focus: only the question, what is anchored to it, and the frames
    // those cards sit in.
    const focused = focusQuestion && nodes.some((node) => node.id === focusQuestion) ? focusQuestion : null
    if (focused) {
      const scope = questionScope(focused, nodes, edges)
      scope.add(focused)
      const visibleFrames = new Set(
        frameMembership(nodes.filter((node) => node.type === 'frame' || scope.has(node.id))).values(),
      )
      for (const node of nodes) {
        if (!scope.has(node.id) && !visibleFrames.has(node.id)) hidden.add(node.id)
      }
    }

    const membership = detail === 'all' ? null : frameMembership(nodes)
    if (membership) for (const id of hiddenAtLevel(nodes, detail, membership)) hidden.add(id)

    const gaps = showGaps ? findGaps(nodes, edges) : []
    const gapIds = new Set(gaps.map((gap) => gap.nodeId))

    const viewNodes =
      hidden.size === 0 && !showGaps && !highlight
        ? nodes
        : nodes.map((node) => {
            const classes = [
              showGaps && node.type !== 'frame' ? (gapIds.has(node.id) ? 'mindtero-gap' : 'mindtero-dim') : '',
              // A hovered Gantt bar lights up its source card.
              highlight?.nodeId === node.id ? 'mindtero-highlight' : '',
            ].filter(Boolean)
            if (!hidden.has(node.id) && classes.length === 0) return node
            return {
              ...node,
              ...(hidden.has(node.id) ? { hidden: true } : {}),
              ...(classes.length ? { className: classes.join(' ') } : {}),
            }
          })
    const frameIds = new Set(nodes.filter((node) => node.type === 'frame').map((node) => node.id))
    const viewEdges =
      detail === 'groups' && membership
        ? groupEdges(edges, membership, frameIds)
        : highlight?.edgeId
          ? edges.map((edge) => (edge.id === highlight.edgeId ? { ...edge, className: 'mindtero-edge-highlight' } : edge))
          : edges
    return {
      nodes: viewNodes,
      edges: viewEdges,
      members: detail === 'groups' && membership ? groupSummaries(nodes, membership) : null,
      gaps,
    }
  }, [board?.nodes, board?.edges, detail, focusQuestion, showGaps, highlight])

  // Tags inherited from tag groups, shared with the cards. Only pushed when they
  // actually changed, so dragging a card does not re-render every other card.
  useEffect(() => {
    const next = inheritedTags(board?.nodes ?? [])
    const key = JSON.stringify([...next])
    if (key === inheritedKey.current) return
    inheritedKey.current = key
    setInheritedTags(next)
  }, [board?.nodes, setInheritedTags])

  useEffect(() => {
    const current = useCanvasUi.getState().groupMembers
    if (view.members) setGroupMembers(view.members)
    else if (current.size) setGroupMembers(new Map())
  }, [view.members, setGroupMembers])

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
      const find = (id: string) => nodes.find((node) => node.id === id)
      const relation = relationFor(find(connection.source), find(connection.target), nodes)
      connect(connection, relation.kind, relation.data)
    },
    [boardId, connect],
  )

  // History has to be pushed *before* a drag mutates positions, but most drags
  // that start never move anything — React Flow reports a drag as soon as the
  // pointer passes the threshold. So commit up front and unwind the commit on
  // drop when every node landed where it started.
  const onNodeDragStart = useCallback(
    (_event: unknown, node: Node) => {
      const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
      dragOrigin.current = new Map(nodes.map((entry) => [entry.id, entry.position]))
      commit()

      // Outside "everything", a frame acts as a container: its contents move with it.
      groupDrag.current = null
      if (node.type !== 'frame' || useCanvasUi.getState().detail === 'all') return
      const frame = nodeRect(node as MindNode)
      const members = new Map<string, XYPosition>()
      for (const entry of nodes) {
        if (entry.id === node.id || entry.selected) continue
        const rect = nodeRect(entry)
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        if (cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height) {
          members.set(entry.id, entry.position)
        }
      }
      if (members.size) groupDrag.current = { start: node.position, members }
    },
    [boardId, commit],
  )

  const onNodeDrag = useCallback(
    (_event: unknown, node: Node) => {
      const drag = groupDrag.current
      if (!drag) return
      const dx = node.position.x - drag.start.x
      const dy = node.position.y - drag.start.y
      const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
      setNodes(
        nodes.map((entry) => {
          const origin = drag.members.get(entry.id)
          return origin ? { ...entry, position: { x: origin.x + dx, y: origin.y + dy } } : entry
        }),
      )
    },
    [boardId, setNodes],
  )

  const onNodeDragStop = useCallback(() => {
    groupDrag.current = null
    const origin = dragOrigin.current
    dragOrigin.current = null
    if (!origin) return
    const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
    const moved = nodes.some((node) => {
      const before = origin.get(node.id)
      return !before || before.x !== node.position.x || before.y !== node.position.y
    })
    if (!moved) dropLastHistory()
  }, [boardId, dropLastHistory])

  const onDragOver = useCallback((event: DragEvent) => {
    if (!hasDroppableContent(event.dataTransfer.types)) return
    // Text dropped into a note's own editor is that editor's business.
    if (isTypingTarget(event.target)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (isTypingTarget(event.target)) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const items = getDragItems(event)

      if (items.length > 0) {
        event.preventDefault()
        // Library items dropped onto a timeline become cards next to it, connected
        // to it with a period — the same as drawing the lines by hand.
        const timelineId = (event.target as Element | null)
          ?.closest?.('.react-flow__node-timeline')
          ?.getAttribute('data-id')
        const timeline = timelineId
          ? useBoards.getState().boards[boardId ?? '']?.nodes.find((node) => node.id === timelineId)
          : undefined
        if (timeline?.type === 'timeline') {
          const existing = new Map(
            (useBoards.getState().boards[boardId ?? '']?.nodes ?? []).map((node) => [node.id, node]),
          )
          const fresh = items
            .filter((item) => !existing.has(nodeId.item(item.key)))
            .map((item, index) =>
              createItemNode(item, {
                x: timeline.position.x - NODE_SIZE.item.width - 80,
                y: timeline.position.y + index * (NODE_SIZE.item.height + 24),
              }),
            )
          if (fresh.length) addNodes(fresh)
          else commit()
          const cards = items.map((item) => existing.get(nodeId.item(item.key)) ?? fresh.find((node) => node.data.itemKey === item.key))
          const linked = linkToTimeline(timeline.id, cards.filter((card): card is MindNode => Boolean(card)))
          if (linked) toast.success(`${linked} source${linked === 1 ? '' : 's'} added to the timeline`)
          else toast.info('Already on this timeline')
          return
        }
        // Stagger multi-item drops so cards do not land on top of each other.
        addNodes(
          items.map((item, index) =>
            createItemNode(item, {
              x: position.x + index * 24,
              y: position.y + index * (NODE_SIZE.item.height + 16),
            }),
          ),
        )
        return
      }

      const files = [...event.dataTransfer.files]
      if (files.length) {
        event.preventDefault()
        void insertFiles(files, position)
        return
      }

      const text = transferText(event.dataTransfer)
      if (text) {
        event.preventDefault()
        insertText(text, position)
      }
    },
    [addNodes, boardId, commit, insertFiles, insertText, screenToFlowPosition],
  )

  const placeNode = useCallback(
    (placing: Tool, position: XYPosition): MindNode | null => {
      switch (placing) {
        case 'note':
          return createNoteNode({ x: position.x - NODE_SIZE.note.width / 2, y: position.y - 24 })
        case 'richText':
          return createRichTextNode({ x: position.x - NODE_SIZE.richText.width / 2, y: position.y - 24 })
        case 'claim':
          return createClaimNode({ x: position.x - NODE_SIZE.claim.width / 2, y: position.y - 24 })
        case 'question': {
          const nodes = useBoards.getState().boards[boardId ?? '']?.nodes ?? []
          const codes = nodes.flatMap((node) => (node.type === 'question' ? [node.data.code] : []))
          return createQuestionNode(
            { x: position.x - NODE_SIZE.question.width / 2, y: position.y - 24 },
            nextQuestionCode(codes),
          )
        }
        case 'frame':
          return createFrameNode(position)
        case 'tagGroup':
          return createFrameNode(position, 'Tag group', 'tag')
        case 'timeline':
          return createTimelineNode(position)
        default:
          return null
      }
    },
    [boardId],
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (viewOnly || !PLACEMENT_TOOLS.has(tool)) return
      const node = placeNode(tool, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
      if (!node) return
      addNodes([node])
      // Shift keeps the tool for placing several in a row.
      if (!event.shiftKey) setTool('select')
    },
    [addNodes, placeNode, screenToFlowPosition, setTool, tool, viewOnly],
  )

  // Frames cover the canvas behind them, so placing inside a group lands on the frame.
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type === 'frame' && PLACEMENT_TOOLS.has(tool) && tool !== 'frame' && tool !== 'tagGroup') {
        onPaneClick(event)
      }
    },
    [onPaneClick, tool],
  )

  if (!board) return null

  const selecting = tool === 'select'
  const hand = tool === 'hand'

  return (
    <div
      className={cn('mindtero-canvas relative h-full w-full', `mindtero-tool-${tool}`)}
      ref={wrapperRef}
      onPointerMove={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerLeave={() => {
        pointer.current = null
      }}
    >
      <EdgeMarkerDefs />
      <ReactFlow<MindNode, MindEdge>
        nodes={view.nodes}
        edges={view.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        onDrop={viewOnly ? undefined : onDrop}
        onDragOver={viewOnly ? undefined : onDragOver}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
        onNodeMouseLeave={() => setHoverNodeId(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          ...DEFAULT_EDGE_OPTIONS,
          data: { kind: DEFAULT_RELATION, shape: edgeShape },
        }}
        defaultViewport={board.viewport}
        // Loose mode lets any handle act as both source and target, which suits
        // free-form mind mapping better than strict source→target handles.
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionRadius={28}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={viewOnly ? null : deleteKeyCodes}
        multiSelectionKeyCode={['Meta', 'Control']}
        panOnScroll
        // Select: left-drag draws a selection box. Hand: every drag pans.
        selectionOnDrag={!viewOnly && selecting}
        panOnDrag={hand ? true : [1, 2]}
        zoomOnDoubleClick={false}
        minZoom={0.15}
        maxZoom={2.5}
        nodeDragThreshold={4}
        nodesDraggable={!viewOnly && selecting}
        nodesConnectable={!viewOnly && selecting}
        elementsSelectable={!hand}
        edgesReconnectable={false}
        proOptions={{ hideAttribution: false }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-60" />
        <Controls
          showInteractive={false}
          position="bottom-right"
          className="!bottom-16 !shadow-none"
        />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => MINIMAP_COLORS[node.type ?? ''] ?? 'var(--color-muted-foreground)'}
          maskColor="color-mix(in oklab, var(--color-background) 70%, transparent)"
          className="!bottom-4 !h-24 !w-40"
        />
        <Panel position="top-left" className="!m-3">
          {/* The view bar sits under the toolbar: the bottom edge is shared with the
              legend, minimap and zoom controls and gets crowded on narrow canvases. */}
          <div className="flex flex-col items-start gap-2">
            <GraphToolbar />
            <ViewBar />
          </div>
        </Panel>
        {showGaps && <GapBadges gaps={view.gaps} nodes={view.nodes} />}
        <Panel position="bottom-left" className="!m-3">
          <RelationLegend />
        </Panel>
      </ReactFlow>
      <BoardSearch />
    </div>
  )
}

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
  type DefaultEdgeOptions,
  type OnConnect,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, type DragEvent } from 'react'
import { useSettings } from '@/lib/settings'
import { EdgeMarkerDefs, edgeTypes } from './edges/relation-edge'
import { createItemNode, createNoteNode, NODE_SIZE } from './factory'
import { GraphToolbar } from './graph-toolbar'
import { nodeTypes } from './nodes'
import { RelationLegend } from './relation-legend'
import { useBoards, useActiveBoard } from './store'
import { getDragItems, hasDragItems } from './dnd'
import { DEFAULT_RELATION } from './relations'
import type { MindEdge, MindNode } from './types'

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

const MINIMAP_COLORS: Record<string, string> = {
  zoteroItem: 'var(--color-muted-foreground)',
  note: 'var(--color-chart-2)',
  tag: 'var(--rel-context)',
  creator: 'var(--rel-extends)',
  collection: 'var(--rel-method)',
  frame: 'transparent',
}

export function BoardCanvas() {
  const board = useActiveBoard()
  const onNodesChange = useBoards((state) => state.onNodesChange)
  const onEdgesChange = useBoards((state) => state.onEdgesChange)
  const connect = useBoards((state) => state.onConnect)
  const commit = useBoards((state) => state.commit)
  const addNodes = useBoards((state) => state.addNodes)
  const setViewport = useBoards((state) => state.setViewport)
  const undo = useBoards((state) => state.undo)
  const redo = useBoards((state) => state.redo)

  const viewOnly = useSettings((state) => state.viewOnly)
  const edgeShape = useSettings((state) => state.edgeShape)

  const { screenToFlowPosition, fitView } = useReactFlow<MindNode, MindEdge>()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const boardId = board?.id

  // Frame a board the first time it is opened in this session.
  useEffect(() => {
    if (!boardId) return
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.25, maxZoom: 1.1, duration: 250 })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [boardId, fitView])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA'
      if (typing) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const onConnect = useCallback<OnConnect>((connection) => connect(connection), [connect])

  const onDragOver = useCallback((event: DragEvent) => {
    if (!hasDragItems(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      const items = getDragItems(event)
      if (items.length === 0) return
      event.preventDefault()
      const origin = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      // Stagger multi-item drops so cards do not land on top of each other.
      addNodes(
        items.map((item, index) =>
          createItemNode(item, {
            x: origin.x + index * 24,
            y: origin.y + index * (NODE_SIZE.item.height + 16),
          }),
        ),
      )
    },
    [addNodes, screenToFlowPosition],
  )

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNodes([
        createNoteNode({
          x: position.x - NODE_SIZE.note.width / 2,
          y: position.y - NODE_SIZE.note.height / 2,
        }),
      ])
    },
    [addNodes, screenToFlowPosition],
  )

  if (!board) return null

  return (
    <div className="relative h-full w-full" ref={wrapperRef}>
      <EdgeMarkerDefs />
      <ReactFlow<MindNode, MindEdge>
        nodes={board.nodes}
        edges={board.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={commit}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        onDrop={viewOnly ? undefined : onDrop}
        onDragOver={viewOnly ? undefined : onDragOver}
        onDoubleClick={viewOnly ? undefined : onPaneDoubleClick}
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
        selectionOnDrag={!viewOnly}
        panOnDrag={[1, 2]}
        zoomOnDoubleClick={false}
        minZoom={0.15}
        maxZoom={2.5}
        nodeDragThreshold={2}
        nodesDraggable={!viewOnly}
        nodesConnectable={!viewOnly}
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
          <GraphToolbar />
        </Panel>
        <Panel position="bottom-left" className="!m-3">
          <RelationLegend />
        </Panel>
      </ReactFlow>
    </div>
  )
}

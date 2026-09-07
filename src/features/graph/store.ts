import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { idbStorage } from '@/lib/idb-storage'
import { DEFAULT_RELATION, type RelationKind } from './relations'
import {
  nodeId,
  type Accent,
  type Board,
  type ItemNodeData,
  type ItemSnapshot,
  type MindEdge,
  type MindNode,
} from './types'

const HISTORY_LIMIT = 60

interface Snapshot {
  nodes: MindNode[]
  edges: MindEdge[]
}

interface History {
  past: Snapshot[]
  future: Snapshot[]
}

export interface BoardsState {
  boards: Record<string, Board>
  /** Display order of `boards`, most recently created first. */
  order: string[]
  activeBoardId: string | null
  /** Undo stacks are per board and intentionally not persisted. */
  history: Record<string, History>

  createBoard: (name?: string) => string
  deleteBoard: (id: string) => void
  updateBoardMeta: (id: string, patch: Partial<Pick<Board, 'name' | 'description'>>) => void
  duplicateBoard: (id: string) => string | null
  importBoard: (board: Board) => string
  setActiveBoard: (id: string | null) => void
  ensureBoard: () => string

  setViewport: (viewport: Viewport) => void
  onNodesChange: (changes: NodeChange<MindNode>[]) => void
  onEdgesChange: (changes: EdgeChange<MindEdge>[]) => void
  onConnect: (connection: Connection, kind?: RelationKind) => void

  addNodes: (nodes: MindNode[]) => void
  addEdges: (edges: MindEdge[]) => void
  setNodes: (nodes: MindNode[]) => void
  updateNodeData: (id: string, patch: Partial<MindNode['data']>) => void
  updateEdgeData: (id: string, patch: Partial<NonNullable<MindEdge['data']>>) => void
  setNodeAccent: (id: string, accent: Accent) => void
  removeNodes: (ids: string[]) => void
  removeEdges: (ids: string[]) => void
  /** Replaces snapshots for item nodes whose keys are present in `snapshots`. */
  refreshSnapshots: (snapshots: Record<string, ItemSnapshot>) => void

  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: (boardId: string | null) => boolean
  canRedo: (boardId: string | null) => boolean
}

function now(): string {
  return new Date().toISOString()
}

export function createEmptyBoard(name = 'Untitled board'): Board {
  const timestamp = now()
  return {
    id: nanoid(10),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

export const useBoards = create<BoardsState>()(
  persist(
    (set, get) => {
      /** Applies `mutate` to the active board and stamps `updatedAt`. */
      const mutateActive = (mutate: (board: Board) => Snapshot) => {
        const { activeBoardId, boards } = get()
        if (!activeBoardId) return
        const board = boards[activeBoardId]
        if (!board) return
        const next = mutate(board)
        set({
          boards: {
            ...boards,
            [activeBoardId]: { ...board, ...next, updatedAt: now() },
          },
        })
      }

      /** Pushes the current state onto the undo stack. Call *before* a discrete edit. */
      const pushHistory = () => {
        const { activeBoardId, boards, history } = get()
        if (!activeBoardId) return
        const board = boards[activeBoardId]
        if (!board) return
        const entry = history[activeBoardId] ?? { past: [], future: [] }
        set({
          history: {
            ...history,
            [activeBoardId]: {
              past: [...entry.past, { nodes: board.nodes, edges: board.edges }].slice(-HISTORY_LIMIT),
              future: [],
            },
          },
        })
      }

      return {
        boards: {},
        order: [],
        activeBoardId: null,
        history: {},

        createBoard: (name) => {
          const board = createEmptyBoard(name)
          set((state) => ({
            boards: { ...state.boards, [board.id]: board },
            order: [board.id, ...state.order],
            activeBoardId: board.id,
          }))
          return board.id
        },

        deleteBoard: (id) =>
          set((state) => {
            const { [id]: _removed, ...boards } = state.boards
            const order = state.order.filter((entry) => entry !== id)
            const { [id]: _history, ...history } = state.history
            return {
              boards,
              order,
              history,
              activeBoardId: state.activeBoardId === id ? (order[0] ?? null) : state.activeBoardId,
            }
          }),

        updateBoardMeta: (id, patch) =>
          set((state) => {
            const board = state.boards[id]
            if (!board) return state
            return {
              boards: { ...state.boards, [id]: { ...board, ...patch, updatedAt: now() } },
            }
          }),

        duplicateBoard: (id) => {
          const source = get().boards[id]
          if (!source) return null
          const copy: Board = {
            ...source,
            id: nanoid(10),
            name: `${source.name} (copy)`,
            createdAt: now(),
            updatedAt: now(),
            nodes: source.nodes.map((node) => ({ ...node, selected: false })),
            edges: source.edges.map((edge) => ({ ...edge, selected: false })),
          }
          set((state) => ({
            boards: { ...state.boards, [copy.id]: copy },
            order: [copy.id, ...state.order],
          }))
          return copy.id
        },

        importBoard: (board) => {
          const imported: Board = { ...board, id: nanoid(10), updatedAt: now() }
          set((state) => ({
            boards: { ...state.boards, [imported.id]: imported },
            order: [imported.id, ...state.order],
            activeBoardId: imported.id,
          }))
          return imported.id
        },

        setActiveBoard: (id) => set({ activeBoardId: id }),

        ensureBoard: () => {
          const { order, activeBoardId, createBoard } = get()
          if (activeBoardId && get().boards[activeBoardId]) return activeBoardId
          const first = order[0]
          if (first) {
            set({ activeBoardId: first })
            return first
          }
          return createBoard('My first board')
        },

        setViewport: (viewport) => {
          const { activeBoardId, boards } = get()
          if (!activeBoardId) return
          const board = boards[activeBoardId]
          if (!board) return
          // Viewport changes are noisy; skip the updatedAt stamp.
          set({ boards: { ...boards, [activeBoardId]: { ...board, viewport } } })
        },

        onNodesChange: (changes) => {
          if (changes.some((change) => change.type === 'remove')) pushHistory()
          mutateActive((board) => ({
            nodes: applyNodeChanges(changes, board.nodes),
            edges: board.edges,
          }))
        },

        onEdgesChange: (changes) => {
          if (changes.some((change) => change.type === 'remove')) pushHistory()
          mutateActive((board) => ({
            nodes: board.nodes,
            edges: applyEdgeChanges(changes, board.edges),
          }))
        },

        onConnect: (connection, kind = DEFAULT_RELATION) => {
          pushHistory()
          mutateActive((board) => ({
            nodes: board.nodes,
            edges: addEdge<MindEdge>(
              {
                ...connection,
                id: `edge:${nanoid(8)}`,
                type: 'relation',
                data: { kind },
              },
              board.edges,
            ),
          }))
        },

        addNodes: (nodes) => {
          if (nodes.length === 0) return
          pushHistory()
          mutateActive((board) => {
            const existing = new Set(board.nodes.map((node) => node.id))
            const fresh = nodes.filter((node) => !existing.has(node.id))
            return { nodes: [...board.nodes, ...fresh], edges: board.edges }
          })
        },

        addEdges: (edges) => {
          if (edges.length === 0) return
          mutateActive((board) => {
            const seen = new Set(
              board.edges.map((edge) => `${edge.source}->${edge.target}:${edge.data?.kind}`),
            )
            const fresh = edges.filter(
              (edge) => !seen.has(`${edge.source}->${edge.target}:${edge.data?.kind}`),
            )
            return { nodes: board.nodes, edges: [...board.edges, ...fresh] }
          })
        },

        setNodes: (nodes) => mutateActive((board) => ({ nodes, edges: board.edges })),

        updateNodeData: (id, patch) =>
          mutateActive((board) => ({
            nodes: board.nodes.map((node) =>
              node.id === id ? ({ ...node, data: { ...node.data, ...patch } } as MindNode) : node,
            ),
            edges: board.edges,
          })),

        updateEdgeData: (id, patch) =>
          mutateActive((board) => ({
            nodes: board.nodes,
            edges: board.edges.map((edge) =>
              edge.id === id
                ? { ...edge, data: { ...(edge.data ?? { kind: DEFAULT_RELATION }), ...patch } }
                : edge,
            ),
          })),

        setNodeAccent: (id, accent) => get().updateNodeData(id, { accent } as Partial<MindNode['data']>),

        removeNodes: (ids) => {
          if (ids.length === 0) return
          pushHistory()
          const doomed = new Set(ids)
          mutateActive((board) => ({
            nodes: board.nodes.filter((node) => !doomed.has(node.id)),
            edges: board.edges.filter(
              (edge) => !doomed.has(edge.source) && !doomed.has(edge.target),
            ),
          }))
        },

        removeEdges: (ids) => {
          if (ids.length === 0) return
          pushHistory()
          const doomed = new Set(ids)
          mutateActive((board) => ({
            nodes: board.nodes,
            edges: board.edges.filter((edge) => !doomed.has(edge.id)),
          }))
        },

        refreshSnapshots: (snapshots) =>
          mutateActive((board) => ({
            nodes: board.nodes.map((node) => {
              if (node.type !== 'zoteroItem') return node
              const data = node.data as ItemNodeData
              const next = snapshots[data.itemKey]
              return next ? { ...node, data: { ...data, snapshot: next } } : node
            }),
            edges: board.edges,
          })),

        commit: pushHistory,

        undo: () => {
          const { activeBoardId, boards, history } = get()
          if (!activeBoardId) return
          const board = boards[activeBoardId]
          const entry = history[activeBoardId]
          if (!board || !entry?.past.length) return
          const previous = entry.past[entry.past.length - 1]!
          set({
            boards: { ...boards, [activeBoardId]: { ...board, ...previous, updatedAt: now() } },
            history: {
              ...history,
              [activeBoardId]: {
                past: entry.past.slice(0, -1),
                future: [{ nodes: board.nodes, edges: board.edges }, ...entry.future].slice(
                  0,
                  HISTORY_LIMIT,
                ),
              },
            },
          })
        },

        redo: () => {
          const { activeBoardId, boards, history } = get()
          if (!activeBoardId) return
          const board = boards[activeBoardId]
          const entry = history[activeBoardId]
          if (!board || !entry?.future.length) return
          const next = entry.future[0]!
          set({
            boards: { ...boards, [activeBoardId]: { ...board, ...next, updatedAt: now() } },
            history: {
              ...history,
              [activeBoardId]: {
                past: [...entry.past, { nodes: board.nodes, edges: board.edges }].slice(
                  -HISTORY_LIMIT,
                ),
                future: entry.future.slice(1),
              },
            },
          })
        },

        canUndo: (boardId) => Boolean(boardId && get().history[boardId]?.past.length),
        canRedo: (boardId) => Boolean(boardId && get().history[boardId]?.future.length),
      }
    },
    {
      name: 'mindtero.boards',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ boards, order, activeBoardId }) => ({ boards, order, activeBoardId }),
    },
  ),
)

/* ------------------------------------------------------------------ selectors */

export function useActiveBoard(): Board | null {
  return useBoards((state) => (state.activeBoardId ? (state.boards[state.activeBoardId] ?? null) : null))
}

export function useBoardList(): Board[] {
  return useBoards(
    useShallow((state) =>
      state.order.map((id) => state.boards[id]).filter((board): board is Board => Boolean(board)),
    ),
  )
}

/** Item keys currently on the active board — used to mark library rows as "added". */
export function useBoardItemKeys(): Set<string> {
  return useBoards(
    useShallow((state) => {
      const board = state.activeBoardId ? state.boards[state.activeBoardId] : null
      const keys = new Set<string>()
      for (const node of board?.nodes ?? []) {
        if (node.type === 'zoteroItem') keys.add((node.data as ItemNodeData).itemKey)
      }
      return keys
    }),
  )
}

export { nodeId }

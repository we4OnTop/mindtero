import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import type { ZoteroItem } from '@/features/zotero/types'
import { createItemNode, NODE_SIZE } from './factory'
import { useBoards } from './store'
import { nodeId, type MindEdge, type MindNode } from './types'

const COLUMN_GAP = NODE_SIZE.item.width + 40
const ROW_GAP = NODE_SIZE.item.height + 32

/**
 * Adds items near the centre of the current viewport, walking down a column and
 * stepping sideways so a burst of additions does not land in one pile.
 */
export function useAddItemsToBoard() {
  const { screenToFlowPosition } = useReactFlow<MindNode, MindEdge>()
  const addNodes = useBoards((state) => state.addNodes)

  return useCallback(
    (items: ZoteroItem[]): number => {
      if (items.length === 0) return 0
      const state = useBoards.getState()
      const board = state.activeBoardId ? state.boards[state.activeBoardId] : null
      if (!board) return 0

      const existing = new Set(board.nodes.map((node) => node.id))
      const fresh = items.filter((item) => !existing.has(nodeId.item(item.key)))
      if (fresh.length === 0) return 0

      const centre = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      const placed = board.nodes.length

      addNodes(
        fresh.map((item, index) => {
          const slot = placed + index
          return createItemNode(item, {
            x: centre.x - NODE_SIZE.item.width / 2 + Math.floor(slot / 4) * COLUMN_GAP,
            y: centre.y - NODE_SIZE.item.height / 2 + (slot % 4) * ROW_GAP,
          })
        }),
      )
      return fresh.length
    },
    [addNodes, screenToFlowPosition],
  )
}

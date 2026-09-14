import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { questionScope } from './argument'
import { useCanvasUi } from './canvas-ui'
import { nodeRect } from './groups'
import { useBoards } from './store'
import type { MindEdge, MindNode } from './types'

/**
 * Jumps to a card: makes sure the current view does not hide it, selects it (so
 * the inspector shows it) and centres the canvas on it. Used by search results
 * and the gap list.
 */
export function useFocusNode(): (nodeId: string) => void {
  const { setCenter, getZoom } = useReactFlow<MindNode, MindEdge>()
  return useCallback(
    (nodeId: string) => {
      const boards = useBoards.getState()
      const board = boards.activeBoardId ? boards.boards[boards.activeBoardId] : undefined
      const node = board?.nodes.find((entry) => entry.id === nodeId)
      if (!board || !node) return

      const ui = useCanvasUi.getState()
      if (ui.detail !== 'all' && node.type !== 'frame') ui.setDetail('all')
      if (
        ui.focusQuestion &&
        ui.focusQuestion !== nodeId &&
        !questionScope(ui.focusQuestion, board.nodes, board.edges).has(nodeId)
      ) {
        ui.setFocusQuestion(null)
      }

      boards.setNodes(
        board.nodes.map((entry) =>
          Boolean(entry.selected) === (entry.id === nodeId) ? entry : { ...entry, selected: entry.id === nodeId },
        ),
      )
      const rect = nodeRect(node)
      void setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, {
        zoom: Math.max(getZoom(), 0.9),
        duration: 400,
      })
    },
    [getZoom, setCenter],
  )
}

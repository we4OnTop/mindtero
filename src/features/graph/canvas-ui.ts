import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DetailLevel } from './groups'
import type { MindNode } from './types'

/**
 * Canvas interaction state. Each tool has one job and its own cursor, which
 * replaces the old "double-click the canvas for a note" gesture that fired far
 * too easily while editing and selecting.
 */
export const TOOLS = ['select', 'hand', 'note', 'claim', 'question', 'richText', 'frame', 'tagGroup', 'timeline'] as const
export type Tool = (typeof TOOLS)[number]

/** Tools that place a new node with a single click on empty canvas. */
export const PLACEMENT_TOOLS = new Set<Tool>(['note', 'claim', 'question', 'richText', 'frame', 'tagGroup', 'timeline'])

export const TOOL_SHORTCUTS: Record<Tool, string> = {
  select: 'V',
  hand: 'H',
  note: 'N',
  claim: 'C',
  question: 'Q',
  richText: 'T',
  frame: 'F',
  tagGroup: 'G',
  timeline: 'L',
}

const EMPTY_TAGS = new Map<string, string[]>()

interface CanvasUiState {
  tool: Tool
  /** Space held down: temporary hand tool, like in most design tools. */
  spacePan: boolean
  detail: DetailLevel
  /** Members per frame at the current layout; filled by the canvas. */
  groupMembers: Map<string, MindNode[]>
  /** Tags each card inherits from the tag groups around it; filled by the canvas. */
  inheritedTags: Map<string, string[]>
  /** Highlight weak spots of the argument and dim everything else. */
  showGaps: boolean
  /** Research question whose scope is the only thing shown, or null. */
  focusQuestion: string | null
  searchOpen: boolean
  /** Card (and its timeline connection) lit up while a Gantt bar is hovered. */
  highlight: { nodeId: string; edgeId?: string } | null
  /** Card under the pointer on the canvas; its Gantt row lights up. */
  hoverNodeId: string | null
  setTool: (tool: Tool) => void
  setSpacePan: (value: boolean) => void
  setDetail: (detail: DetailLevel) => void
  setGroupMembers: (members: Map<string, MindNode[]>) => void
  setInheritedTags: (tags: Map<string, string[]>) => void
  setShowGaps: (value: boolean) => void
  setFocusQuestion: (id: string | null) => void
  setSearchOpen: (open: boolean) => void
  setHighlight: (highlight: { nodeId: string; edgeId?: string } | null) => void
  setHoverNodeId: (id: string | null) => void
}

export const useCanvasUi = create<CanvasUiState>()(
  persist(
    (set) => ({
      tool: 'select',
      spacePan: false,
      detail: 'all',
      groupMembers: new Map(),
      inheritedTags: EMPTY_TAGS,
      showGaps: false,
      focusQuestion: null,
      searchOpen: false,
      highlight: null,
      hoverNodeId: null,
      setTool: (tool) => set({ tool }),
      setSpacePan: (spacePan) => set({ spacePan }),
      setDetail: (detail) => set({ detail }),
      setGroupMembers: (groupMembers) => set({ groupMembers }),
      setInheritedTags: (inheritedTags) => set({ inheritedTags }),
      setShowGaps: (showGaps) => set({ showGaps }),
      setFocusQuestion: (focusQuestion) => set({ focusQuestion }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setHighlight: (highlight) => set({ highlight }),
      setHoverNodeId: (hoverNodeId) => set({ hoverNodeId }),
    }),
    // Only the detail level is worth remembering between sessions.
    { name: 'mindtero.canvas-ui', version: 1, partialize: ({ detail }) => ({ detail }) },
  ),
)

/** The tool that is effectively active (space overrides everything). */
export function effectiveTool(state: Pick<CanvasUiState, 'tool' | 'spacePan'>): Tool {
  return state.spacePan ? 'hand' : state.tool
}

import type { Board, MindNode } from './types'

/**
 * Reading and normalising board files.
 *
 * Mindtero has written four JSON shapes over time, and every one of them must keep
 * loading, because they are what users keep as backups:
 *
 * - `mindtero.backup`   — "Backup (all boards)" from the gallery
 * - `mindtero.autosave` — the desktop project file (`mindtero-boards.json`)
 * - `mindtero.board`    — "Export → Board as JSON" and per-board desktop files
 * - a bare `Board`      — "Copy JSON to clipboard" from a board card
 */

export type BoardFileKind = 'backup' | 'autosave' | 'board' | 'plain'

/**
 * Node types whose height follows their content. A stored `height` would pin the
 * card to a fixed box, so text overflowed and the bottom connection handles ended
 * up in the middle of taller cards.
 */
export const AUTO_HEIGHT_TYPES = new Set<string>(['zoteroItem', 'note', 'richText', 'timeline', 'claim', 'question'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBoardLike(value: unknown): value is Board {
  return isRecord(value) && Array.isArray(value.nodes)
}

function normalizeNode(node: MindNode): MindNode {
  if (!AUTO_HEIGHT_TYPES.has(node.type ?? '')) return node
  if (node.height === undefined && node.style?.height === undefined) return node
  const { height: _height, style, ...rest } = node
  if (!style) return rest as MindNode
  const { height: _styleHeight, ...nextStyle } = style
  return { ...rest, style: nextStyle } as MindNode
}

/** Fills gaps in older or hand-edited boards so the app can rely on the shape. */
export function normalizeBoard(board: Board): Board {
  const timestamp = new Date().toISOString()
  return {
    ...board,
    name: typeof board.name === 'string' && board.name.trim() ? board.name : 'Untitled board',
    createdAt: board.createdAt ?? board.updatedAt ?? timestamp,
    updatedAt: board.updatedAt ?? board.createdAt ?? timestamp,
    nodes: (Array.isArray(board.nodes) ? board.nodes : []).map(normalizeNode),
    edges: Array.isArray(board.edges) ? board.edges : [],
    viewport: board.viewport ?? { x: 0, y: 0, zoom: 1 },
  }
}

/** Parses any Mindtero JSON file into boards. Throws a readable error otherwise. */
export function parseBoardsFile(text: string): { kind: BoardFileKind; boards: Board[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON')
  }
  if (!isRecord(parsed)) throw new Error('Not a Mindtero board file')

  if (parsed.format === 'mindtero.backup' || parsed.format === 'mindtero.autosave') {
    if (!Array.isArray(parsed.boards)) throw new Error('Backup contains no boards')
    return {
      kind: parsed.format === 'mindtero.backup' ? 'backup' : 'autosave',
      boards: parsed.boards.filter(isBoardLike).map(normalizeBoard),
    }
  }
  if (parsed.format === 'mindtero.board') {
    if (!isBoardLike(parsed.board)) throw new Error('Board file is missing nodes or edges')
    return { kind: 'board', boards: [normalizeBoard(parsed.board)] }
  }
  if (isBoardLike(parsed)) return { kind: 'plain', boards: [normalizeBoard(parsed)] }
  throw new Error('Not a Mindtero board file')
}

export const BOARD_FILE_VERSION = 1

export function serializeBoardFile(board: Board): string {
  return JSON.stringify(
    { format: 'mindtero.board', version: BOARD_FILE_VERSION, exportedAt: new Date().toISOString(), board },
    null,
    2,
  )
}

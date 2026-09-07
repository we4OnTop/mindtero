import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import type { Board, ItemNodeData, MindNode } from './types'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'board'
  )
}

export const BOARD_FILE_VERSION = 1

export function exportBoardJson(board: Board): void {
  const payload = {
    format: 'mindtero.board',
    version: BOARD_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    board,
  }
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `${slugify(board.name)}.mindtero.json`,
  )
}

export function parseBoardFile(text: string): Board {
  const parsed: unknown = JSON.parse(text)
  const candidate = parsed as { format?: string; board?: Board }
  if (candidate?.format !== 'mindtero.board' || !candidate.board) {
    throw new Error('Not a Mindtero board file')
  }
  const board = candidate.board
  if (!Array.isArray(board.nodes) || !Array.isArray(board.edges)) {
    throw new Error('Board file is missing nodes or edges')
  }
  return board
}

const PNG_WIDTH = 2400
const PNG_HEIGHT = 1600

/**
 * Renders the whole graph — not just the visible viewport — by re-framing a clone
 * of the React Flow viewport element to the bounds of all nodes.
 */
export async function exportBoardPng(board: Board, backgroundColor: string): Promise<void> {
  const viewportElement = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewportElement) throw new Error('Canvas is not mounted')
  if (board.nodes.length === 0) throw new Error('This board is empty')

  const bounds = getNodesBounds(board.nodes)
  const viewport = getViewportForBounds(bounds, PNG_WIDTH, PNG_HEIGHT, 0.2, 2, 0.08)

  const dataUrl = await toPng(viewportElement, {
    backgroundColor,
    width: PNG_WIDTH,
    height: PNG_HEIGHT,
    pixelRatio: 1,
    style: {
      width: `${PNG_WIDTH}px`,
      height: `${PNG_HEIGHT}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true
      return !node.classList.contains('react-flow__panel')
    },
  })

  const response = await fetch(dataUrl)
  downloadBlob(await response.blob(), `${slugify(board.name)}.png`)
}

/** Zotero item keys on the board, in reading order (top-left to bottom-right). */
export function boardItemKeys(nodes: MindNode[]): string[] {
  return nodes
    .filter((node) => node.type === 'zoteroItem')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((node) => (node.data as ItemNodeData).itemKey)
}

export function bibliographyHtml(board: Board, entries: string[]): string {
  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    `<title>${board.name} — bibliography</title>`,
    '<style>body{font-family:Georgia,serif;max-width:44rem;margin:3rem auto;line-height:1.6}',
    '.csl-entry{margin-bottom:0.9rem;padding-left:2rem;text-indent:-2rem}</style>',
    `<h1>${board.name}</h1>`,
    ...entries.filter(Boolean),
  ].join('\n')
}

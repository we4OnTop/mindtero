import { describe, expect, it } from 'vitest'
import { normalizeBoard, parseBoardsFile, serializeBoardFile } from './board-io'
import type { Board } from './types'

const board: Board = {
  id: 'b1',
  name: 'Thesis',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  nodes: [
    {
      id: 'note:1',
      type: 'note',
      position: { x: 0, y: 0 },
      data: { text: 'hi' },
      width: 357,
      height: 140,
      measured: { width: 357, height: 140 },
    },
    {
      id: 'frame:1',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: { label: 'Group' },
      width: 500,
      height: 300,
    },
  ],
  edges: [],
  viewport: { x: 10, y: 20, zoom: 1 },
}

describe('parseBoardsFile', () => {
  // These are the exact shapes older versions wrote; they must keep loading.
  it('reads gallery backups', () => {
    const text = JSON.stringify({ format: 'mindtero.backup', version: 1, exportedAt: '', boards: [board] })
    expect(parseBoardsFile(text)).toMatchObject({ kind: 'backup', boards: [{ id: 'b1', name: 'Thesis' }] })
  })

  it('reads the desktop autosave file', () => {
    const text = JSON.stringify({ format: 'mindtero.autosave', version: 1, savedAt: '', boards: [board, board] })
    expect(parseBoardsFile(text).boards).toHaveLength(2)
  })

  it('reads exported board files', () => {
    expect(parseBoardsFile(serializeBoardFile(board))).toMatchObject({ kind: 'board', boards: [{ id: 'b1' }] })
  })

  it('reads a raw board copied to the clipboard', () => {
    expect(parseBoardsFile(JSON.stringify(board))).toMatchObject({ kind: 'plain' })
  })

  it('rejects everything else with a readable message', () => {
    expect(() => parseBoardsFile('{')).toThrow('not valid JSON')
    expect(() => parseBoardsFile('{"format":"other"}')).toThrow('Not a Mindtero board file')
    expect(() => parseBoardsFile('{"format":"mindtero.backup"}')).toThrow('no boards')
  })
})

describe('normalizeBoard', () => {
  it('lets auto-height cards follow their content but keeps frame sizes', () => {
    const [note, frame] = normalizeBoard(board).nodes
    expect(note).not.toHaveProperty('height')
    expect(note!.width).toBe(357)
    expect(frame!.height).toBe(300)
  })

  it('fills missing fields of older boards', () => {
    const legacy = { id: 'x', nodes: [] } as unknown as Board
    const normalized = normalizeBoard(legacy)
    expect(normalized.edges).toEqual([])
    expect(normalized.name).toBe('Untitled board')
    expect(normalized.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

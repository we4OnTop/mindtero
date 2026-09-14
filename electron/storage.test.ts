import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const storage = require('./storage.cjs') as {
  saveWithBackup: (file: string, contents: string, options?: { now?: number; minGapMs?: number; keep?: number }) => { changed: boolean }
  createConfigStore: (file: string) => {
    get: () => { projectDir: string | null; boardFiles: Record<string, string>; rescueDone: boolean }
    update: (patch: object) => unknown
  }
}
const rescue = require('./rescue.cjs') as {
  boardsFromPersisted: (value: unknown) => { id: string; updatedAt: string }[]
  mergeNewest: (boards: { id: string; updatedAt: string }[]) => { id: string; updatedAt: string }[]
}

const dirs: string[] = []
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindtero-storage-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('saveWithBackup', () => {
  it('writes a new file without creating a backup', () => {
    const file = path.join(tempDir(), 'mindtero-boards.json')
    expect(storage.saveWithBackup(file, '{"a":1}')).toEqual({ changed: true })
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}')
    expect(fs.existsSync(path.join(path.dirname(file), 'backups'))).toBe(false)
  })

  it('backs up the previous version before replacing it', () => {
    const file = path.join(tempDir(), 'mindtero-boards.json')
    storage.saveWithBackup(file, 'first')
    storage.saveWithBackup(file, 'second')
    const backups = fs.readdirSync(path.join(path.dirname(file), 'backups'))
    expect(backups).toHaveLength(1)
    expect(fs.readFileSync(path.join(path.dirname(file), 'backups', backups[0]!), 'utf8')).toBe('first')
    expect(fs.readFileSync(file, 'utf8')).toBe('second')
  })

  it('skips identical content and throttles backups', () => {
    const file = path.join(tempDir(), 'mindtero-boards.json')
    storage.saveWithBackup(file, 'one')
    expect(storage.saveWithBackup(file, 'one')).toEqual({ changed: false })
    storage.saveWithBackup(file, 'two')
    storage.saveWithBackup(file, 'three')
    // The second overwrite falls inside the backup gap.
    expect(fs.readdirSync(path.join(path.dirname(file), 'backups'))).toHaveLength(1)
  })

  it('prunes old backups', () => {
    const file = path.join(tempDir(), 'mindtero-boards.json')
    const start = Date.UTC(2026, 0, 1)
    storage.saveWithBackup(file, 'v0')
    for (let index = 1; index <= 6; index += 1) {
      storage.saveWithBackup(file, `v${index}`, { now: start + index * 60_000, minGapMs: 0, keep: 3 })
    }
    expect(fs.readdirSync(path.join(path.dirname(file), 'backups')).length).toBeLessThanOrEqual(3)
    expect(fs.readFileSync(file, 'utf8')).toBe('v6')
  })

  it('leaves no temp files behind', () => {
    const dir = tempDir()
    storage.saveWithBackup(path.join(dir, 'x.json'), 'data')
    expect(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})

describe('createConfigStore', () => {
  it('persists updates and tolerates a missing or broken file', () => {
    const file = path.join(tempDir(), 'config.json')
    expect(storage.createConfigStore(file).get()).toEqual({ projectDir: null, boardFiles: {}, rescueDone: false })
    storage.createConfigStore(file).update({ projectDir: 'D:/Research', boardFiles: { b1: 'D:/b1.json' } })
    expect(storage.createConfigStore(file).get()).toMatchObject({ projectDir: 'D:/Research', boardFiles: { b1: 'D:/b1.json' } })
    fs.writeFileSync(file, '{broken')
    expect(storage.createConfigStore(file).get().projectDir).toBeNull()
  })
})

describe('rescue helpers', () => {
  it('reads boards from a zustand-persist payload', () => {
    const value = JSON.stringify({
      state: { boards: { a: { id: 'a', nodes: [], updatedAt: '1' }, junk: { id: 3 } }, order: ['a'] },
      version: 1,
    })
    expect(rescue.boardsFromPersisted(value).map((board) => board.id)).toEqual(['a'])
    expect(rescue.boardsFromPersisted('nope')).toEqual([])
    expect(rescue.boardsFromPersisted(null)).toEqual([])
  })

  it('keeps the newest copy of each board', () => {
    const merged = rescue.mergeNewest([
      { id: 'a', updatedAt: '2026-01-01' },
      { id: 'a', updatedAt: '2026-03-01' },
      { id: 'b', updatedAt: '2026-02-01' },
    ])
    expect(merged).toEqual([
      { id: 'a', updatedAt: '2026-03-01' },
      { id: 'b', updatedAt: '2026-02-01' },
    ])
  })
})

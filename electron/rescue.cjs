const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

/**
 * Recovers boards stranded in old IndexedDB origins.
 *
 * Until the shell pinned its port, every launch served the app from a random
 * `http://127.0.0.1:<port>` origin. IndexedDB is partitioned per origin, so each
 * launch started with an empty board store and the previous boards stayed behind
 * in `<userData>/IndexedDB/http_127.0.0.1_<port>.indexeddb.leveldb`.
 *
 * Chromium only lets a page of the *same origin* read that data, so for every old
 * port this briefly serves a tiny read-only page on that port, loads it in a
 * hidden window and collects `mindtero.boards` from idb-keyval's store. Nothing
 * is ever written to the old databases.
 */

const ORIGIN_DIR = /^http_127\.0\.0\.1_(\d+)\.indexeddb\.leveldb$/
const PER_ORIGIN_TIMEOUT_MS = 8000

const RESCUE_HTML =
  '<!doctype html><meta charset="utf-8"><title>rescue</title><script src="/rescue.js"></script>'

// Uses indexedDB.databases() first so an origin without the store is never
// given a fresh empty database as a side effect of looking.
const RESCUE_JS = `
(async () => {
  const send = (payload) => window.mindteroRescue.done(payload)
  try {
    const known = await indexedDB.databases()
    if (!known.some((entry) => entry.name === 'keyval-store')) return send({ ok: true, value: null })
    const request = indexedDB.open('keyval-store')
    request.onerror = () => send({ ok: false, error: String(request.error) })
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('keyval')) { db.close(); return send({ ok: true, value: null }) }
      const get = db.transaction('keyval', 'readonly').objectStore('keyval').get('mindtero.boards')
      get.onerror = () => { db.close(); send({ ok: false, error: String(get.error) }) }
      get.onsuccess = () => { db.close(); send({ ok: true, value: get.result ?? null }) }
    }
  } catch (error) {
    send({ ok: false, error: String(error) })
  }
})()
`

/** Old origins, newest first. */
function listOldOrigins(userDataDir, currentPort) {
  const dir = path.join(userDataDir, 'IndexedDB')
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .map((name) => {
      const match = ORIGIN_DIR.exec(name)
      if (!match) return null
      const port = Number(match[1])
      if (port === currentPort) return null
      let mtime = 0
      try {
        mtime = fs.statSync(path.join(dir, name)).mtimeMs
      } catch {
        // ignore
      }
      return { port, mtime }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
}

/** Extracts the boards array from a zustand-persist JSON string. */
function boardsFromPersisted(value) {
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    const boards = parsed?.state?.boards
    if (!boards || typeof boards !== 'object') return []
    return Object.values(boards).filter(
      (board) => board && typeof board.id === 'string' && Array.isArray(board.nodes),
    )
  } catch {
    return []
  }
}

/** Keeps the most recently updated copy of each board id. */
function mergeNewest(boards) {
  const byId = new Map()
  for (const board of boards) {
    const previous = byId.get(board.id)
    if (!previous || String(board.updatedAt ?? '') > String(previous.updatedAt ?? '')) {
      byId.set(board.id, board)
    }
  }
  return [...byId.values()]
}

function listen(server, port) {
  return new Promise((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => resolve(true))
  })
}

async function readOrigin(BrowserWindow, preload, port) {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0]
    if (url === '/rescue.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' })
      res.end(RESCUE_JS)
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'",
    })
    res.end(RESCUE_HTML)
  })
  // The port may belong to another program by now; that origin is simply skipped.
  if (!(await listen(server, port))) return []

  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  try {
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), PER_ORIGIN_TIMEOUT_MS)
      win.webContents.ipc.once('mindtero:rescueResult', (_event, payload) => {
        clearTimeout(timer)
        resolve(payload)
      })
      win.loadURL(`http://127.0.0.1:${port}/`).catch(() => {
        clearTimeout(timer)
        resolve({ ok: false, error: 'load failed' })
      })
    })
    return result?.ok ? boardsFromPersisted(result.value) : []
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await new Promise((resolve) => server.close(() => resolve()))
  }
}

/** Collects every board found in old origins, newest copy per board id. */
async function rescueBoards({ BrowserWindow, userDataDir, currentPort, preload }) {
  const found = []
  const origins = listOldOrigins(userDataDir, currentPort)
  for (const origin of origins) {
    try {
      found.push(...(await readOrigin(BrowserWindow, preload, origin.port)))
    } catch {
      // One unreadable origin must not stop the others.
    }
  }
  return { scanned: origins.length, boards: mergeNewest(found) }
}

module.exports = { boardsFromPersisted, listOldOrigins, mergeNewest, rescueBoards }

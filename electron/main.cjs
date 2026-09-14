const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { resolveStaticPath } = require('./static-path.cjs')
const { serveZoteroFile } = require('./zotero-file.cjs')
const { rescueBoards } = require('./rescue.cjs')
const {
  AUTOSAVE_FILE_NAME,
  createConfigStore,
  saveWithBackup,
} = require('./storage.cjs')

/**
 * Mindtero desktop shell (base).
 * - Dev: loads the Vite dev server at http://localhost:5273
 * - Prod: serves ./dist over a local port and proxies /zotero-api to Zotero,
 *   so the renderer code needs no changes (same relative API path as Vite).
 * - Autosave: renderer IPC writes a full boards snapshot into the project folder
 *   (default <Documents>/Mindtero Projects/mindtero-boards.json, user-selectable)
 *   so drawings live in a real file, not only in the webview's IndexedDB. Boards
 *   can additionally be mirrored into their own file at a user-chosen path.
 */
const PROJECT_DIR_NAME = 'Mindtero Projects'
const ZOTERO_TARGET = process.env.ZOTERO_TARGET ?? 'http://127.0.0.1:23119'

/**
 * IndexedDB and localStorage are scoped to the origin *including the port*, so a
 * random port per launch silently started every session with empty storage. The
 * shell now prefers one fixed port and only falls back to a random one when that
 * port is taken (the project file still restores the boards in that case).
 */
const PREFERRED_PORT = 47813

/** Schemes the renderer may hand to the OS. Everything else is dropped. */
const EXTERNAL_PROTOCOLS = new Set(['zotero:', 'https:', 'http:', 'mailto:'])

/**
 * The renderer only ever talks to itself and to Zotero through the local
 * /zotero-api proxy, so everything else is denied. `data:`/`blob:` cover PDF
 * page snapshots, pasted images and the pdf.js worker.
 *
 * This lives as a response header rather than a <meta> tag in index.html so it
 * applies to the packaged app only — a meta CSP would also hit `npm run dev`,
 * where Vite injects an inline module preamble for React Fast Refresh.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/** Origin the main window is served from; IPC from anywhere else is ignored. */
let appOrigin = null
let appPort = null
let mainWindow = null

function listenOn(server, port) {
  return new Promise((resolve) => {
    const onError = () => resolve(null)
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError)
      resolve(server.address().port)
    })
  })
}

function startStaticServer(distDir) {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  }

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/zotero-api/')) {
      // Attachment binaries need special handling: Zotero redirects to file://.
      if (serveZoteroFile(req, res, ZOTERO_TARGET)) return

      const target = new URL(req.url.replace(/^\/zotero-api/, ''), ZOTERO_TARGET)
      // Zotero's httpd.js parses strictly: forwarding hop headers (or an
      // accept-encoding it mishandles) makes it reject the request. Strip what
      // belongs to the original hop only.
      const headers = { ...req.headers }
      delete headers.connection
      delete headers['content-length']
      delete headers['transfer-encoding']
      // Zotero's httpd.js drops connections that carry a browser-like
      // User-Agent (connector-abuse guard). Renderer UAs are useless here.
      delete headers['user-agent']
      delete headers['accept-encoding']
      delete headers['if-none-match']
      delete headers.host
      headers.host = target.host // host with port, like Vite's changeOrigin

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const upstream = http.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: target.pathname + target.search,
          method: req.method,
          headers,
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
          upstreamRes.pipe(res)
        },
      )
      upstream.on('error', () => {
        res.writeHead(502)
        res.end('Zotero is not reachable')
      })
      if (hasBody) {
        req.pipe(upstream)
      } else {
        upstream.end()
      }
      return
    }

    let filePath = resolveStaticPath(distDir, req.url)
    if (filePath === null) {
      res.writeHead(403)
      res.end()
      return
    }
    fs.stat(filePath, (statError, stat) => {
      if (statError || stat.isDirectory()) {
        filePath = path.join(distDir, 'index.html')
      }
      const stream = fs.createReadStream(filePath)
      stream.on('error', () => res.end())
      res.writeHead(200, {
        'Content-Type': mime[path.extname(filePath)] ?? 'application/octet-stream',
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        'X-Content-Type-Options': 'nosniff',
      })
      stream.pipe(res)
    })
  })

  // Binding directly (instead of probing a port and re-binding) leaves no window
  // in which another process could grab the port between the two steps.
  return listenOn(server, PREFERRED_PORT).then((port) => port ?? listenOn(server, 0))
}

/* ------------------------------------------------------------------ storage */

let configStore = null

function config() {
  if (!configStore) configStore = createConfigStore(path.join(app.getPath('userData'), 'mindtero-config.json'))
  return configStore
}

function defaultProjectDir() {
  return path.join(app.getPath('documents'), PROJECT_DIR_NAME)
}

function projectDir() {
  const chosen = config().get().projectDir
  return chosen && fs.existsSync(chosen) ? chosen : defaultProjectDir()
}

function autosavePath() {
  const dir = projectDir()
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, AUTOSAVE_FILE_NAME)
}

function storageInfo() {
  const current = config().get()
  return {
    projectDir: projectDir(),
    defaultProjectDir: defaultProjectDir(),
    autosaveFile: autosavePath(),
    isDefault: projectDir() === defaultProjectDir(),
    boardFiles: current.boardFiles,
    rescueDone: current.rescueDone,
  }
}

function isTrustedSender(event) {
  const url = event.senderFrame?.url
  if (!url || !appOrigin) return false
  try {
    return new URL(url).origin === appOrigin
  } catch {
    return false
  }
}

/** Registers an invoke handler that ignores frames not served by this app. */
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    return listener(event, ...args)
  })
}

function safeFileName(name) {
  const cleaned = String(name ?? '')
    .replace(/[<>:"/\\|?*]+|\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'board'
}

function registerIpc() {
  handle('mindtero:autoSave', (_event, json) => {
    try {
      if (typeof json !== 'string') throw new Error('Invalid payload')
      const file = autosavePath()
      saveWithBackup(file, json)
      return { ok: true, path: file }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  })

  // Synchronous flavour for the window's unload handler, where an async
  // invoke would be torn down before it reaches the main process.
  ipcMain.on('mindtero:autoSaveSync', (event, json) => {
    if (!isTrustedSender(event) || typeof json !== 'string') {
      event.returnValue = { ok: false }
      return
    }
    try {
      saveWithBackup(autosavePath(), json)
      event.returnValue = { ok: true }
    } catch (error) {
      event.returnValue = { ok: false, error: String(error) }
    }
  })

  handle('mindtero:loadAutosave', () => {
    try {
      const file = autosavePath()
      if (!fs.existsSync(file)) return { ok: false, error: 'not-found', path: file }
      return { ok: true, json: fs.readFileSync(file, 'utf8'), path: file }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  })

  handle('mindtero:autosavePath', () => autosavePath())
  handle('mindtero:storageInfo', () => storageInfo())

  handle('mindtero:revealAutosave', () => {
    shell.showItemInFolder(autosavePath())
  })

  handle('mindtero:chooseProjectDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose where Mindtero saves your boards',
      defaultPath: projectDir(),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    config().update({ projectDir: result.filePaths[0] })
    return storageInfo()
  })

  handle('mindtero:resetProjectDir', () => {
    config().update({ projectDir: null })
    return storageInfo()
  })

  handle('mindtero:chooseBoardFile', async (_event, boardId, boardName) => {
    if (typeof boardId !== 'string') return null
    const current = config().get().boardFiles[boardId]
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save this board to a file',
      defaultPath: current ?? path.join(projectDir(), `${safeFileName(boardName)}.mindtero.json`),
      filters: [{ name: 'Mindtero board', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    config().update({ boardFiles: { ...config().get().boardFiles, [boardId]: result.filePath } })
    return storageInfo()
  })

  handle('mindtero:clearBoardFile', (_event, boardId) => {
    const { [boardId]: _removed, ...rest } = config().get().boardFiles
    config().update({ boardFiles: rest })
    return storageInfo()
  })

  handle('mindtero:saveBoardFile', (_event, boardId, json) => {
    // The path is looked up here, never taken from the renderer.
    const file = config().get().boardFiles[boardId]
    if (!file || typeof json !== 'string') return { ok: false, error: 'no-file' }
    try {
      saveWithBackup(file, json)
      return { ok: true, path: file }
    } catch (error) {
      return { ok: false, error: String(error), path: file }
    }
  })

  handle('mindtero:loadBoardFiles', () =>
    Object.entries(config().get().boardFiles).map(([boardId, file]) => {
      try {
        return { boardId, path: file, json: fs.readFileSync(file, 'utf8') }
      } catch (error) {
        return { boardId, path: file, error: String(error) }
      }
    }),
  )

  handle('mindtero:revealBoardFile', (_event, boardId) => {
    const file = config().get().boardFiles[boardId]
    if (file) shell.showItemInFolder(file)
  })

  handle('mindtero:openExternal', (_event, url) => openExternalSafely(url))

  handle('mindtero:rescueBoards', async () => {
    if (!appPort) return { scanned: 0, boards: [] }
    const result = await rescueBoards({
      BrowserWindow,
      userDataDir: app.getPath('userData'),
      currentPort: appPort,
      preload: path.join(__dirname, 'rescue-preload.cjs'),
    })
    config().update({ rescueDone: true })
    return result
  })

  handle('mindtero:markRescueDone', () => {
    config().update({ rescueDone: true })
  })
}

function openExternalSafely(url) {
  try {
    const parsed = new URL(String(url))
    if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false
    void shell.openExternal(parsed.toString())
    return true
  } catch {
    return false
  }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'Mindtero',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only needs contextBridge + ipcRenderer, both of which
      // survive sandboxing — so there is no reason to drop the OS sandbox.
      sandbox: true,
    },
  })
  mainWindow = win

  // Electron 44 moved this hook from BrowserWindow to WebContents.
  if (typeof win.webContents.setWindowOpenHandler !== 'function') {
    console.error(
      'Broken Electron runtime: window APIs unavailable. ' +
        'Check the electron version and require("electron") resolution.',
    )
    app.quit()
    return
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })

  // Plain <a href="zotero://…"> clicks navigate the window itself. Keep the app
  // where it is and hand allowed schemes to the OS instead.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (appOrigin && new URL(url).origin === appOrigin) return
    } catch {
      // fall through
    }
    event.preventDefault()
    openExternalSafely(url)
  })

  const devUrl = process.env.MINDTERO_DEV_URL
  if (devUrl) {
    // Optional live-reload mode: electron shell talking to a running Vite.
    appOrigin = new URL(devUrl).origin
    await win.loadURL(devUrl)
  } else {
    const distDir = path.join(__dirname, '..', 'dist')
    const port = await startStaticServer(distDir)
    appPort = port
    appOrigin = `http://127.0.0.1:${port}`
    await win.loadURL(`${appOrigin}/`)
  }
}

// Two instances would each autosave their own view of the boards into the same
// file, so the second launch just focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    registerIpc()
    void createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

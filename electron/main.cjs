const { app, BrowserWindow, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

/**
 * Mindtero desktop shell (base).
 * - Dev: loads the Vite dev server at http://localhost:5273
 * - Prod: serves ./dist over a local port and proxies /zotero-api to Zotero,
 *   so the renderer code needs no changes (same relative API path as Vite).
 * - Autosave: renderer IPC writes a full boards snapshot into
 *   <Documents>/Mindtero/boards.autosave.json so drawings live in a real
 *   project folder, not only in the webview's IndexedDB.
 */
const PROJECT_DIR_NAME = 'Mindtero Projects'
const ZOTERO_TARGET = process.env.ZOTERO_TARGET ?? 'http://127.0.0.1:23119'

function startStaticServer(distDir) {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  }

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/zotero-api/')) {
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

    const requestPath = req.url?.split('?')[0] ?? '/'
    let filePath = path.join(distDir, requestPath === '/' ? 'index.html' : requestPath)
    if (!filePath.toLowerCase().startsWith(distDir.toLowerCase())) {
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
      })
      stream.pipe(res)
    })
  })

  // Pick a free port so a stale instance cannot block startup.
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port
      probe.close(() => {
        server.listen(port, '127.0.0.1', () => resolve(port))
      })
    })
  })
}

function autosavePath() {
  const documents = app.getPath('documents')
  const dir = path.join(documents, PROJECT_DIR_NAME)
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'mindtero-boards.json')
}

function registerIpc() {
  ipcMain.handle('mindtero:autoSave', (_event, json) => {
    try {
      fs.writeFileSync(autosavePath(), json, 'utf8')
      return { ok: true, path: autosavePath() }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('mindtero:loadAutosave', () => {
    try {
      const file = autosavePath()
      if (!fs.existsSync(file)) return { ok: false, error: 'not-found' }
      return { ok: true, json: fs.readFileSync(file, 'utf8'), path: file }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('mindtero:autosavePath', () => autosavePath())

  ipcMain.handle('mindtero:revealAutosave', () => {
    shell.showItemInFolder(autosavePath())
  })
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
      sandbox: false,
    },
  })

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
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.MINDTERO_DEV_URL
  if (devUrl) {
    // Optional live-reload mode: electron shell talking to a running Vite.
    await win.loadURL(devUrl)
  } else {
    const distDir = path.join(__dirname, '..', 'dist')
    const port = await startStaticServer(distDir)
    await win.loadURL(`http://127.0.0.1:${port}/`)
  }
}

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

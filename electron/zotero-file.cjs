const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

/**
 * Serves Zotero attachment binaries behind `/zotero-api/.../items/<key>/file`.
 *
 * Zotero's local API does not stream the file itself: it answers with a 302 to a
 * `file:///…` URL. A web page cannot follow that redirect (fetch refuses to cross
 * from http: into file:), which is why rendering PDF pages failed. So the proxy
 * asks Zotero for the file URL via `/file/view/url` and streams the file from
 * disk instead.
 *
 * Only the item key comes from the renderer — the path on disk is whatever
 * Zotero reports for that attachment — and only PDFs and images are served.
 * Shared by the Electron shell and the Vite dev/preview servers.
 */

const FILE_ROUTE = /^\/zotero-api\/api\/(users|groups)\/(\d+)\/items\/([A-Z0-9]{8})\/file\/?$/

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/** Parses the request path; null when it is not an attachment-file request. */
function matchZoteroFileRequest(requestUrl) {
  const pathname = (requestUrl ?? '').split('?')[0].split('#')[0]
  const match = FILE_ROUTE.exec(pathname)
  if (!match) return null
  return { scope: match[1], libraryId: match[2], itemKey: match[3] }
}

/** Turns Zotero's `file:` URL into a local path, rejecting anything else. */
function attachmentPathFromUrl(fileUrl) {
  let url
  try {
    url = new URL(String(fileUrl).trim())
  } catch {
    return null
  }
  if (url.protocol !== 'file:') return null
  const filePath = fileURLToPath(url)
  const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()]
  return type ? { filePath, contentType: type } : null
}

function requestFileUrl(zoteroTarget, { scope, libraryId, itemKey }) {
  const target = new URL(`/api/${scope}/${libraryId}/items/${itemKey}/file/view/url`, zoteroTarget)
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: 'GET',
        // No User-Agent: Zotero's connector-abuse guard drops browser-like ones.
        headers: { host: target.host, 'Zotero-API-Version': '3' },
        timeout: 8000,
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
          if (body.length > 8192) request.destroy(new Error('Unexpected response from Zotero'))
        })
        response.on('end', () => resolve({ status: response.statusCode ?? 502, body }))
      },
    )
    request.on('timeout', () => request.destroy(new Error('Zotero did not respond')))
    request.on('error', reject)
    request.end()
  })
}

function sendText(res, status, message) {
  if (res.headersSent) return res.end()
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(message)
}

/**
 * Handles the request when it targets an attachment file and returns true;
 * returns false (synchronously) so the caller can fall through otherwise.
 */
function serveZoteroFile(req, res, zoteroTarget) {
  const match = matchZoteroFileRequest(req.url)
  if (!match) return false
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed')
    return true
  }

  requestFileUrl(zoteroTarget, match)
    .then(({ status, body }) => {
      if (status !== 200) {
        sendText(res, status === 404 ? 404 : 502, body.slice(0, 200) || 'Attachment not available')
        return
      }
      const resolved = attachmentPathFromUrl(body)
      if (!resolved) {
        sendText(res, 415, 'Only PDF and image attachments can be opened')
        return
      }
      fs.stat(resolved.filePath, (error, stat) => {
        if (error || !stat.isFile()) {
          sendText(res, 404, 'The attachment file is missing on disk')
          return
        }
        res.writeHead(200, {
          'Content-Type': resolved.contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        const stream = fs.createReadStream(resolved.filePath)
        stream.on('error', () => res.destroy())
        stream.pipe(res)
      })
    })
    .catch((error) => sendText(res, 502, `Zotero is not reachable (${error.message})`))
  return true
}

module.exports = { attachmentPathFromUrl, matchZoteroFileRequest, serveZoteroFile }

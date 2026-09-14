import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { attachmentPathFromUrl, matchZoteroFileRequest, serveZoteroFile } = require('./zotero-file.cjs') as {
  attachmentPathFromUrl: (url: string) => { filePath: string; contentType: string } | null
  matchZoteroFileRequest: (url: string) => { scope: string; libraryId: string; itemKey: string } | null
  serveZoteroFile: (req: http.IncomingMessage, res: http.ServerResponse, target: string) => boolean
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)),
  )
}

describe('matchZoteroFileRequest', () => {
  it('matches attachment file paths for users and groups', () => {
    expect(matchZoteroFileRequest('/zotero-api/api/users/0/items/8X8PA45H/file')).toEqual({
      scope: 'users',
      libraryId: '0',
      itemKey: '8X8PA45H',
    })
    expect(matchZoteroFileRequest('/zotero-api/api/groups/12/items/ABCD1234/file?x=1')?.scope).toBe('groups')
  })

  it('ignores everything else', () => {
    expect(matchZoteroFileRequest('/zotero-api/api/users/0/items/8X8PA45H')).toBeNull()
    expect(matchZoteroFileRequest('/zotero-api/api/users/0/items/../file')).toBeNull()
    expect(matchZoteroFileRequest('/zotero-api/api/users/0/items/8X8PA45H/file/view/url')).toBeNull()
  })
})

describe('attachmentPathFromUrl', () => {
  it('accepts file: URLs to PDFs and images only', () => {
    const pdf = path.resolve('/tmp/paper.pdf')
    expect(attachmentPathFromUrl(pathToFileURL(pdf).href)).toEqual({ filePath: pdf, contentType: 'application/pdf' })
    expect(attachmentPathFromUrl(pathToFileURL(path.resolve('/tmp/notes.exe')).href)).toBeNull()
    expect(attachmentPathFromUrl('https://example.com/paper.pdf')).toBeNull()
    expect(attachmentPathFromUrl('not a url')).toBeNull()
  })
})

describe('serveZoteroFile (against a fake Zotero)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindtero-zotero-'))
  const pdfPath = path.join(dir, 'paper.pdf')
  const pdfBytes = Buffer.from('%PDF-1.7\n% fake pdf body\n')
  let zotero: http.Server
  let proxy: http.Server
  let proxyUrl = ''

  beforeAll(async () => {
    fs.writeFileSync(pdfPath, pdfBytes)
    fs.writeFileSync(path.join(dir, 'script.sh'), 'echo')
    // Mirrors Zotero 7's ItemFile endpoint: /file redirects, /file/view/url returns the URL.
    zotero = http.createServer((req, res) => {
      const url = req.url ?? ''
      if (url === '/api/users/0/items/PDFKEY01/file/view/url') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(pathToFileURL(pdfPath).href)
      } else if (url === '/api/users/0/items/SHKEY001/file/view/url') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(pathToFileURL(path.join(dir, 'script.sh')).href)
      } else if (url === '/api/users/0/items/GONE0001/file/view/url') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(pathToFileURL(path.join(dir, 'missing.pdf')).href)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    const zoteroUrl = await listen(zotero)
    proxy = http.createServer((req, res) => {
      if (!serveZoteroFile(req, res, zoteroUrl)) {
        res.writeHead(418)
        res.end()
      }
    })
    proxyUrl = await listen(proxy)
  })

  afterAll(() => {
    zotero.close()
    proxy.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('streams the PDF that Zotero points to', async () => {
    const response = await fetch(`${proxyUrl}/zotero-api/api/users/0/items/PDFKEY01/file`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await response.arrayBuffer()).equals(pdfBytes)).toBe(true)
  })

  it('refuses non-PDF/image attachments', async () => {
    const response = await fetch(`${proxyUrl}/zotero-api/api/users/0/items/SHKEY001/file`)
    expect(response.status).toBe(415)
  })

  it('reports missing files and unknown items', async () => {
    expect((await fetch(`${proxyUrl}/zotero-api/api/users/0/items/GONE0001/file`)).status).toBe(404)
    expect((await fetch(`${proxyUrl}/zotero-api/api/users/0/items/NOPE0001/file`)).status).toBe(404)
  })

  it('passes unrelated requests through', async () => {
    expect((await fetch(`${proxyUrl}/zotero-api/api/users/0/items/top`)).status).toBe(418)
  })
})

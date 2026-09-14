import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveStaticPath } = require('./static-path.cjs') as {
  resolveStaticPath: (distDir: string, requestUrl: string | undefined) => string | null
}

const DIST = path.resolve('/srv/app/dist')

describe('resolveStaticPath', () => {
  it('serves index.html at the root', () => {
    expect(resolveStaticPath(DIST, '/')).toBe(path.join(DIST, 'index.html'))
  })

  it('resolves normal assets and ignores the query string', () => {
    expect(resolveStaticPath(DIST, '/assets/app.js?v=2')).toBe(path.join(DIST, 'assets', 'app.js'))
  })

  it.each([
    ['plain traversal', '/../package.json'],
    ['nested traversal', '/assets/../../package.json'],
    ['percent-encoded traversal', '/%2e%2e/%2e%2e/package.json'],
    ['double-encoded separator', '/..%2f..%2fpackage.json'],
    ['absolute windows path', '/C:/Windows/System32/drivers/etc/hosts'],
  ])('rejects %s', (_label, url) => {
    expect(resolveStaticPath(DIST, url)).toBeNull()
  })

  it('rejects a sibling directory that merely shares the prefix', () => {
    // A bare startsWith(distDir) check would have let this through.
    expect(resolveStaticPath(DIST, '/../dist-backup/secret.txt')).toBeNull()
  })

  it('rejects malformed percent-encoding instead of throwing', () => {
    expect(resolveStaticPath(DIST, '/%ZZ')).toBeNull()
  })

  it('rejects NUL bytes', () => {
    expect(resolveStaticPath(DIST, '/index.html%00.png')).toBeNull()
  })
})

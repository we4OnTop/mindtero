const path = require('node:path')

/**
 * Resolves a request URL to a file inside `distDir`, or null when it escapes.
 *
 * Kept separate from main.cjs so it can be unit tested without booting Electron.
 * Two things matter here: the path is percent-decoded before the check (an
 * encoded `%2e%2e%2f` must not slip past a raw-string comparison), and the
 * containment test compares against distDir *with* a trailing separator, since
 * a bare prefix test would also accept a sibling like `<dist>-backup`.
 */
function resolveStaticPath(distDir, requestUrl) {
  let requestPath
  try {
    requestPath = decodeURIComponent((requestUrl ?? '/').split('?')[0].split('#')[0])
  } catch {
    return null
  }
  // A URL path for a bundled asset never contains any of these. Backslashes and
  // colons matter on Windows in particular: a colon addresses an NTFS alternate
  // data stream, and a drive letter turns the join into a nonsense path that
  // silently falls through to the SPA fallback instead of a clean 403.
  if (/[\0\\:]/.test(requestPath)) return null

  const root = path.resolve(distDir)
  const filePath = path.resolve(root, '.' + (requestPath === '/' ? '/index.html' : requestPath))
  const prefix = root + path.sep
  if (filePath !== root && !filePath.toLowerCase().startsWith(prefix.toLowerCase())) return null
  return filePath
}

module.exports = { resolveStaticPath }

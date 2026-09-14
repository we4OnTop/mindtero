const fs = require('node:fs')
const path = require('node:path')

/**
 * File-system side of Mindtero's persistence, kept free of Electron imports so
 * it can be unit tested against a temp directory.
 *
 * Two rules matter more than anything else here, because these files are the
 * only copy of a user's boards that survives outside the webview:
 *
 * 1. Writes are atomic (write a sibling temp file, then rename), so a crash or a
 *    full disk mid-write never leaves a truncated JSON behind.
 * 2. Before a file is replaced, the previous version is copied into `backups/`
 *    (throttled, with a bounded history), so an accidental wipe is recoverable.
 */

const AUTOSAVE_FILE_NAME = 'mindtero-boards.json'
const BACKUP_DIR_NAME = 'backups'
const BACKUP_MIN_GAP_MS = 10 * 60 * 1000
const BACKUP_KEEP = 30

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeFileAtomic(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, contents, 'utf8')
  try {
    fs.renameSync(temp, file)
  } catch (error) {
    fs.rmSync(temp, { force: true })
    throw error
  }
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/**
 * Copies `file` into `<dir>/backups/` unless a backup of the same file was taken
 * less than `minGapMs` ago, then prunes to the newest `keep` backups of that file.
 */
function backupBeforeOverwrite(file, { now = Date.now(), minGapMs = BACKUP_MIN_GAP_MS, keep = BACKUP_KEEP } = {}) {
  if (!fs.existsSync(file)) return null
  const dir = path.join(path.dirname(file), BACKUP_DIR_NAME)
  const base = path.basename(file, '.json')
  fs.mkdirSync(dir, { recursive: true })

  const existing = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${base}-`) && name.endsWith('.json'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  if (existing[0] && now - existing[0].mtime < minGapMs) return null

  const target = path.join(dir, `${base}-${timestamp(new Date(now))}.json`)
  fs.copyFileSync(file, target)
  for (const stale of [{ name: path.basename(target) }, ...existing].slice(keep)) {
    fs.rmSync(path.join(dir, stale.name), { force: true })
  }
  return target
}

/** Replaces `file` with `contents`, keeping a throttled backup of what was there. */
function saveWithBackup(file, contents, options) {
  let previous = null
  try {
    previous = fs.readFileSync(file, 'utf8')
  } catch {
    // No previous file: nothing to back up.
  }
  if (previous === contents) return { changed: false }
  if (previous !== null) backupBeforeOverwrite(file, options)
  writeFileAtomic(file, contents)
  return { changed: true }
}

/**
 * The persisted desktop configuration. Board file paths live here (in the main
 * process) rather than in board data, so the renderer can only ever write to a
 * path the user picked in a native dialog.
 */
function createConfigStore(configFile) {
  const load = () => {
    const raw = readJson(configFile, {})
    return {
      projectDir: typeof raw.projectDir === 'string' ? raw.projectDir : null,
      boardFiles: raw.boardFiles && typeof raw.boardFiles === 'object' ? raw.boardFiles : {},
      rescueDone: raw.rescueDone === true,
    }
  }
  let config = load()
  return {
    get: () => config,
    update: (patch) => {
      config = { ...config, ...patch }
      writeFileAtomic(configFile, JSON.stringify(config, null, 2))
      return config
    },
  }
}

module.exports = {
  AUTOSAVE_FILE_NAME,
  BACKUP_DIR_NAME,
  backupBeforeOverwrite,
  createConfigStore,
  readJson,
  saveWithBackup,
  writeFileAtomic,
}

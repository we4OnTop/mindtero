const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

/**
 * Launches the real Electron runtime for this project.
 *
 * ELECTRON_RUN_AS_NODE must be stripped from the child environment: some host
 * terminals (VS Code & friends) export it, which turns electron.exe into a
 * plain Node process — require('electron') then resolves to the npm shim and
 * returns the executable *path string* instead of the API object.
 */
function main() {
  const distDir = path.join(__dirname, '..', 'dist')
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('dist/ is missing — run "npm run build" first.')
    process.exit(1)
  }

  const electron = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const args = process.argv.slice(2)
  if (args.length === 0) args.push('.')

  const child = spawn(electron, args, { env, stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}

main()

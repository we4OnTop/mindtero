import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

/**
 * Zotero's local HTTP API (Zotero 7+) does not emit CORS headers, so browser
 * requests must go through this dev-server proxy instead of hitting
 * http://127.0.0.1:23119 directly.
 *
 * Zotero's httpd.js additionally drops connections that carry a browser-like
 * `User-Agent` (connector-abuse guard), so the proxy strips it — the app
 * targets the relative path, so nothing upstream changes.
 */
const ZOTERO_TARGET = process.env.ZOTERO_TARGET ?? 'http://127.0.0.1:23119'

const proxyConfig = {
  target: ZOTERO_TARGET,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/zotero-api/, ''),
  configure: (proxy: { on: (event: 'proxyReq', listener: (proxyReq: { removeHeader(name: string): void }) => void) => void }) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.removeHeader('user-agent')
    })
  },
} satisfies ProxyOptions

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5273,
    proxy: {
      '/zotero-api': proxyConfig,
    },
  },
  preview: {
    port: 5273,
    proxy: {
      '/zotero-api': proxyConfig,
    },
  },
}))

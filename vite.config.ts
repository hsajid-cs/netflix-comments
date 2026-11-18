import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crx({
    manifest,
    // MAIN-world scripts cannot use the isolated world's extension module loader.
    contentScripts: { standaloneFiles: ['src/content/page-metadata.ts'] },
  })],
  server: {
    // crxjs needs a fixed port for its dev-server HMR client to reconnect to.
    port: 5173,
    strictPort: true,
  },
})

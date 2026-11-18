import { defineManifest } from '@crxjs/vite-plugin'
import packageJson from './package.json' with { type: 'json' }

const { version } = packageJson

export default defineManifest({
  manifest_version: 3,
  name: 'Netflix Comments',
  description: 'Adds a per-title discussion/comments panel while browsing or watching Netflix.',
  version,
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icons/icon16.png',
      48: 'public/icons/icon48.png',
      128: 'public/icons/icon128.png',
    },
  },
  background: {
    // Entry basename must stay distinct from the content script's
    // (`content-script.ts`) — @crxjs/vite-plugin cross-wires two entries that
    // share a basename, so `index.ts` for both breaks the build.
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.netflix.com/*'],
      js: ['src/content/page-metadata.ts'],
      world: 'MAIN',
      run_at: 'document_idle',
    },
    {
      matches: ['https://www.netflix.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage'],
  // http://localhost:3000/* is the dev comments backend the background
  // service worker fetches — update/add the deployed URL alongside
  // API_BASE_URL (src/shared/constants.ts) once the API is deployed.
  host_permissions: ['https://www.netflix.com/*', 'http://localhost:3000/*'],
})

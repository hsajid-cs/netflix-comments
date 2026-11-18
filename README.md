# Netflix Comments

A Chrome/Edge extension (Manifest V3) that adds episode and whole-series discussions to Netflix. Read as a guest, or create an app account to post, reply, like, disagree, edit, and delete your own comments. Accounts are independent of Netflix.

While watching, choose **This episode** or **Entire series**. Episode comments can include the current playback timestamp; series comments are untimed. Future comments and their replies are hidden behind a spoiler prompt until playback reaches that moment; timestamp buttons seek the player. Sort by newest or by moment, and jump to the discussion at your playback position. The panel remembers its open/minimized state.

The watch URL identifies the exact video. The extension first reads `netflix.appContext.state.playerApp.getAPI().getVideoMetadataByVideoId(watchId)` in the page world. It uses the current video's getters for names/numbers and matches the watch ID against the returned show's seasons/episodes to establish the parent series. The bootstrap Falcor cache can be empty for the current video; it and matching structured page metadata are fallbacks. Available names remain visible even if a series ID is missing, while the whole-series discussion stays disabled until that ID is known. The panel can show **S2 E3 · Episode name**. No explicit Netflix network requests are added.

These internal player shapes are used by [asbplayer](https://github.com/asbplayer/asbplayer/blob/main/extension/src/entrypoints/netflix-page.ts) and [netflix-subtitle-study](https://github.com/mivomad33/netflix-subtitle-study/blob/main/src/pages/Content/utils/dashboardHelper.ts); they are not a stable public API. Tests exercise those shapes but do not establish live Netflix compatibility. After rebuilding, reload the extension and refresh the Netflix tab. Filter its console for `[Netflix Comments] playback metadata` to see the detected public title fields or `unavailable`, then verify another episode. Diagnostic output is local and logged only when the result changes.

See [WORKFLOW.md](WORKFLOW.md) for the complete user flow, architecture, API, spoiler rules, and upgrade notes.

## Requirements

- Node.js 22.18+ (or a newer supported LTS) and npm
- PostgreSQL with permission to enable `pgcrypto`
- Chrome or Edge, with access to Netflix for in-page testing

## Run the API

Create a PostgreSQL database named `netflix_comments`, then:

```sh
cd server
npm install
cp .env.example .env
```

Set `DATABASE_URL` to your connection string and replace `JWT_SECRET` with a long random value in `server/.env`. Then run:

```sh
npm run migrate
npm run dev
```

The API listens at `http://localhost:3000` by default. `GET /health` returns `{ "status": "ok" }`. To build and run without watch mode, use `npm run build` followed by `npm start` from `server/`.

## Run the extension

From the project root, in a second terminal:

```sh
npm install
npm run dev
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this project's `dist/` directory. Keep Vite running during development. Open a Netflix title or watch page to see the panel. Use the extension toolbar popup to sign up or log in.

For a production extension build:

```sh
npm run build
```

Load the resulting `dist/` directory as an unpacked extension. If you change the API origin, update both `API_BASE_URL` in `src/shared/constants.ts` and `host_permissions` in `manifest.config.ts`, then rebuild/reload the extension.

## Checks

```sh
npm test
npm run lint
npm run build
npm run build --prefix server
npm test --prefix server
```

Tests use Node's built-in runner and cover discussion scopes, rendered spoiler masking, author controls, comment ordering, playback jump targets, nested reply lookup, reaction transitions, transaction cleanup, and API response/error/timeout handling. Backend tests mock the database pool; they do not validate SQL against a live PostgreSQL instance. They do not require a running database or Netflix session.

For browser verification, check guest reading, signup/login, episode/series switching, posting and replying, like/disagree switching, editing/deleting, newest/moment sorting, and playback timestamps. Test keyboard navigation and the **Show more** button in a long discussion. Stop the API to check error/retry states. A stalled request times out after 15 seconds and keeps the draft available to retry.

## Structure

- `src/content/` — Netflix navigation/playback detection; mounts the panel inside an isolated Shadow DOM.
- `src/ui/` — React panel, comment threads, composer, hooks, and typed messaging clients.
- `src/background/` — MV3 service worker; performs API calls and manages the stored app session.
- `src/popup/` — toolbar authentication and account activity.
- `src/shared/` — shared types, constants, and extension message contracts.
- `server/src/` — Express API, validation, authentication, services, and PostgreSQL repositories.
- `tests/` — regression tests for discussion behavior and API transport.

The UI requests backend operations through the service worker. API messages return user identity without the auth token. Sessions and panel preferences persist in extension storage.
"# netflix-comments" 

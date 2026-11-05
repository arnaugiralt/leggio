# AGENTS.md

Instructions for AI coding agents working on Leggio, and for developers who want a short overview of the code. Contributors should also read [CONTRIBUTING.md](CONTRIBUTING.md).

Three roles appear below. The reader is the person who uses Leggio. Your user is the contributor you work for. The maintainer decides what goes into the project.

Leggio is a read-only markdown reader for Chromium browsers. It is a Preact app bundled with esbuild, with no framework CLI, no router and no state library. The reader opens or drops a `.md` file or a folder and reads it.

## Commands

```sh
pnpm install                                # exact versions, install scripts disabled (.npmrc)
pnpm dev                                    # serves the repo on :8000, rebuilds dist/ on change, no hot reload (reload the page yourself)
pnpm test                                   # node --test, no browser
node --test test/render.test.js             # one file
node --test --test-name-pattern="mermaid"   # one test
pnpm build                                  # writes site/, the deployable folder
pnpm serve                                  # builds, then serves site/ on :8765
```

The project has no linter, no formatter and no typechecker.

To stop a dev server that was left running, use `lsof -ti tcp:8000 -sTCP:LISTEN | xargs kill`. The `-sTCP:LISTEN` filter matters, because other apps can hold client connections to port 8000.

## Hard limits

- **No editing, ever.** Leggio never writes, renames or deletes the reader's files. Don't add a feature that does.
- **No new dependencies without the maintainer's approval.** The project has 13 packages, counting indirect ones, all pinned to exact versions. Vite, the `mermaid` package, shiki and Tauri were each rejected because of how many packages they add. Diagrams use `beautiful-mermaid`, which is small. If a few lines of code can do the job, write the lines.
  - If you think a dependency is needed, stop and tell your user. Your user opens an issue, and the maintainer decides.
- **Leggio itself sends nothing about the reader's files.** No accounts, no analytics, no server code, no requests that carry file names or content. Three things do use the network: the Google Fonts stylesheets of some themes, web images that a document links to, and online voices. When the reader picks an online voice for read-aloud, the browser sends the text being read to that voice service, and the voice setting says so. Don't add other outside requests.

## Architecture

The table runs from the entry point to the build, in layers. Each row says what the file owns.

| File | What it owns |
| --- | --- |
| `src/main.jsx` | The entry point. Renders `App` and registers `sw.js`. |
| `src/App.jsx` | Layout, settings, drop and keyboard handling, the top bar and the notice slot. |
| `src/useLibrary.js` | What is open: the folder, pins, the current document, restore after reload, the live-reload watchers, files opened from the operating system, session history and `followLink`. Every action that opens something lives here. |
| `src/fs.js` | The File System Access API: pickers, permission, the markdown tree, `watch` and path helpers. Other files call methods on the handles it returns (`getFile`, `isSameEntry`, `resolve`), and `useLibrary.js` holds the `launchQueue` handler. |
| `src/idb.js` | `get` and `set` on one IndexedDB store, for `FileSystemHandle`s, which JSON can't hold. Failures resolve to `undefined`. |
| `src/speech.js` | Speaking: sentence splitting with `Intl.Segmenter`, the utterance queue and the voice list. It doesn't use the DOM, so it runs under node. `Settings.jsx` only listens for `voiceschanged` to refresh its voice picker. |
| `src/render.js` | One markdown-it instance (`html: false`), the highlight.js hook (9 languages), ```` ```mermaid ```` fences turned into inline SVG, heading ids, table wrappers. **Pure and synchronous: a string in, an HTML string out.** Anything that needs the DOM, a file handle or async work happens in `Viewer.jsx` after render. |
| `src/settings.js` | `DEFAULTS`, load and save to localStorage, CSS variables on `<html>`, the theme presets, font roles, the diagram theme, light or dark from the background. |
| `src/Viewer.jsx` | Puts the rendered HTML on the page, then resolves local images to blob URLs and marks internal links. |
| `src/Speech.jsx` | Everything on screen for read-aloud: walking the blocks, Ranges (browser objects that mark a span of text), the sentence and word highlights. |
| `src/Sidebar.jsx`, `Outline.jsx`, `Settings.jsx`, `icons.jsx` | Pins and folder tree; heading list with the active section; the settings form; inline SVG icons (Lucide paths). |
| `src/styles.css` | All styles. |
| `manifest.json`, `sw.js`, `_headers` | The installable app shell, the service worker, and the Cloudflare headers with the content security policy. |
| `build.mjs` | The dev server, and the production build into `site/`. |

## Rules that are easy to break

### Links and navigation

- Every local link goes through `followLink` in `useLibrary.js`. That covers relative links and root-relative links, which start with a single `/`, such as `/x`. `fs.isLocal` decides which links are local. Nothing may let a click navigate the window: the window would leave Leggio for the link target, and the reading session would be lost.
- A document resolves links and images against its own folder (`current.root`), not the folder shown in the sidebar.
- Local images render as `data-src`, never `src`, so the browser never asks the hosting server for the reader's file names. `Viewer.jsx` resolves them to blob URLs.

### History

- Every document open is a browser history entry. The document, file handles included, is stored in that entry's Navigation API state (browser storage tied to one history entry) with `navigation.updateCurrentEntry`, not in `history.state`, because Chrome drops a `history.state` that holds a handle on Back and Forward.
- Never call `history.replaceState`. It erases the Navigation API state of the entry.

### Permissions

- Permission prompts must come from a user gesture.
- `handleFromDrop` must be called synchronously inside the drop handler.
- One `useEffect` in `App.jsx`, with an empty dependency list, sets up `window.leggio`, the drop handler and the keyboard shortcuts. It runs once, so the state those handlers read never updates. To read current state in them, use a Preact ref such as `folderRef`. Don't add dependencies to that effect.

### Styles and themes

- Palette variables are `--color-bg`, `--color-fg`, `--color-accent` and `--color-code-bg`.
- Interface tokens are `--ui-*`, derived from the palette with `color-mix`.
- Never define root variables named `--bg`, `--fg`, `--line`, `--accent`, `--muted`, `--surface` or `--border`. beautiful-mermaid reads those names inside its SVG, and a root variable with the same name breaks every diagram color.
- Diagrams read `--diagram-*`, which `settings.js` sets.
- `.main` is a CSS size container, so its children can size themselves from its width. Width caps inside it use `cqw` (1% of that container's width), so they respect the open panels.
- While the look is Default, it follows the system light or dark setting (`followSystem` and `effective` in `settings.js`). Saved settings keep the light values, and the dark palette is applied on top.

### Layout

- Below 760 px (`NARROW` in `App.jsx`, and the same breakpoint in `styles.css`), the files panel is a drawer, the settings sheet is full width, and Read, Contents, Pin and Open move into the More menu.
- The page has one notice slot, at the top of `.main`. It shows the first of these that applies:
  1. A stated notice, such as an error or a deleted file.
  2. The folder offer.
  3. The install tip.

### Build and deploy

- The content security policy in `_headers` allows no inline scripts. Don't add an inline `<script>` to `index.html`. Put the code in a module under `src/`. `index.html` loads the bundle with an external script.
- `sw.js` and `build.mjs` both have a `SHELL` list because they serve different builds. The dev server uses `sw.js` as it is. The production build rewrites the `CACHE` and `SHELL` lines of `sw.js` with hashed file names. If you add a file the app needs offline, add it in three places: `SHELL` in `sw.js`, the `SHELL` array in `build.mjs`, and the copy list in `build.mjs` (the `for` loop that calls `fs.copyFileSync`).
- The site runs at leggio.compostela.dev as a Cloudflare Worker with static assets only (`wrangler.jsonc`, a custom domain), deployed by Workers Builds. The build command is `pnpm install --frozen-lockfile && pnpm test && pnpm build`, and the deploy command is `npx wrangler deploy`. Wrangler is not a project dependency. Never change the domain: an installed app is tied to its exact origin.

## Check your change

`pnpm test` covers only the modules with no user interface: `render`, `settings`, the speech queue, voice choice and sentence splitting in `speech`, and the path helpers in `fs`. Add or update a test when you change one of them.

Check everything else in a real browser, in a wide window and at about 390 px wide. Browser automation can't drive the native file pickers, so the app exposes `window.leggio = { openFolder, openFile, openFolderFor }`. Use a folder in the origin private file system (storage the browser keeps for the page, with no picker). Run this in the page:

```js
const dir = await navigator.storage.getDirectory()
const file = await dir.getFileHandle('a.md', { create: true })
const out = await file.createWritable()
await out.write('# Hello\n')
await out.close()
await window.leggio.openFolder(dir)
```

Changes to the interface and to the Default theme must work with the keyboard alone, with a visible focus ring, and keep text contrast at 4.5:1 or more.

## Working on a contribution

[CONTRIBUTING.md](CONTRIBUTING.md) has the full guide. These lines are the ones that apply to you.

- Keep the pull request to one change. Don't reformat code you didn't change.
- Match the surrounding style. Comments explain why, such as a browser behavior that isn't obvious or an alternative you rejected. Don't add comments that repeat what a line does.
- Commit messages start with `feat:`, `fix:`, `style:`, `refactor:`, `docs:` or `chore:`.
- Fill in `.github/pull_request_template.md`.
- Report only the checks you ran. If you didn't open the change in a browser, say so, so your user can do it before they submit.

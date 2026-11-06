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
| `src/fs.js` | The File System Access API: pickers, permission, the markdown tree, `watch` and path helpers. It also builds copies (see below). Other files never call methods on a handle; they use `fs.getFile`, `fs.isSame` and `fs.resolve`, which take both kinds. `useLibrary.js` holds the `launchQueue` handler. |
| `src/idb.js` | `get` and `set` on one IndexedDB store, for `FileSystemHandle`s, which JSON can't hold. Failures resolve to `undefined`. |
| `src/speech.js` | Speaking: sentence splitting with `Intl.Segmenter`, the utterance queue and the voice list. It doesn't use the DOM, so it runs under node. `Settings.jsx` only listens for `voiceschanged` to refresh its voice picker. |
| `src/share.js` | The share link: encodes a document into the `#share=` fragment and decodes it back. Pure, so it runs under node. |
| `src/render.js` | One markdown-it instance (`html: false`), the highlight.js hook (9 languages), ```` ```mermaid ```` fences turned into inline SVG, heading ids, table wrappers. **Pure and synchronous: a string in, an HTML string out.** Anything that needs the DOM, a file handle or async work happens in `Viewer.jsx` after render. |
| `src/settings.js` | `DEFAULTS`, load and save to localStorage, CSS variables on `<html>`, the theme presets, font roles, the diagram theme, light or dark from the background. |
| `src/Viewer.jsx` | Puts the rendered HTML on the page, then resolves local images to blob URLs and marks internal links. In a shared document it shows placeholders for images and loads web images only after the reader asks. |
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

- Below 760 px (`NARROW` in `App.jsx`, and the same breakpoint in `styles.css`), the files panel is a drawer, the settings sheet is full width, and Read, Contents, Pin, Share (Save file on a shared document) and Open move into the More menu.
- In the installed app, the bar is the window's title bar (`window-controls-overlay` in `manifest.json` and `styles.css`). Its empty parts drag the window. Anything clickable you add to the bar must be a `button`, `a`, `input`, `select` or popover, or get `app-region: no-drag`, or it won't take clicks.
- The page has one notice slot, at the top of `.main`. It shows the first of these that applies:
  1. A stated notice, such as an error or a deleted file.
  2. The web images offer, in a shared document with web images.
  3. The folder offer (never for a shared document).
  4. The copy notice, while the document is a copy (never for a shared document, which shows "Shared /" before its name in the bar instead).
  5. The install tip.

### Copies

- When the browser has no File System Access API (Firefox, Safari), or blocks it (a managed Chrome can, by policy), files open through a file input, a folder input (`webkitdirectory`) or a drop (`webkitGetAsEntry`). `fs.js` turns them into a copy: plain objects with `File`s inside, marked by a `copy` id.
- A copy has no live reload, no pins and no restore after a reload. Links, images, the tree and Back and Forward work.
- A copy must stay plain data, never a class or an object with methods. History state stores it through a structured clone, which drops methods.
- A picker that throws (not a cancel) marks file access as blocked for the session, and from then on the inputs open directly.

### Shared links

- A share link carries the document in the URL fragment (`#share=`, see `share.js`), which the browser never sends to the server. Don't move it to the query string or the path.
- A shared document is a copy of one file with `shared: true`. Its copy id comes from `share.shareId`, so a reload or a Back to the same link replaces its history entry instead of adding one.
- The `#share=` URL stays only on the shared document's own entries. `writeEntry` pushes every other document without it.
- `hashchange` opens a link unless the entry already holds that link's document (same copy id). Back and Forward change the hash too, and `goTo` opens their documents. Don't test for an entry without state: Chrome copies the previous entry's state onto an entry typed into the address bar.
- A shared document is written onto the entry the browser made for its link (`openFile(…, { here: true })`), never pushed after it.
- Another document never takes over an entry whose URL holds a share link, even one whose link was damaged. `record` pushes a new entry, so a reload doesn't reopen the link.
- A shared document's web images also include diagram styles: `render` drops every `url(…)` in a diagram except `#id` references in share mode.
- A shared document comes from someone else. Its web images render as `data-src` (`render(text, { share: true })`) and load only when the reader asks, because loading them tells the image host who opened the document.

### Build and deploy

- The content security policy in `_headers` allows no inline scripts. Don't add an inline `<script>` to `index.html`. Put the code in a module under `src/`. `index.html` loads the bundle with an external script.
- `SHELL` in `sw.js` lists the files the app needs offline. The dev server uses `sw.js` as it is. The production build rewrites its `CACHE` line and swaps the `dist/` paths in `SHELL` for the hashed bundle names. If you add a file the app needs offline, add it in two places: `SHELL` in `sw.js`, and the copy list in `build.mjs` (the `for` loop that calls `fs.copyFileSync`).
- The service worker keeps Google Fonts files in their own cache, `leggio-fonts`, which survives new builds, so a theme used once online looks the same offline. The worker's own requests follow the content security policy it was served with, not the page's, so `connect-src` in `_headers` lists both Google Fonts origins.
- The site runs at leggio.compostela.dev as a Cloudflare Worker with static assets only (`wrangler.jsonc`, a custom domain), deployed by Workers Builds. The build command is `pnpm install --frozen-lockfile && pnpm test && pnpm build`, and the deploy command is `npx wrangler deploy`. Wrangler is not a project dependency. Never change the domain: an installed app is tied to its exact origin.

## Check your change

`pnpm test` covers only the modules with no user interface: `render`, `settings`, `share`, the speech queue, voice choice and sentence splitting in `speech`, and the path helpers in `fs`. Add or update a test when you change one of them.

Check everything else in a real browser, in a wide window and at about 390 px wide. Browser automation can't drive the native file pickers, so the app exposes `window.leggio = { openFolder, openFile, openFolderFor }`. Use a folder in the origin private file system (storage the browser keeps for the page, with no picker). Run this in the page:

```js
const dir = await navigator.storage.getDirectory()
const file = await dir.getFileHandle('a.md', { create: true })
const out = await file.createWritable()
await out.write('# Hello\n')
await out.close()
await window.leggio.openFolder(dir)
```

To check copies, remove the pickers before the app loads (in Playwright, `page.addInitScript(() => { delete window.showDirectoryPicker; delete window.showOpenFilePicker })`), or replace them with functions that reject to act like a blocked Chrome. The file inputs then open, and automation can fill them with a real folder on disk.

Changes to the interface and to the Default theme must work with the keyboard alone, with a visible focus ring, and keep text contrast at 4.5:1 or more.

## Working on a contribution

[CONTRIBUTING.md](CONTRIBUTING.md) has the full guide. These lines are the ones that apply to you.

- Keep the pull request to one change. Don't reformat code you didn't change.
- Match the surrounding style. Comments explain why, such as a browser behavior that isn't obvious or an alternative you rejected. Don't add comments that repeat what a line does.
- Commit messages start with `feat:`, `fix:`, `style:`, `refactor:`, `docs:` or `chore:`.
- Fill in `.github/pull_request_template.md`.
- Report only the checks you ran. If you didn't open the change in a browser, say so, so your user can do it before they submit.

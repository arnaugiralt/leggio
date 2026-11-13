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
- **Leggio sends nothing about the reader's files, and fetches only what the reader asked to open.** No accounts, no analytics, no server code, nothing stored off the device, no requests that carry file names or content. Four things use the network: a document the reader opens by its web address (and that address's own images), the Google Fonts stylesheets of some themes, web images that a document links to, and online voices. When the reader picks an online voice for read-aloud, the browser sends the text being read to that voice service, and the voice setting says so. Don't add other outside requests.

## Architecture

The table runs from the entry point to the build, in layers. Each row says what the file owns.

| File | What it owns |
| --- | --- |
| `src/main.jsx` | The entry point. Renders `App` and registers `sw.js`. |
| `src/App.jsx` | Layout, settings, drop and keyboard handling, the top bar and the notice slot. |
| `src/useLibrary.js` | What is open: the folder, pins, the current document, restore after reload, the live-reload watchers, files opened from the operating system, session history and `followLink`. Every action that opens something lives here. |
| `src/fs.js` | The File System Access API: pickers, permission, the markdown tree, `watch` and path helpers. It also builds copies (see below). Other files never call methods on a handle; they use `fs.getFile`, `fs.isSame` and `fs.resolve`, which take both kinds. `useLibrary.js` holds the `launchQueue` handler. |
| `src/idb.js` | `get` and `set` on one IndexedDB store, for `FileSystemHandle`s (which JSON can't hold), pins, the restore record and Recent. Failures resolve to `undefined`. |
| `src/recent.js` | Recent documents: what is kept of each (a handle, a web address, or a copy's text), the list's order, where each one comes from (its row's muted line), and the scroll position each document was left at. Pure, so it runs under node. |
| `src/speech.js` | Speaking: sentence splitting with `Intl.Segmenter`, the utterance queue and the voice list. It doesn't use the DOM, so it runs under node. `Settings.jsx` only listens for `voiceschanged` to refresh its voice picker. |
| `src/share.js` | Links: encodes a document into the `#share=` fragment and decodes it back, reads a pasted link, accepts only https addresses, and caps how much of a stream is read. Pure, so it runs under node. |
| `packages/core/src/render.js` | The renderer, as a markdown-it plugin (`leggio`) plus `render`. One markdown-it instance, the highlight.js hook (9 languages), ```` ```mermaid ```` fences turned into inline SVG, heading ids, task lists, table wrappers, footnotes, hidden front matter, and the HTML allowlist (see below). The image rules are the options `localImages` and `webImages`, which a render can override through its env. **Pure and synchronous: a string in, an HTML string out.** Anything that needs the DOM, a file handle or async work happens in `Viewer.jsx` after render. |
| `packages/core/src/look.js` | The look: `LOOK` and its defaults, the theme presets, font roles, the diagram theme, light or dark from the background, `lookVars`, `lookCss` (for a host with no DOM), `applyLook` and `applyFontUrl`. |
| `packages/core/src/links.js` | `isLocal` and `isRelative`: which links are followable from the reader. |
| `packages/core/prose.css` | The reading styles under `.leggio` and `.prose`. Its header comment holds the size-container contract. |
| `packages/core/index.js`, `index.d.ts`, `README.md` | The public surface of `@leggio/core`. The types are written by hand, so change `index.d.ts` when `index.js` exports change. |
| `src/settings.js` | `DEFAULTS`, load and save to localStorage, and the checks for an imported settings file. The look itself (presets, font roles, light or dark, saved-theme completion) comes from `@leggio/core`; this file re-exports it for the app. |
| `src/Viewer.jsx` | Puts the rendered HTML on the page, then resolves local images to blob URLs and marks internal links. In a shared or web document it shows placeholders for images and loads web images only after the reader asks, except a web document's images from its own host. |
| `src/Speech.jsx` | Everything on screen for read-aloud: walking the blocks, Ranges (browser objects that mark a span of text), the sentence and word highlights. |
| `src/Sidebar.jsx` | Pins, Recent, the folder tree and search in the folder, with the tree keyboard pattern they share. |
| `src/OpenMenu.jsx`, `Shortcuts.jsx` | The Open menu (file, folder, link) and its address field; the keyboard shortcuts list. |
| `src/Outline.jsx`, `Settings.jsx`, `icons.jsx` | Heading list with the active section; the settings form with saved themes and export and import; inline SVG icons (Lucide paths). |
| `src/styles.css` | The app's styles. It imports `@leggio/core/prose.css` first, which holds the reading styles. |
| `manifest.json`, `sw.js`, `_headers` | The installable app shell, the service worker, and the Cloudflare headers with the content security policy. |
| `build.mjs` | The dev server, and the production build into `site/`. |

## Rules that are easy to break

### Links and navigation

- Every link that isn't a `#` jump or a local file opens in a new tab (`Viewer.jsx` decides by what the link is, not by its spelling), so nothing a document links to can take the Leggio window.
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
- Diagrams read `--diagram-*`, which `lookVars` in `packages/core/src/look.js` sets.
- `.main` is a CSS size container, so its children can size themselves from its width. Width caps inside it use `cqw` (1% of that container's width), so they respect the open panels.
- A theme is the `LOOK` keys in `packages/core/src/look.js`: colors, the diagram theme, fonts, weight, line height, code size and the two widths. Settings shows exactly these under "Customize theme", and "Save this look" saves exactly these. Text size, the voice and its speed are personal and stay out. A saved or imported theme that lacks a key takes the reader's value for it once, when it is loaded or imported; a theme with no color is dropped. A key left open would match every look.
- While the look is Default, it follows the system light or dark setting (`followSystem` in `settings.js` and `effective` in `packages/core/src/look.js`). Saved settings keep the light values, and the dark palette is applied on top.

### Layout

- Below 760 px (`NARROW` in `App.jsx`, and the same breakpoint in `styles.css`), the files panel is a drawer, the settings sheet is full width, and Read, Contents, Pin, Share (Save file on a shared document) and the Open actions move into the More menu, flat, below a divider. Below 1100 px the settings sheet covers the page instead of squeezing the text.
- Phones and tablets in a narrow window (`PHONE` in `App.jsx`: a coarse pointer, and the same query in `styles.css`) get their own bar: ☰ ‹ › ⋯ as icons with accessible names, Settings in More, 44 px targets, and the bar and notice slide away while scrolling down. A narrow desktop window keeps the text bar.
- Hide an action that can't work rather than show one that fails: "Open a folder" and ⇧⌘O only where `fs.canOpenFolders`, the Files button only where it can show something.
- The bar: text buttons on desktop, plus the Back and Forward arrows; on phones, only ☰ ‹ › ⋯ as icons. No pills, chips or badges. Menus are text only.
- One place for each kind of thing: opening in the Open menu (the empty state shows the same actions as buttons); keeping in pins; going back in Back, Forward and Recent, which lives in the Files panel (the empty state shows its first three rows, built the same way); the look in Settings; messages in the notice slot.
- In the installed app, the bar is the window's title bar (`window-controls-overlay` in `manifest.json` and `styles.css`). Its empty parts drag the window. Anything clickable you add to the bar must be a `button`, `a`, `input`, `select` or popover, or get `app-region: no-drag`, or it won't take clicks.
- The page has one notice slot, at the top of `.main`. It shows the first of these that applies:
  1. A web document on its way ("Opening … from …", with Cancel), over an open document. With nothing open, the main area says it instead.
  2. A stated notice, such as an error or a deleted file.
  3. The web images offer, in a shared or web document with images from other hosts.
  4. The folder offer (never for a shared or web document, and never where no folder can open: there a relative link says the file isn't available).
  5. The copy notice, while the document is a copy (never on a touch screen, where every file is a copy, and never for a shared or web document, which shows "Shared /" or its host before its name in the bar instead).
  6. The install tip, or on iOS Safari the Add to Home Screen tip.

### Copies

- When the browser has no File System Access API (Firefox, Safari), or blocks it (a managed Chrome can, by policy), files open through a file input, a folder input (`webkitdirectory`) or a drop (`webkitGetAsEntry`). `fs.js` turns them into a copy: plain objects with `File`s inside, marked by a `copy` id.
- A copy has no live reload and no pins. Links, images, the tree and Back and Forward work. After a reload a copy comes back through Recent, which keeps its text on the device (IndexedDB), as does a shared document.
- A copy must stay plain data, never a class or an object with methods. History state stores it through a structured clone, which drops methods.
- A picker that throws (not a cancel) marks file access as blocked for the session, and from then on the inputs open directly.

### HTML in documents

- markdown-it runs with `html: true` only so HTML reaches the allowlist in `packages/core/src/render.js`, which rebuilds each allowed tag from its name and listed attributes and turns everything else back into text. Never let HTML through as written.
- `href` and `src` go through markdown-it's `validateLink`. An HTML `<img>` follows the markdown image rule: local, or any non-data one in a shared or web document, becomes `data-src`.
- Add a tag only if it can carry no script and no address beyond `href` and `src`, and add an attack case to `render.test.js`.
- Allowed tags are balanced: a paragraph or HTML block closes the inline tags it opened, block tags (`details`, `table`, …) are closed at the end of the document, and a stray closing tag is dropped. Keep the tag pattern from crossing `<`: it backtracked quadratically once.
- Footnote ids are `fn_N` and `fnref_N`. Heading ids never contain an underscore, so the two can't meet.

### Shared links

- A share link carries the document in the URL fragment (`#share=`, see `share.js`), which the browser never sends to the server. Don't move it to the query string or the path.
- A shared document is a copy of one file with `shared: true`. Its copy id comes from `share.shareId`, so a reload or a Back to the same link replaces its history entry instead of adding one.
- The `#share=` URL stays only on the shared document's own entries. `writeEntry` pushes every other document without it.
- `hashchange` opens a link unless the entry already holds that link's document (same copy id). Back and Forward change the hash too, and `goTo` opens their documents. Don't test for an entry without state: Chrome copies the previous entry's state onto an entry typed into the address bar.
- A shared document is written onto the entry the browser made for its link (`openFile(…, { here: true })`), never pushed after it.
- Another document never takes over an entry whose URL holds a share link, even one whose link was damaged. `record` pushes a new entry, so a reload doesn't reopen the link.
- A shared document's web images also include diagram styles: `render` drops every `url(…)` in a diagram except `#id` references in share mode.
- A web address opened from inside Leggio (the Open menu, paste, Recent, a relative link) changes nothing until the document has arrived, then gets an entry with its `#url=` link; a failure leaves the address and the document on screen as they were, and the address field shows the error under itself. A `#url=` typed in the address bar goes onto the entry the browser made, as a shared link does.
- A web document (`#url=`) follows the same entry rules as a shared one: the address stays in the fragment, its copy id is `url:` plus the address, and it is written onto the link's own entry. `openLink` opens anything pasted or typed by setting the fragment, and `hashchange` does the rest.
- A web document's relative links resolve against its address: markdown opens as another web document, anything else in a new tab. Its images from the same host load at once; images from other hosts wait, as in a shared document.
- Only `https:` addresses open. `connect-src` in `_headers` allows `https:` for that fetch.
- A shared document comes from someone else. Its web images render as `data-src` (`render(text, { share: true })`) and load only when the reader asks, because loading them tells the image host who opened the document.

### The `@leggio/core` package

- `packages/core` is published to npm as `@leggio/core`, and the app uses it as a workspace package. The hard limits, the HTML allowlist rules, the `--bg` and `--fg` variable rule and the privacy rules apply to the package as they do to the app: it fetches nothing itself, and `applyFontUrl` is its only helper that adds a network request.
- A `core-vX.Y.Z` tag on a commit that is on `master` publishes the package, with the same version already bumped in `packages/core/package.json`. `.github/workflows/release-core.yml` runs the checks, publishes to npm with trusted publishing (OIDC, no npm token), and creates a GitHub release. Its notes are the `feat:` and `fix:` subjects of the commits that touched `packages/core` since the previous `core-v` tag. A `v*` tag releases the site and never the package, and the two tag shapes don't match each other's workflow.
- Its dependencies are pinned in `packages/core/package.json`. A new one needs the maintainer's approval, like any other.
- Keep `index.d.ts` in step with `index.js`. `pnpm test` checks the exported names. When the package's surface changes, also run `bash scripts/check-core-types.sh` (the declarations compile for a consumer) and `node scripts/check-core-pack.mjs` (the packed tarball works on its own). CI runs both.

### Build and deploy

- The content security policy in `_headers` allows no inline scripts. Don't add an inline `<script>` to `index.html`. Put the code in a module under `src/`. `index.html` loads the bundle with an external script.
- `SHELL` in `sw.js` lists the files the app needs offline. The dev server uses `sw.js` as it is. The production build rewrites its `CACHE` line and swaps the `dist/` paths in `SHELL` for the hashed bundle names. If you add a file the app needs offline, add it in two places: `SHELL` in `sw.js`, and the copy list in `build.mjs` (the `for` loop that calls `fs.copyFileSync`).
- The service worker keeps Google Fonts files in their own cache, `leggio-fonts`, which survives new builds, so a theme used once online looks the same offline. The worker's own requests follow the content security policy it was served with, not the page's, so `connect-src` in `_headers` must cover both Google Fonts origins. Its `https:` (for web documents) does.
- The site runs at leggio.compostela.dev as a Cloudflare Worker with static assets only (`wrangler.jsonc`, a custom domain), deployed by Workers Builds from the `release` branch. The build command is `pnpm install --frozen-lockfile && pnpm test && pnpm build`, and the deploy command is `pnpm dlx wrangler deploy`.
- A release is a `vX.Y.Z` tag on a commit that is on `master`. `.github/workflows/release.yml` runs the checks, moves `release` to the tagged commit (forward only, and Workers Builds deploys it), and publishes a GitHub release whose notes are the `feat:` and `fix:` commit subjects since the previous tag. Write those subjects for readers of the changelog. Pushes to `master` and to other branches only build previews (`wrangler preview`), so merging is not releasing. `master`'s preview is canary.leggio.compostela.dev, and another branch's is `<branch>.leggio.compostela.dev`. The Preview command in Workers Builds sets that name; `wrangler.jsonc` enables the hostnames. Wrangler is not a project dependency. Never change the domain: an installed app is tied to its exact origin.

## Check your change

`pnpm test` covers only the modules with no user interface: `render`, `settings` (presets' contrast, import checks), `share`, `recent`, the speech queue, voice choice and sentence splitting in `speech`, and the path helpers in `fs`. Add or update a test when you change one of them. If you change the surface of `@leggio/core`, also run `bash scripts/check-core-types.sh` and `node scripts/check-core-pack.mjs`.

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

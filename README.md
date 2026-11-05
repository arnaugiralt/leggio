# md reader

A read-only markdown reader. Drop a file or a folder and read it. Mermaid diagrams render inline, and a click opens one full size. Fonts, sizes and colors are yours to set, and the default theme follows your system's light or dark setting. Files are read on your computer and never uploaded.

## Run

```sh
pnpm install
pnpm dev      # http://localhost:8000, rebuilds on change
pnpm build    # writes site/, the folder to deploy
pnpm serve    # build, then serve site/ on http://localhost:8765
pnpm test
```

## Folders

Open a folder (Chrome, Edge) to browse its markdown files in the Files panel (⌘B). Relative links and images resolve inside the folder, and the view reloads when a file changes on disk. Back and forward (⌘[ and ⌘]) walk the documents you opened, and keep your scroll position. Pin files or folders to keep them across sessions. On launch, the reader puts you back where you left off.

## Install it

The app is a PWA. Open it in Chrome and use the install button in the address bar. It gets its own window, works offline, and registers as a handler for `.md` files, so opening one from Finder opens it here. Installing needs a secure origin; `localhost` counts as one.

## Deploy

`pnpm build` writes `site/`: the page, hashed bundles under `assets/`, the service worker, the manifest, the icons, `_headers` and `THIRD_PARTY_NOTICES.txt`. Upload that folder to any static host. `_headers` uses the Cloudflare format: long caching for the hashed bundles, no caching for the page and the worker, and a content security policy.

## Stack

Preact, markdown-it, highlight.js, beautiful-mermaid, esbuild. Thirteen packages in total, exact versions, install scripts disabled. The icons are paths copied from [Lucide](https://lucide.dev) (ISC), not a dependency.

## Not yet

Editing (never). Search across a folder.

## License

MIT, see [LICENSE](LICENSE). Bundled third-party licenses are listed in `site/THIRD_PARTY_NOTICES.txt` after a build. The layout engine elkjs is EPL-2.0; its source is at https://github.com/kieler/elkjs.

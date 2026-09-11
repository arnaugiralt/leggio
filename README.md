# md reader

A read-only markdown viewer. Drop a file, read it. Mermaid diagrams render inline, and click one to see it full size. Fonts, sizes, and colors are yours to set.

## Run

```sh
pnpm install
pnpm dev      # http://localhost:8000, rebuilds on change
pnpm build    # writes dist/
pnpm test
```

## Stack

Preact, markdown-it, highlight.js, beautiful-mermaid, esbuild. Thirteen packages in total, exact versions, install scripts disabled. The seven icons are paths copied from [Lucide](https://lucide.dev) (ISC) rather than a dependency.

## Folders

Open a folder (Chrome, Edge) to browse its markdown files in the Files panel (⌘B). Pin files or folders to keep them across sessions. Relative images and links resolve inside the open folder, and the view reloads when the file changes on disk. On launch, one click restores where you left off.

## Install it

The app is a PWA. Open it in Chrome and use the install button in the address bar: it gets its own window, works offline, and registers as a handler for `.md` files, so opening one from Finder opens it here. Installing needs a secure origin, which `localhost` counts as.

## Not yet

Editing (never). Search, tabs, Tauri packaging: phase 3.

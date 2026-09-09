# md reader

A read-only markdown viewer. Drop a file, read it. Mermaid diagrams render inline. Fonts, sizes, and colors are yours to set.

## Run

```sh
pnpm install
pnpm dev      # http://localhost:8000, rebuilds on change
pnpm build    # writes dist/
pnpm test
```

## Stack

Preact, markdown-it, highlight.js, beautiful-mermaid, esbuild. Thirteen packages in total, exact versions, install scripts disabled.

## Folders

Open a folder (Chrome, Edge) to browse its markdown files in the Files panel (⌘B). Pin files or folders to keep them across sessions. Relative images and links resolve inside the open folder, and the view reloads when the file changes on disk. On launch, one click restores where you left off.

## Not yet

Editing (never). Search, tabs, Tauri packaging: phase 3.

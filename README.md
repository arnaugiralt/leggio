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

## Not yet

Editing (never). Folders, pinned files, relative images and links, Tauri packaging: phase 2.

import * as esbuild from 'esbuild'
import fs from 'node:fs'

// @leggio/core is bundled, so the package ships with no node_modules.
await esbuild.build({
  entryPoints: ['src/extension.js'],
  outfile: 'dist/extension.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  minify: true,
  logLevel: 'info',
})
// The stylesheet and icon have one source each; the copies are git-ignored.
fs.copyFileSync('../core/prose.css', 'prose.css')
fs.copyFileSync('../app/icon-192.png', 'icon.png')

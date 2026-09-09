import * as esbuild from 'esbuild'

const dev = process.argv.includes('--dev')

const options = {
  entryPoints: { app: 'src/main.jsx' },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'info',
}

if (dev) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  await ctx.serve({ servedir: '.', port: 8000 })
} else {
  await esbuild.build(options)
}

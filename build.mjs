import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const dev = process.argv.includes('--dev')

const options = {
  entryPoints: { app: 'src/main.jsx' },
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'info',
}

if (dev) {
  const ctx = await esbuild.context({ ...options, outdir: 'dist' })
  await ctx.watch()
  await ctx.serve({ servedir: '.', port: 8000 })
} else {
  // site/ is everything a host serves and nothing else: no src/, no tests, no notes.
  fs.rmSync('site', { recursive: true, force: true })
  // Hashed names let the host cache the bundle forever; index.html and sw.js stay uncached and point at them.
  const result = await esbuild.build({ ...options, outdir: 'site/assets', entryNames: '[name]-[hash]', metafile: true })
  const outputs = Object.keys(result.metafile.outputs).map(file => path.relative('site', file))
  const js = outputs.find(file => file.endsWith('.js'))
  const css = outputs.find(file => file.endsWith('.css'))

  for (const file of ['manifest.json', '_headers', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png']) fs.copyFileSync(file, `site/${file}`)
  // The install dialog shows it; .github/ holds the copy the README uses.
  fs.copyFileSync('.github/screenshot.png', 'site/screenshot.png')
  fs.writeFileSync('site/index.html', fs.readFileSync('index.html', 'utf8').replace('dist/app.css', css).replace('dist/app.js', js))
  fs.writeFileSync(
    'site/sw.js',
    fs
      .readFileSync('sw.js', 'utf8')
      .replace(/^const CACHE = .*$/m, `const CACHE = 'leggio-${path.basename(js, '.js').split('-').pop()}'`)
      .replace(/^const SHELL = .*$/m, `const SHELL = ${JSON.stringify(['./', './index.html', `./${js}`, `./${css}`, './manifest.json', './icon-192.png', './icon-512.png', './favicon-32.png'])}`),
  )
  fs.writeFileSync('site/THIRD_PARTY_NOTICES.txt', notices(result.metafile))
}

// One entry per npm package that ended up in the bundle, with its license text. elkjs is EPL-2.0, which asks
// that object-code copies say where the source is, hence the repository line on every entry.
// package.json repository fields come as git+https://, git://, or the npm shorthand owner/name.
function sourceUrl(repo) {
  if (/^[\w.-]+\/[\w.-]+$/.test(repo)) return `https://github.com/${repo}`
  return repo.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '')
}

function notices(metafile) {
  const roots = new Set()
  for (const input of Object.keys(metafile.inputs)) {
    const m = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)
    if (m) roots.add(m[1])
  }
  const parts = [...roots].sort().map(root => {
    const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8'))
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
    const licenseFile = fs.readdirSync(root).find(name => /^(licen[sc]e|copying)/i.test(name))
    const text = licenseFile ? fs.readFileSync(`${root}/${licenseFile}`, 'utf8').trim() : `License: ${pkg.license}`
    return [`${pkg.name} ${pkg.version} (${pkg.license})`, repo && `Source: ${sourceUrl(repo)}`, '', text].filter(line => typeof line === 'string').join('\n')
  })
  const lucide = 'Lucide icons (ISC), paths copied into src/icons.jsx\nSource: https://github.com/lucide-icons/lucide\n\nISC License. Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.'
  return `Leggio bundles the following third-party software.\n\n${[...parts, lucide].join('\n\n' + '-'.repeat(72) + '\n\n')}\n`
}

// Packs @leggio/core, installs the tarball into an empty project and uses it, so a file missing from
// "files" or "exports" fails here and not for the first consumer.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packDir = mkdtempSync(join(tmpdir(), 'core-pack-'))
const appDir = mkdtempSync(join(tmpdir(), 'core-app-'))
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString()

try {
  run('pnpm', ['pack', '--pack-destination', packDir], join(root, 'packages/core'))
  const tarball = join(packDir, readdirSync(packDir).find(f => f.endsWith('.tgz')))
  writeFileSync(join(appDir, 'package.json'), '{"name":"pack-check","private":true,"type":"module"}')
  run('pnpm', ['add', tarball, '--ignore-scripts'], appDir)
  writeFileSync(join(appDir, 'check.mjs'), `
    import assert from 'node:assert/strict'
    import { existsSync } from 'node:fs'
    import { fileURLToPath } from 'node:url'
    import { render, lookCss, PRESETS } from '@leggio/core'
    const html = render('# Hi\\n\\n![a](x.png)')
    assert.match(html, /<h1/)
    assert.ok(html.includes('data-src="x.png"'), 'local image should render as data-src')
    const css = lookCss(PRESETS[0])
    assert.ok(css.startsWith('.leggio {') || css.startsWith('@import'), 'lookCss starts with ' + css.slice(0, 20))
    assert.ok(existsSync(fileURLToPath(import.meta.resolve('@leggio/core/prose.css'))), 'prose.css is missing')
  `)
  run('node', ['check.mjs'], appDir)
  console.log('pack check passed')
} catch (e) {
  console.error('pack check failed:', e.message)
  process.exitCode = 1
} finally {
  rmSync(packDir, { recursive: true, force: true })
  rmSync(appDir, { recursive: true, force: true })
}

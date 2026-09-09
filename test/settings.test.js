import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, STORAGE_KEY, DIAGRAM_THEMES, load, save, applyToRoot, fontFamilies, withSwap } from '../src/settings.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  }
}

function fakeRoot() {
  const vars = {}
  return { vars, style: { setProperty: (k, v) => { vars[k] = v }, removeProperty: k => { delete vars[k] } } }
}

test('load returns defaults when storage is empty', () => {
  assert.deepEqual(load(fakeStorage()), DEFAULTS)
})

test('load merges stored values over defaults', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ fontSize: 21, bg: '#000000' }) })
  const s = load(storage)
  assert.equal(s.fontSize, 21)
  assert.equal(s.bg, '#000000')
  assert.equal(s.fg, DEFAULTS.fg)
})

test('load ignores corrupt json', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{not json' })
  assert.deepEqual(load(storage), DEFAULTS)
})

test('load treats non-object stored json as empty', () => {
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: 'null' })), DEFAULTS)
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: '[1,2]' })), DEFAULTS)
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: '"text"' })), DEFAULTS)
})

test('save round-trips through load', () => {
  const storage = fakeStorage()
  const s = { ...DEFAULTS, lineHeight: 1.8, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter&display=swap' }
  save(s, storage)
  assert.deepEqual(load(storage), s)
})

test('load drops keys that are no longer settings', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ fontFamily: 'Georgia', fontSize: 20 }) })
  const s = load(storage)
  assert.equal(s.fontSize, 20)
  assert.equal('fontFamily' in s, false)
})

test('fontFamilies reads body and code families from a Google Fonts url', () => {
  const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&family=JetBrains+Mono&display=swap'
  assert.deepEqual(fontFamilies(url), {
    body: "'Inter', ui-serif, Georgia, serif",
    code: "'JetBrains Mono', ui-monospace, monospace",
  })
})

test('fontFamilies falls back to system fonts', () => {
  const fallback = { body: 'ui-serif, Georgia, serif', code: 'ui-monospace, monospace' }
  assert.deepEqual(fontFamilies(''), fallback)
  assert.deepEqual(fontFamilies('not a url'), fallback)
  assert.deepEqual(fontFamilies('https://fonts.googleapis.com/css2?family=Lora'), {
    body: "'Lora', ui-serif, Georgia, serif",
    code: 'ui-monospace, monospace',
  })
})

test('fontFamilies escapes quotes in family names', () => {
  assert.equal(fontFamilies("https://fonts.googleapis.com/css2?family=O'Neil").body, "'O\\'Neil', ui-serif, Georgia, serif")
})

test('withSwap appends display=swap once', () => {
  assert.equal(withSwap('https://fonts.googleapis.com/css2?family=Inter'), 'https://fonts.googleapis.com/css2?family=Inter&display=swap')
  assert.equal(withSwap('https://fonts.googleapis.com/css2?family=Inter&display=block'), 'https://fonts.googleapis.com/css2?family=Inter&display=block')
  assert.equal(withSwap(''), '')
})

test('applyToRoot writes every setting as a css variable with units', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, fontSize: 18, contentWidth: 800, codeFontSize: 13, lineHeight: 1.7 }, root)
  assert.equal(root.vars['--font-size'], '18px')
  assert.equal(root.vars['--content-width'], '800px')
  assert.equal(root.vars['--code-font-size'], '13px')
  assert.equal(root.vars['--line-height'], '1.7')
  assert.equal(root.vars['--font-weight'], '400')
  assert.equal(root.vars['--font-family'], 'ui-serif, Georgia, serif')
  assert.equal(root.vars['--code-font-family'], 'ui-monospace, monospace')
  assert.equal(root.vars['--color-bg'], DEFAULTS.bg)
  assert.equal(root.vars['--color-fg'], DEFAULTS.fg)
  assert.equal(root.vars['--color-accent'], DEFAULTS.accent)
  assert.equal(root.vars['--color-code-bg'], DEFAULTS.codeBg)
  assert.equal(Object.keys(root.vars).length, 14)
})

test('applyToRoot derives font families from the url', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora&family=Fira+Code' }, root)
  assert.equal(root.vars['--font-family'], "'Lora', ui-serif, Georgia, serif")
  assert.equal(root.vars['--code-font-family'], "'Fira Code', ui-monospace, monospace")
})

test('applyToRoot points diagram colors at the page palette by default', () => {
  const root = fakeRoot()
  applyToRoot(DEFAULTS, root)
  assert.equal(DEFAULTS.diagramTheme, 'page')
  assert.equal(root.vars['--diagram-bg'], 'var(--color-bg)')
  assert.equal(root.vars['--diagram-fg'], 'var(--color-fg)')
  assert.equal(root.vars['--diagram-accent'], 'var(--color-accent)')
  assert.equal('--diagram-line' in root.vars, false)
  assert.equal('--diagram-muted' in root.vars, false)
})

test('applyToRoot applies a named diagram theme and clears it again', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, diagramTheme: 'dracula' }, root)
  assert.equal(root.vars['--diagram-bg'], '#282a36')
  assert.equal(root.vars['--diagram-fg'], '#f8f8f2')
  assert.equal(root.vars['--diagram-line'], '#6272a4')
  assert.equal(root.vars['--diagram-accent'], '#bd93f9')
  assert.equal(root.vars['--diagram-muted'], '#6272a4')
  applyToRoot({ ...DEFAULTS, diagramTheme: 'page' }, root)
  assert.equal(root.vars['--diagram-bg'], 'var(--color-bg)')
  assert.equal('--diagram-line' in root.vars, false)
})

test('DIAGRAM_THEMES starts with page and lists the built-in themes', () => {
  assert.equal(DIAGRAM_THEMES[0], 'page')
  assert.ok(DIAGRAM_THEMES.includes('github-light'))
  assert.equal(DIAGRAM_THEMES.length, 16)
})

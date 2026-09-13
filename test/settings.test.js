import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, STORAGE_KEY, DIAGRAM_THEMES, LOOK, PRESETS, load, save, applyToRoot, families, fontName, fontStack, fontOptions, withSwap } from '../src/settings.js'

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

test('fontStack resolves unset roles by the legacy positional rule', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400&family=JetBrains+Mono&display=swap' }
  assert.equal(fontStack(s, 'text'), "'Inter', ui-serif, Georgia, serif")
  assert.equal(fontStack(s, 'code'), "'JetBrains Mono', ui-monospace, monospace")
  assert.equal(fontStack(s, 'ui'), 'system-ui, -apple-system, sans-serif')
})

test('a named role wins over the url position', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter&family=Fira+Code', textFont: 'Fira Code', uiFont: 'Inter' }
  assert.equal(fontStack(s, 'text'), "'Fira Code', ui-serif, Georgia, serif")
  assert.equal(fontStack(s, 'ui'), "'Inter', system-ui, -apple-system, sans-serif")
})

test('fontStack falls back to the system stack per role', () => {
  assert.equal(fontStack(DEFAULTS, 'text'), 'ui-serif, Georgia, serif')
  assert.equal(fontStack(DEFAULTS, 'code'), 'ui-monospace, monospace')
  assert.equal(fontStack(DEFAULTS, 'ui'), 'system-ui, -apple-system, sans-serif')
  assert.equal(fontStack({ ...DEFAULTS, fontUrl: 'not a url' }, 'text'), 'ui-serif, Georgia, serif')
})

test('generic families are keywords, not quoted names', () => {
  assert.equal(fontStack({ ...DEFAULTS, textFont: 'system-ui' }, 'text'), 'system-ui, ui-serif, Georgia, serif')
  assert.equal(fontStack({ ...DEFAULTS, textFont: "O'Neil" }, 'text'), "'O\\'Neil', ui-serif, Georgia, serif")
})

test('fontName reports the family in use so a control can show it', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora' }
  assert.equal(fontName(s, 'text'), 'Lora') // implicit, from the url position
  assert.equal(fontName(s, 'code'), '')
  assert.equal(fontName({ ...s, codeFont: 'Iosevka' }, 'code'), 'Iosevka')
})

test('fontOptions lists the url families, the role generics and the current pick', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora', codeFont: 'Iosevka' }
  assert.deepEqual(families(s.fontUrl), ['Lora'])
  assert.deepEqual(fontOptions(s, 'code'), ['Lora', 'ui-monospace', 'Iosevka'])
  assert.deepEqual(fontOptions(DEFAULTS, 'ui'), ['system-ui', 'ui-serif'])
})

test('every preset names all the look keys', () => {
  for (const preset of PRESETS) {
    for (const key of LOOK) assert.ok(key in preset, `${preset.name} is missing ${key}`)
  }
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
  assert.equal(root.vars['--wide-width'], '1200px')
  assert.equal(root.vars['--code-font-size'], '13px')
  assert.equal(root.vars['--line-height'], '1.7')
  assert.equal(root.vars['--font-weight'], '400')
  assert.equal(root.vars['--font-family'], 'ui-serif, Georgia, serif')
  assert.equal(root.vars['--code-font-family'], 'ui-monospace, monospace')
  assert.equal(root.vars['--ui-font'], 'system-ui, -apple-system, sans-serif')
  assert.equal(root.vars['--color-bg'], DEFAULTS.bg)
  assert.equal(root.vars['--color-fg'], DEFAULTS.fg)
  assert.equal(root.vars['--color-accent'], DEFAULTS.accent)
  assert.equal(root.vars['--color-code-bg'], DEFAULTS.codeBg)
  assert.equal(Object.keys(root.vars).length, 19)
})

test('applyToRoot writes a stack for each font role', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora&family=Fira+Code', uiFont: 'Lora' }, root)
  assert.equal(root.vars['--font-family'], "'Lora', ui-serif, Georgia, serif")
  assert.equal(root.vars['--code-font-family'], "'Fira Code', ui-monospace, monospace")
  assert.equal(root.vars['--ui-font'], "'Lora', system-ui, -apple-system, sans-serif")
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
  assert.equal(root.vars['--code-bg'], 'var(--color-code-bg)')
  assert.equal(root.vars['--code-fg'], 'var(--color-fg)')
  assert.equal(root.vars['--code-accent'], 'var(--color-accent)')
})

test('applyToRoot falls back to the theme text color when it has no accent', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, diagramTheme: 'zinc-dark' }, root)
  assert.equal(root.vars['--code-accent'], '#FAFAFA')
})

test('applyToRoot applies a named diagram theme and clears it again', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, diagramTheme: 'dracula' }, root)
  assert.equal(root.vars['--diagram-bg'], '#282a36')
  assert.equal(root.vars['--diagram-fg'], '#f8f8f2')
  assert.equal(root.vars['--diagram-line'], '#6272a4')
  assert.equal(root.vars['--diagram-accent'], '#bd93f9')
  assert.equal(root.vars['--diagram-muted'], '#6272a4')
  assert.equal(root.vars['--code-bg'], '#282a36')
  assert.equal(root.vars['--code-fg'], '#f8f8f2')
  assert.equal(root.vars['--code-accent'], '#bd93f9')
  applyToRoot({ ...DEFAULTS, diagramTheme: 'page' }, root)
  assert.equal(root.vars['--diagram-bg'], 'var(--color-bg)')
  assert.equal('--diagram-line' in root.vars, false)
})

test('DIAGRAM_THEMES starts with page and lists the built-in themes', () => {
  assert.equal(DIAGRAM_THEMES[0], 'page')
  assert.ok(DIAGRAM_THEMES.includes('github-light'))
  assert.equal(DIAGRAM_THEMES.length, 16)
})

test('applyToRoot sets the color scheme from the background lightness', () => {
  const light = fakeRoot()
  applyToRoot(DEFAULTS, light)
  assert.equal(light.style.colorScheme, 'light')
  const dark = fakeRoot()
  applyToRoot({ ...DEFAULTS, bg: '#111111' }, dark)
  assert.equal(dark.style.colorScheme, 'dark')
})

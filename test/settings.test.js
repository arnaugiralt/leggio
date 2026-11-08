import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeLabel, DEFAULTS, STORAGE_KEY, DIAGRAM_THEMES, LOOK, PRESETS, load, save, applyToRoot, families, fontName, fontStack, fontOptions, matchesPreset, withSwap, effective, isDefaultLook, DARK, themeLook } from '../src/settings.js'

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

test('blocked storage falls back to defaults and saving is a no-op', () => {
  const blocked = { getItem() { throw new DOMException('blocked', 'SecurityError') }, setItem() { throw new DOMException('blocked', 'SecurityError') } }
  assert.deepEqual(load(blocked), DEFAULTS)
  assert.doesNotThrow(() => save(DEFAULTS, blocked))
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
  assert.equal(fontStack(s, 'ui'), 'ui-sans-serif, system-ui, -apple-system, sans-serif')
})

test('a named role wins over the url position', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter&family=Fira+Code', textFont: 'Fira Code', uiFont: 'Inter' }
  assert.equal(fontStack(s, 'text'), "'Fira Code', ui-serif, Georgia, serif")
  assert.equal(fontStack(s, 'ui'), "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif")
})

test('fontStack falls back to the system stack per role', () => {
  assert.equal(fontStack(DEFAULTS, 'text'), 'ui-serif, Georgia, serif')
  assert.equal(fontStack(DEFAULTS, 'code'), 'ui-monospace, monospace')
  assert.equal(fontStack(DEFAULTS, 'ui'), 'ui-sans-serif, system-ui, -apple-system, sans-serif')
  assert.equal(fontStack({ ...DEFAULTS, fontUrl: 'not a url' }, 'text'), 'ui-serif, Georgia, serif')
})

test('a system pick is its own stack, a downloaded one keeps the role stack behind it', () => {
  assert.equal(fontStack({ ...DEFAULTS, textFont: 'ui-monospace' }, 'text'), 'ui-monospace, monospace')
  assert.equal(fontStack({ ...DEFAULTS, textFont: "O'Neil" }, 'text'), "'O\\'Neil', ui-serif, Georgia, serif")
})

test('fontName always reports a family the select can show', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora' }
  assert.equal(fontName(s, 'text'), 'Lora') // implicit, from the url position
  assert.equal(fontName(s, 'code'), 'ui-monospace') // nothing at that position, so the system entry
  assert.equal(fontName(s, 'ui'), 'ui-sans-serif')
  assert.equal(fontName({ ...s, codeFont: 'Iosevka' }, 'code'), 'Iosevka')
})

test('fontOptions groups the url families and offers code only the system mono', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora&family=Fira+Code' }
  assert.deepEqual(families(s.fontUrl), ['Lora', 'Fira Code'])
  assert.deepEqual(fontOptions(s, 'code'), [
    ['Google Fonts', [['Lora', 'Lora'], ['Fira Code', 'Fira Code']]],
    ['System', [['ui-monospace', 'System mono']]],
  ])
  assert.deepEqual(fontOptions(DEFAULTS, 'ui'), [
    ['System', [['ui-sans-serif', 'System sans serif'], ['ui-serif', 'System serif'], ['ui-monospace', 'System mono']]],
  ])
})

test('a pick that leaves the url stays selectable', () => {
  const s = { ...DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora', codeFont: 'Iosevka' }
  assert.deepEqual(fontOptions(s, 'code')[0], ['Google Fonts', [['Lora', 'Lora'], ['Iosevka', 'Iosevka']]])
})

test('matchesPreset compares fonts resolved, not stored', () => {
  const [defaults] = PRESETS
  assert.ok(matchesPreset(DEFAULTS, defaults))
  // the same look reached by naming the system entries outright
  assert.ok(matchesPreset({ ...DEFAULTS, textFont: 'ui-serif', codeFont: 'ui-monospace', uiFont: 'ui-sans-serif' }, defaults))
  assert.ok(!matchesPreset({ ...DEFAULTS, uiFont: 'ui-serif' }, defaults))
  for (const preset of PRESETS) assert.ok(matchesPreset({ ...DEFAULTS, ...preset }, preset), preset.name)
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
  assert.equal(root.vars['--font-size'], '1.125rem')
  assert.equal(root.vars['--content-width'], '800px')
  assert.equal(root.vars['--wide-width'], '1200px')
  assert.equal(root.vars['--code-font-size'], '0.8125rem')
  assert.equal(root.vars['--line-height'], '1.7')
  assert.equal(root.vars['--font-weight'], '400')
  assert.equal(root.vars['--font-family'], 'ui-serif, Georgia, serif')
  assert.equal(root.vars['--code-font-family'], 'ui-monospace, monospace')
  assert.equal(root.vars['--ui-font'], 'ui-sans-serif, system-ui, -apple-system, sans-serif')
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
  assert.equal(root.vars['--ui-font'], "'Lora', ui-sans-serif, system-ui, -apple-system, sans-serif")
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

test('themeLabel title-cases ids and keeps GitHub', () => {
  assert.equal(themeLabel('page'), 'Follow page colors')
  assert.equal(themeLabel('tokyo-night-storm'), 'Tokyo Night Storm')
  assert.equal(themeLabel('github-dark'), 'GitHub Dark')
  assert.equal(themeLabel('one-dark'), 'One Dark')
})

test('Default follows the OS only while followSystem holds', () => {
  assert.equal(DEFAULTS.followSystem, true)
  assert.equal(effective(DEFAULTS, true).bg, DARK.bg)
  assert.equal(effective(DEFAULTS, false), DEFAULTS)
  assert.equal(effective({ ...DEFAULTS, followSystem: false }, true).bg, DEFAULTS.bg)
})

test('settings saved before followSystem follow only if the look is still Default', () => {
  const stored = s => load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(s) }))
  assert.equal(stored({ fontSize: 20 }).followSystem, true)
  assert.equal(stored({ bg: '#000000' }).followSystem, false)
  assert.equal(stored({ bg: '#000000', followSystem: true }).followSystem, true)
  assert.equal(isDefaultLook({ ...DEFAULTS, fontSize: 20 }), true)
  assert.equal(isDefaultLook({ ...DEFAULTS, accent: '#000000' }), false)
})

test('a theme keeps the page widths, weight and code size, but not the text size', () => {
  for (const key of ['contentWidth', 'wideWidth', 'fontWeight', 'codeFontSize']) assert.ok(LOOK.includes(key), key)
  for (const key of ['fontSize', 'voice', 'speechRate']) assert.ok(!LOOK.includes(key), key)
  for (const preset of PRESETS) assert.equal(preset.contentWidth, DEFAULTS.contentWidth, preset.name)
})

test('a theme saved before it held widths leaves the current ones', () => {
  const current = { ...DEFAULTS, contentWidth: 900, fontSize: 22 }
  const old = { name: 'Old', bg: '#000000', fg: '#ffffff' }
  const look = themeLook(old, current)
  assert.equal(look.contentWidth, 900)
  assert.equal(look.bg, '#000000')
  assert.ok(!('fontSize' in look))
  assert.ok(matchesPreset({ ...current, ...look }, look))
})

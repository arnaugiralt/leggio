import { test } from 'node:test'
import assert from 'node:assert/strict'
import { THEMES } from 'beautiful-mermaid'
import { LOOK_DEFAULTS, DIAGRAM_THEMES, LOOK, PRESETS, DARK, applyLook, lookVars, lookCss, themeLabel, families, fontName, fontStack, fontOptions, matchesPreset, withSwap, effective, completeTheme } from '../src/look.js'

function fakeRoot() {
  const vars = {}
  const attrs = new Set()
  return {
    vars, attrs,
    style: { setProperty: (k, v) => { vars[k] = v }, removeProperty: k => { delete vars[k] } },
    toggleAttribute: (name, on) => { on ? attrs.add(name) : attrs.delete(name) },
  }
}

test('fontStack resolves unset roles by the legacy positional rule', () => {
  const s = { ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400&family=JetBrains+Mono&display=swap' }
  assert.equal(fontStack(s, 'text'), "'Inter', ui-serif, Georgia, serif")
  assert.equal(fontStack(s, 'code'), "'JetBrains Mono', ui-monospace, monospace")
  assert.equal(fontStack(s, 'ui'), 'ui-sans-serif, system-ui, -apple-system, sans-serif')
})

test('a named role wins over the url position', () => {
  const s = { ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter&family=Fira+Code', textFont: 'Fira Code', uiFont: 'Inter' }
  assert.equal(fontStack(s, 'text'), "'Fira Code', ui-serif, Georgia, serif")
  assert.equal(fontStack(s, 'ui'), "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif")
})

test('fontStack falls back to the system stack per role', () => {
  assert.equal(fontStack(LOOK_DEFAULTS, 'text'), 'ui-serif, Georgia, serif')
  assert.equal(fontStack(LOOK_DEFAULTS, 'code'), 'ui-monospace, monospace')
  assert.equal(fontStack(LOOK_DEFAULTS, 'ui'), 'ui-sans-serif, system-ui, -apple-system, sans-serif')
  assert.equal(fontStack({ ...LOOK_DEFAULTS, fontUrl: 'not a url' }, 'text'), 'ui-serif, Georgia, serif')
})

test('a system pick is its own stack, a downloaded one keeps the role stack behind it', () => {
  assert.equal(fontStack({ ...LOOK_DEFAULTS, textFont: 'ui-monospace' }, 'text'), 'ui-monospace, monospace')
  assert.equal(fontStack({ ...LOOK_DEFAULTS, textFont: "O'Neil" }, 'text'), "'O\\'Neil', ui-serif, Georgia, serif")
})

test('fontName always reports a family the select can show', () => {
  const s = { ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora' }
  assert.equal(fontName(s, 'text'), 'Lora') // implicit, from the url position
  assert.equal(fontName(s, 'code'), 'ui-monospace') // nothing at that position, so the system entry
  assert.equal(fontName(s, 'ui'), 'ui-sans-serif')
  assert.equal(fontName({ ...s, codeFont: 'Iosevka' }, 'code'), 'Iosevka')
})

test('fontOptions groups the url families and offers code only the system mono', () => {
  const s = { ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora&family=Fira+Code' }
  assert.deepEqual(families(s.fontUrl), ['Lora', 'Fira Code'])
  assert.deepEqual(fontOptions(s, 'code'), [
    ['Google Fonts', [['Lora', 'Lora'], ['Fira Code', 'Fira Code']]],
    ['System', [['ui-monospace', 'System mono']]],
  ])
  assert.deepEqual(fontOptions(LOOK_DEFAULTS, 'ui'), [
    ['System', [['ui-sans-serif', 'System sans serif'], ['ui-serif', 'System serif'], ['ui-monospace', 'System mono']]],
  ])
})

test('a pick that leaves the url stays selectable', () => {
  const s = { ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora', codeFont: 'Iosevka' }
  assert.deepEqual(fontOptions(s, 'code')[0], ['Google Fonts', [['Lora', 'Lora'], ['Iosevka', 'Iosevka']]])
})

test('matchesPreset compares fonts resolved, not stored', () => {
  const [defaults] = PRESETS
  assert.ok(matchesPreset(LOOK_DEFAULTS, defaults))
  // the same look reached by naming the system entries outright
  assert.ok(matchesPreset({ ...LOOK_DEFAULTS, textFont: 'ui-serif', codeFont: 'ui-monospace', uiFont: 'ui-sans-serif' }, defaults))
  assert.ok(!matchesPreset({ ...LOOK_DEFAULTS, uiFont: 'ui-serif' }, defaults))
  for (const preset of PRESETS) assert.ok(matchesPreset({ ...LOOK_DEFAULTS, ...preset }, preset), preset.name)
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

test('applyLook writes every setting as a css variable with units', () => {
  const root = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, fontSize: 18, contentWidth: 800, codeFontSize: 13, lineHeight: 1.7 }, root)
  assert.equal(root.vars['--font-size'], '1.125rem')
  assert.equal(root.vars['--content-width'], '800px')
  assert.equal(root.vars['--wide-width'], '1200px')
  assert.equal(root.vars['--code-font-size'], '0.8125rem')
  assert.equal(root.vars['--line-height'], '1.7')
  assert.equal(root.vars['--font-weight'], '400')
  assert.equal(root.vars['--font-family'], 'ui-serif, Georgia, serif')
  assert.equal(root.vars['--code-font-family'], 'ui-monospace, monospace')
  assert.equal(root.vars['--ui-font'], 'ui-sans-serif, system-ui, -apple-system, sans-serif')
  assert.equal(root.vars['--color-bg'], LOOK_DEFAULTS.bg)
  assert.equal(root.vars['--color-fg'], LOOK_DEFAULTS.fg)
  assert.equal(root.vars['--color-accent'], LOOK_DEFAULTS.accent)
  assert.equal(root.vars['--color-code-bg'], LOOK_DEFAULTS.codeBg)
  assert.equal(Object.keys(root.vars).length, 19)
})

test('applyLook writes a stack for each font role', () => {
  const root = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora&family=Fira+Code', uiFont: 'Lora' }, root)
  assert.equal(root.vars['--font-family'], "'Lora', ui-serif, Georgia, serif")
  assert.equal(root.vars['--code-font-family'], "'Fira Code', ui-monospace, monospace")
  assert.equal(root.vars['--ui-font'], "'Lora', ui-sans-serif, system-ui, -apple-system, sans-serif")
})

test('applyLook points diagram colors at the page palette by default', () => {
  const root = fakeRoot()
  applyLook(LOOK_DEFAULTS, root)
  assert.equal(LOOK_DEFAULTS.diagramTheme, 'page')
  assert.equal(root.vars['--diagram-bg'], 'var(--color-bg)')
  assert.equal(root.vars['--diagram-fg'], 'var(--color-fg)')
  assert.equal(root.vars['--diagram-accent'], 'var(--color-accent)')
  assert.equal('--diagram-line' in root.vars, false)
  assert.equal('--diagram-muted' in root.vars, false)
  assert.equal(root.vars['--code-bg'], 'var(--color-code-bg)')
  assert.equal(root.vars['--code-fg'], 'var(--color-fg)')
  assert.equal(root.vars['--code-accent'], 'var(--color-accent)')
})

test('applyLook falls back to the theme text color when it has no accent', () => {
  const root = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, diagramTheme: 'zinc-dark' }, root)
  assert.equal(root.vars['--code-accent'], '#FAFAFA')
})

test('applyLook applies a named diagram theme and clears it again', () => {
  const root = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, diagramTheme: 'dracula' }, root)
  assert.equal(root.vars['--diagram-bg'], '#282a36')
  assert.equal(root.vars['--diagram-fg'], '#f8f8f2')
  assert.equal(root.vars['--diagram-line'], '#6272a4')
  assert.equal(root.vars['--diagram-accent'], '#bd93f9')
  assert.equal(root.vars['--diagram-muted'], '#6272a4')
  assert.equal(root.vars['--code-bg'], '#282a36')
  assert.equal(root.vars['--code-fg'], '#f8f8f2')
  assert.equal(root.vars['--code-accent'], '#bd93f9')
  applyLook({ ...LOOK_DEFAULTS, diagramTheme: 'page' }, root)
  assert.equal(root.vars['--diagram-bg'], 'var(--color-bg)')
  assert.equal('--diagram-line' in root.vars, false)
})

test('DIAGRAM_THEMES starts with page and lists the built-in themes', () => {
  assert.equal(DIAGRAM_THEMES[0], 'page')
  assert.ok(DIAGRAM_THEMES.includes('github-light'))
  assert.equal(DIAGRAM_THEMES.length, 16)
})

test('applyLook sets the color scheme from the background lightness', () => {
  const light = fakeRoot()
  applyLook(LOOK_DEFAULTS, light)
  assert.equal(light.style.colorScheme, 'light')
  const dark = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, bg: '#111111' }, dark)
  assert.equal(dark.style.colorScheme, 'dark')
})

test('themeLabel title-cases ids and keeps GitHub', () => {
  assert.equal(themeLabel('page'), 'Follow page colors')
  assert.equal(themeLabel('tokyo-night-storm'), 'Tokyo Night Storm')
  assert.equal(themeLabel('github-dark'), 'GitHub Dark')
  assert.equal(themeLabel('one-dark'), 'One Dark')
})

test('Default follows the OS only while followSystem holds', () => {
  const follows = { ...LOOK_DEFAULTS, followSystem: true }
  assert.equal(effective(follows, true).bg, DARK.bg)
  assert.equal(effective(follows, false), follows)
  assert.equal(effective({ ...follows, followSystem: false }, true).bg, LOOK_DEFAULTS.bg)
})

test('a theme keeps the page widths, weight and code size, but not the text size', () => {
  for (const key of ['contentWidth', 'wideWidth', 'fontWeight', 'codeFontSize']) assert.ok(LOOK.includes(key), key)
  for (const key of ['fontSize', 'voice', 'speechRate']) assert.ok(!LOOK.includes(key), key)
  for (const preset of PRESETS) assert.equal(preset.contentWidth, LOOK_DEFAULTS.contentWidth, preset.name)
})

test('a theme saved before it held widths takes the current ones, once, and then matches only them', () => {
  const current = { ...LOOK_DEFAULTS, contentWidth: 900, fontSize: 22 }
  const { name, ...look } = completeTheme({ name: 'Old', bg: '#000000', fg: '#ffffff' }, current)
  assert.equal(name, 'Old')
  assert.equal(look.contentWidth, 900)
  assert.equal(look.bg, '#000000')
  assert.ok(!('fontSize' in look))
  assert.ok(matchesPreset({ ...current, ...look }, look))
  assert.ok(!matchesPreset({ ...current, ...look, contentWidth: 700 }, look), 'a different width is a different look')
})


test('applyLook toggles data-dark with the background', () => {
  const root = fakeRoot()
  applyLook({ ...LOOK_DEFAULTS, ...DARK }, root)
  assert.ok(root.attrs.has('data-dark'))
  applyLook(LOOK_DEFAULTS, root)
  assert.ok(!root.attrs.has('data-dark'))
})

test('lookVars matches what applyLook sets', () => {
  const builtIn = Object.keys(THEMES)[0]
  for (const look of [...PRESETS, { ...LOOK_DEFAULTS, diagramTheme: builtIn }]) {
    const root = fakeRoot()
    applyLook({ ...LOOK_DEFAULTS, ...look }, root)
    const vars = Object.fromEntries(Object.entries(lookVars({ ...LOOK_DEFAULTS, ...look })).filter(([, v]) => v !== null))
    assert.deepEqual(vars, root.vars, look.name ?? builtIn)
  }
})

test('lookVars sets --font-size only for a numeric fontSize, and nulls the diagram keys a theme lacks', () => {
  assert.ok(!('--font-size' in lookVars(LOOK_DEFAULTS)))
  assert.equal(lookVars({ ...LOOK_DEFAULTS, fontSize: 16 })['--font-size'], '1rem')
  assert.equal(lookVars(LOOK_DEFAULTS)['--diagram-line'], null)
})

test('lookCss writes the vars under the selector, with the color scheme', () => {
  const css = lookCss({ ...LOOK_DEFAULTS, ...DARK }, 'body')
  assert.ok(css.startsWith('body {'))
  assert.ok(css.includes('--color-bg: #16181d;'))
  assert.ok(css.includes('color-scheme: dark;'))
  assert.ok(lookCss(LOOK_DEFAULTS).startsWith('.leggio {'))
})

test('lookCss imports the font url first', () => {
  const css = lookCss({ ...LOOK_DEFAULTS, fontUrl: 'https://fonts.googleapis.com/css2?family=Lora' })
  assert.ok(css.startsWith('@import url("https://fonts.googleapis.com/css2?family=Lora");'))
  // a real preset url holds semicolons, which are harmless inside the quoted string
  assert.ok(lookCss(PRESETS.find(p => p.name === 'Quiet')).startsWith('@import url("https://fonts.googleapis.com/'))
})

test('lookCss leaves out hostile values', () => {
  const css = lookCss({ ...LOOK_DEFAULTS, bg: 'red; } body { display:none', textFont: 'x</style>', fontUrl: 'https://e.com/a") ; @import url("https://evil' })
  assert.equal(css.split('{').length - 1, 1)
  assert.equal(css.split('}').length - 1, 1)
  assert.ok(!css.includes('@import'))
  for (const bad of ['display:none', '</style>', 'evil']) assert.ok(!css.includes(bad), bad)
  assert.ok(!lookCss({ ...LOOK_DEFAULTS, fontUrl: 'http://fonts.googleapis.com/css2' }).includes('@import'))
  // An unclosed comment would swallow whatever CSS the host puts after this block.
  assert.ok(!lookCss({ ...LOOK_DEFAULTS, codeFont: 'Mono /* x' }).includes('/*'))
})

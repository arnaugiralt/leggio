import { THEMES } from 'beautiful-mermaid'

// 'page' means diagrams follow the page palette; any other entry is a beautiful-mermaid built-in theme.
export const DIAGRAM_THEMES = ['page', ...Object.keys(THEMES)]

const THEME_ACRONYMS = { github: 'GitHub' }
export const themeLabel = id =>
  id === 'page' ? 'Follow page colors' : id.split('-').map(w => THEME_ACRONYMS[w] ?? w[0].toUpperCase() + w.slice(1)).join(' ')

export const LOOK_DEFAULTS = {
  fontUrl: '',
  textFont: '', // '' means the system stack for the role; see fontName for the legacy fallback
  codeFont: '',
  uiFont: '',
  fontWeight: 400,
  lineHeight: 1.6,
  contentWidth: 700,
  wideWidth: 1200,
  codeFontSize: 14,
  bg: '#ffffff',
  fg: '#1a1a1a',
  accent: '#2563eb',
  codeBg: '#f5f5f5',
  diagramTheme: 'page',
}

// The keys a theme owns: the whole design of the page. Text size, the voice and its speed are personal and
// survive a theme change. Every one of these stays editable afterwards: picking a theme is a one-shot write, not a mode.
export const LOOK = ['bg', 'fg', 'accent', 'codeBg', 'diagramTheme', 'fontUrl', 'textFont', 'codeFont', 'uiFont', 'lineHeight', 'fontWeight', 'codeFontSize', 'contentWidth', 'wideWidth']
// The proportions every built-in theme shares; a theme may set its own.
const MEASURE = { fontWeight: LOOK_DEFAULTS.fontWeight, codeFontSize: LOOK_DEFAULTS.codeFontSize, contentWidth: LOOK_DEFAULTS.contentWidth, wideWidth: LOOK_DEFAULTS.wideWidth }

// What Default becomes on a dark OS. Stored settings keep the light values; App
// merges edits onto the effective look, so a changed color starts from what was on screen.
export const DARK = { bg: '#16181d', fg: '#e3e5e8', accent: '#6ea8fe', codeBg: '#1f2228' }

// A theme that lacks a key (saved before themes held widths, or imported) takes the reader's value for it, once,
// when it is loaded or imported. Left open, the key would match any value, and the theme every look.
export const completeTheme = (theme, current) => ({ ...Object.fromEntries(LOOK.map(k => [k, current[k]])), ...theme })

export const isDefaultLook = s => LOOK.every(key => s[key] === LOOK_DEFAULTS[key])

// The settings as rendered: Default swaps in the dark palette on a dark OS.
export const effective = (s, dark) => (s.followSystem && dark ? { ...s, ...DARK } : s)

export const PRESETS = [
  { name: 'Default', ...Object.fromEntries(LOOK.map(key => [key, LOOK_DEFAULTS[key]])) },
  {
    name: 'Quiet',
    bg: '#ffffff', fg: '#363737', accent: '#363737', codeBg: '#f0f0f0',
    // zinc-light's background is the page white, so code blocks sit flush rather than in a
    // box. codeBg still paints inline code, which keeps its chip.
    diagramTheme: 'zinc-light',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght,MONO@0,300..800,1;1,300..800,1&family=Spectral:ital,wght@0,400;0,600;1,400;1,600&display=swap',
    textFont: 'Spectral', codeFont: 'Google Sans Code', uiFont: 'ui-sans-serif',
    lineHeight: 1.65,
  },
  {
    name: 'Cobalt',
    bg: '#fffdfa', fg: '#002885', accent: '#0952f1', codeBg: '#f5f5f5',
    diagramTheme: 'page',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap',
    textFont: 'Literata', codeFont: '', uiFont: '', // code and chrome stay on the system stacks
    lineHeight: 1.6,
  },
  // One mono across all three roles is the look these two share: prose, code and chrome
  // on the same grid. Teletype is the printed one, Terminal the screen.
  {
    name: 'Teletype',
    bg: '#fbfbfa', fg: '#1f1f1f', accent: '#146b4f', codeBg: '#f1f1ee',
    diagramTheme: 'page',
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap',
    textFont: 'IBM Plex Mono', codeFont: 'IBM Plex Mono', uiFont: 'IBM Plex Mono',
    lineHeight: 1.55,
  },
  {
    name: 'Terminal',
    // Cool black against Ember's warm one, so the two dark presets never read as the same.
    bg: '#101112', fg: '#c8cdc6', accent: '#52c08d', codeBg: '#17191a',
    diagramTheme: 'page',
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap',
    textFont: 'IBM Plex Mono', codeFont: 'IBM Plex Mono', uiFont: 'IBM Plex Mono',
    lineHeight: 1.55,
  },
  {
    name: 'Ember',
    // Warm rather than blue, and the text is off-white rather than white: less glare to
    // read against at night. Diagrams follow the palette because every built-in dark
    // theme drags its own hue in.
    bg: '#171512', fg: '#e4ded2', accent: '#d79a4c', codeBg: '#211e19',
    diagramTheme: 'page',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;600&display=swap',
    textFont: 'Source Serif 4', codeFont: 'JetBrains Mono', uiFont: 'ui-sans-serif',
    lineHeight: 1.7,
  },
].map(preset => ({ ...MEASURE, ...preset }))

// setting key -> [css variable, unit, divisor]. Text sizes go out in rem so the browser's default
// font size scales them; the stored value and the number shown stay in px. fontUrl is handled by fontFamilies and applyFontUrl.
const CSS_VARS = {
  fontSize: ['--font-size', 'rem', 16],
  fontWeight: ['--font-weight'],
  lineHeight: ['--line-height'],
  contentWidth: ['--content-width', 'px'],
  wideWidth: ['--wide-width', 'px'],
  codeFontSize: ['--code-font-size', 'rem', 16],
  bg: ['--color-bg'],
  fg: ['--color-fg'],
  accent: ['--color-accent'],
  codeBg: ['--color-code-bg'],
}

// Three font roles. A role names a family; the system entries are CSS generics, so a
// role's value is always one of the options its select offers. The old positional rule —
// first family in the url is the text font, second is code — still resolves roles left
// unset, so settings saved before roles existed render the same and need no migration.
const SYSTEM = {
  'ui-sans-serif': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  'ui-serif': 'ui-serif, Georgia, serif',
  'ui-monospace': 'ui-monospace, monospace',
}

const SYSTEM_LABELS = {
  'ui-sans-serif': 'System sans serif',
  'ui-serif': 'System serif',
  'ui-monospace': 'System mono',
}

const ROLES = {
  text: { key: 'textFont', cssVar: '--font-family', system: 'ui-serif', position: 0 },
  code: { key: 'codeFont', cssVar: '--code-font-family', system: 'ui-monospace', position: 1 },
  ui: { key: 'uiFont', cssVar: '--ui-font', system: 'ui-sans-serif' },
}

const FONT_ROLES = Object.keys(ROLES)

export function families(url) {
  try {
    return new URL(url).searchParams.getAll('family').map(f => f.split(':')[0].trim()).filter(Boolean)
  } catch {
    return []
  }
}

// The family a role actually renders in, so its select can show what the reader sees
// rather than the empty string behind it.
export function fontName(settings, role) {
  const { key, position, system } = ROLES[role]
  if (settings[key]) return settings[key]
  return (position === undefined ? '' : families(settings.fontUrl)[position]) || system
}

// A downloaded family is never used bare: the role's system stack stays behind it, so a
// url that fails to load degrades to the right kind of font instead of to Times.
export function fontStack(settings, role) {
  const name = fontName(settings, role)
  if (SYSTEM[name]) return SYSTEM[name]
  const quoted = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `'${quoted}', ${SYSTEM[ROLES[role].system]}`
}

// Grouped [label, [[value, text], …]] for the role's select. Code is offered only the
// system mono, since nothing in a url says which of its families are monospaced.
export function fontOptions(settings, role) {
  const current = fontName(settings, role)
  const loaded = families(settings.fontUrl)
  // a family picked before the url changed stays selectable, so the pick is never lost
  const google = [...new Set(SYSTEM[current] ? loaded : [...loaded, current])]
  const system = role === 'code' ? ['ui-monospace'] : Object.keys(SYSTEM)
  return [
    ['Google Fonts', google.map(name => [name, name])],
    ['System', system.map(name => [name, SYSTEM_LABELS[name]])],
  ].filter(([, items]) => items.length)
}

// The ring means "the page looks like this preset", so fonts compare resolved: a role
// left unset and one naming the same family are the same look.
const FONT_KEYS = Object.fromEntries(FONT_ROLES.map(role => [ROLES[role].key, role]))

export function matchesPreset(settings, preset) {
  return LOOK.every(key =>
    FONT_KEYS[key] ? fontName(settings, FONT_KEYS[key]) === fontName(preset, FONT_KEYS[key]) : settings[key] === preset[key],
  )
}

export function withSwap(url) {
  if (!url || /[?&]display=/.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + 'display=swap'
}

const PAGE_DIAGRAM_COLORS = { bg: 'var(--color-bg)', fg: 'var(--color-fg)', accent: 'var(--color-accent)' }

// Diagrams and code blocks share one theme. Unset diagram keys map to null (removed) so
// beautiful-mermaid falls back to colors derived from bg and fg; the code surfaces
// point back at the page palette instead, so 'page' keeps the user's own code background.
function themeVars(name) {
  const theme = THEMES[name]
  const colors = theme ?? PAGE_DIAGRAM_COLORS
  const vars = {}
  for (const key of ['bg', 'fg', 'line', 'accent', 'muted']) vars[`--diagram-${key}`] = colors[key] ?? null
  vars['--code-bg'] = theme?.bg ?? 'var(--color-code-bg)'
  vars['--code-fg'] = theme?.fg ?? 'var(--color-fg)'
  vars['--code-accent'] = theme?.accent ?? theme?.fg ?? 'var(--color-accent)'
  return vars
}

// Every CSS variable a look sets. null means the variable must not exist.
export function lookVars(look) {
  const vars = {}
  for (const [key, [name, unit = '', divisor]] of Object.entries(CSS_VARS)) {
    if (key === 'fontSize' && typeof look.fontSize !== 'number') continue
    vars[name] = `${divisor ? look[key] / divisor : look[key]}${unit}`
  }
  for (const role of FONT_ROLES) vars[ROLES[role].cssVar] = fontStack(look, role)
  return { ...vars, ...themeVars(look.diagramTheme) }
}

export function applyLook(look, el = document.documentElement) {
  for (const [name, value] of Object.entries(lookVars(look))) {
    if (value === null) el.style.removeProperty(name)
    else el.style.setProperty(name, value)
  }
  el.style.colorScheme = isDark(look.bg) ? 'dark' : 'light'
  el.toggleAttribute?.('data-dark', isDark(look.bg)) // print swaps a dark look for a light one
}

// A look can come from an embedder's own settings, so values that could break out of a declaration or a
// style element are dropped rather than escaped. Values are plain colors, numbers and font stacks.
const UNSAFE = /[;{}<>"\\\n\r]|\/\*/
// A Google Fonts address holds semicolons (wght@400;600), harmless inside a quoted url, so they pass here.
const UNSAFE_URL = /[{}<>"\\\n\r)]|\/\*/

export function lookCss(look, selector = '.leggio') {
  const decls = Object.entries(lookVars(look))
    .filter(([, value]) => value !== null && !UNSAFE.test(value))
    .map(([name, value]) => `  ${name}: ${value};`)
  decls.push(`  color-scheme: ${isDark(look.bg) ? 'dark' : 'light'};`)
  const url = look.fontUrl
  const imp = typeof url === 'string' && url.startsWith('https://') && !UNSAFE_URL.test(url) ? `@import url("${url}");\n` : ''
  return `${imp}${selector} {\n${decls.join('\n')}\n}`
}

export function applyFontUrl(url, doc = document) {
  let link = doc.getElementById('user-font')
  if (!url) {
    link?.remove()
    return
  }
  if (!link) {
    link = doc.createElement('link')
    link.id = 'user-font'
    link.rel = 'stylesheet'
    // A CORS request, so the service worker gets a readable response it can check and keep for offline;
    // without it the response is opaque. Google Fonts allows any origin.
    link.crossOrigin = 'anonymous'
    doc.head.append(link)
  }
  const href = withSwap(url)
  if (link.href !== href) link.href = href
}

// Native form controls and scrollbars follow the page: relative luminance of the hex background.
export function isDark(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

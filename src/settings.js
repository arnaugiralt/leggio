import { THEMES } from 'beautiful-mermaid'

export const STORAGE_KEY = 'leggio.settings'

// 'page' means diagrams follow the page palette; any other entry is a beautiful-mermaid built-in theme.
export const DIAGRAM_THEMES = ['page', ...Object.keys(THEMES)]

const THEME_ACRONYMS = { github: 'GitHub' }
export const themeLabel = id =>
  id === 'page' ? 'Follow page colors' : id.split('-').map(w => THEME_ACRONYMS[w] ?? w[0].toUpperCase() + w.slice(1)).join(' ')

export const DEFAULTS = {
  fontUrl: '',
  textFont: '', // '' means the system stack for the role; see fontName for the legacy fallback
  codeFont: '',
  uiFont: '',
  fontSize: 18,
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
  followSystem: true, // true while the look is Default: the OS light/dark setting picks the palette
  voice: '', // speechSynthesis voice name; '' means whatever the browser picks
  speechRate: 1,
}

// The keys a preset owns: the whole look, nothing personal. Everything else
// (sizes, widths, voice) survives a theme change, and every one of these stays
// editable afterwards — picking a preset is a one-shot write, not a mode.
export const LOOK = ['bg', 'fg', 'accent', 'codeBg', 'diagramTheme', 'fontUrl', 'textFont', 'codeFont', 'uiFont', 'lineHeight']

// What Default becomes on a dark OS. Stored settings keep the light values; App
// merges edits onto the effective look, so a changed color starts from what was on screen.
export const DARK = { bg: '#16181d', fg: '#e3e5e8', accent: '#6ea8fe', codeBg: '#1f2228' }

export const isDefaultLook = s => LOOK.every(key => s[key] === DEFAULTS[key])

// The settings as rendered: Default swaps in the dark palette on a dark OS.
export const effective = (s, dark) => (s.followSystem && dark ? { ...s, ...DARK } : s)

export const PRESETS = [
  { name: 'Default', ...Object.fromEntries(LOOK.map(key => [key, DEFAULTS[key]])) },
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
]

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

// With site data blocked, even reading the localStorage property throws, so it is read inside the try.
// Settings then last for the session only.
export function load(storage) {
  let stored = {}
  try {
    const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY) ?? '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed
  } catch {}
  const out = Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, stored[key] ?? DEFAULTS[key]]))
  // Saved before followSystem existed: only a look that is still Default follows.
  if (stored.followSystem === undefined) out.followSystem = isDefaultLook(out)
  return out
}

export function save(settings, storage) {
  try {
    ;(storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

export function applyToRoot(settings, root = document.documentElement) {
  for (const [key, [name, unit = '', divisor]] of Object.entries(CSS_VARS)) {
    root.style.setProperty(name, `${divisor ? settings[key] / divisor : settings[key]}${unit}`)
  }
  for (const role of FONT_ROLES) root.style.setProperty(ROLES[role].cssVar, fontStack(settings, role))
  applyTheme(settings.diagramTheme, root)
  root.style.colorScheme = isDark(settings.bg) ? 'dark' : 'light'
  root.toggleAttribute?.('data-dark', isDark(settings.bg)) // print swaps a dark look for a light one
}

const PAGE_DIAGRAM_COLORS = { bg: 'var(--color-bg)', fg: 'var(--color-fg)', accent: 'var(--color-accent)' }

// Diagrams and code blocks share one theme. Unset diagram keys are removed so
// beautiful-mermaid falls back to colors derived from bg and fg; the code surfaces
// point back at the page palette instead, so 'page' keeps the user's own code background.
function applyTheme(name, root) {
  const theme = THEMES[name]
  const colors = theme ?? PAGE_DIAGRAM_COLORS
  for (const key of ['bg', 'fg', 'line', 'accent', 'muted']) {
    if (colors[key]) root.style.setProperty(`--diagram-${key}`, colors[key])
    else root.style.removeProperty(`--diagram-${key}`)
  }
  root.style.setProperty('--code-bg', theme?.bg ?? 'var(--color-code-bg)')
  root.style.setProperty('--code-fg', theme?.fg ?? 'var(--color-fg)')
  root.style.setProperty('--code-accent', theme?.accent ?? theme?.fg ?? 'var(--color-accent)')
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
function isDark(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

// Import, export and saved themes. A settings file comes from outside, so every value passes the same kind of
// check a control in Settings would give it, and anything that fails is left out rather than guessed at. The
// font address matters most: it becomes a stylesheet link, so only Google Fonts stylesheets pass (the content
// security policy allows nothing else either).
const COLOR = /^#[0-9a-f]{6}$/i
const FONT_NAME = /^[\p{L}\p{N} _-]{0,60}$/u
const range = (min, max) => v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
// The same bounds as the fields in Settings.jsx.
const CHECKS = {
  fontUrl: v => v === '' || (typeof v === 'string' && v.length < 2000 && v.startsWith('https://fonts.googleapis.com/')),
  textFont: v => typeof v === 'string' && FONT_NAME.test(v),
  codeFont: v => typeof v === 'string' && FONT_NAME.test(v),
  uiFont: v => typeof v === 'string' && FONT_NAME.test(v),
  fontSize: range(10, 40),
  fontWeight: range(100, 900),
  lineHeight: range(1, 2.5),
  contentWidth: range(400, 1400),
  wideWidth: range(400, 2400),
  codeFontSize: range(8, 32),
  bg: v => COLOR.test(v),
  fg: v => COLOR.test(v),
  accent: v => COLOR.test(v),
  codeBg: v => COLOR.test(v),
  diagramTheme: v => DIAGRAM_THEMES.includes(v),
  followSystem: v => typeof v === 'boolean',
  voice: v => typeof v === 'string' && v.length <= 200,
  speechRate: range(0.5, 2),
}

const passing = (source, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(source, k) && CHECKS[k](source[k])).map(k => [k, source[k]]))

// A saved theme: a name and the look it keeps (the LOOK keys, nothing personal).
function readTheme(t) {
  if (!t || typeof t !== 'object' || typeof t.name !== 'string') return []
  const name = t.name.trim()
  if (!name || name.length > 60) return []
  return [{ name, ...passing(t, LOOK) }]
}

export const THEMES_KEY = 'leggio.themes'

export function loadThemes(storage) {
  try {
    const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(THEMES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.flatMap(readTheme) : []
  } catch {
    return []
  }
}

export function saveThemes(themes, storage) {
  try {
    ;(storage ?? globalThis.localStorage).setItem(THEMES_KEY, JSON.stringify(themes))
  } catch {}
}

export function exportSettings(settings, themes = settings.themes ?? []) {
  return { app: 'leggio', version: 1, settings: { ...Object.fromEntries(Object.keys(CHECKS).map(k => [k, settings[k]])), themes } }
}

// { settings, themes }: the values that passed, ready to merge. Throws when the text isn't a settings file.
export function readSettingsFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {}
  const s = data?.settings
  if (data?.app !== 'leggio' || !s || typeof s !== 'object' || Array.isArray(s)) throw new Error("This file isn't a Leggio settings file.")
  return { settings: passing(s, Object.keys(CHECKS)), themes: Array.isArray(s.themes) ? s.themes.flatMap(readTheme).slice(0, 50) : [] }
}

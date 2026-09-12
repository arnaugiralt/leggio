import { THEMES } from 'beautiful-mermaid'

export const STORAGE_KEY = 'md-reader.settings'

// 'page' means diagrams follow the page palette; any other entry is a beautiful-mermaid built-in theme.
export const DIAGRAM_THEMES = ['page', ...Object.keys(THEMES)]

export const DEFAULTS = {
  fontUrl: '',
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
  voice: '', // speechSynthesis voice name; '' means whatever the browser picks
  speechRate: 1,
}

// The keys a preset owns: the whole look, nothing personal. Everything else
// (sizes, widths, voice) survives a theme change, and every one of these stays
// editable afterwards — picking a preset is a one-shot write, not a mode.
export const LOOK = ['bg', 'fg', 'accent', 'codeBg', 'diagramTheme', 'fontUrl', 'lineHeight']

export const PRESETS = [
  { name: 'Default', ...Object.fromEntries(LOOK.map(key => [key, DEFAULTS[key]])) },
  {
    name: 'Paper',
    bg: '#fbf7ef', fg: '#2e2a25', accent: '#9a5b2a', codeBg: '#f3ecdf',
    diagramTheme: 'solarized-light',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=JetBrains+Mono:wght@400;600',
    lineHeight: 1.7,
  },
  {
    name: 'Ink',
    bg: '#16181d', fg: '#d5d9e0', accent: '#7aa2f7', codeBg: '#1b1e24',
    diagramTheme: 'tokyo-night',
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600',
    lineHeight: 1.65,
  },
  {
    name: 'Cobalt',
    bg: '#fffdfa', fg: '#002885', accent: '#0952f1', codeBg: '#f5f5f5',
    diagramTheme: 'page',
    // One family only: Literata sets the text, code stays on the system mono.
    fontUrl: 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap',
    lineHeight: 1.6,
  },
  {
    name: 'Contrast',
    bg: '#ffffff', fg: '#000000', accent: '#0b3fd1', codeBg: '#ededed',
    diagramTheme: 'page', // every built-in light theme is white-on-white here; the palette gives code its own surface
    fontUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;600',
    lineHeight: 1.75,
  },
]

// setting key -> [css variable, unit]. fontUrl is handled by fontFamilies and applyFontUrl.
const CSS_VARS = {
  fontSize: ['--font-size', 'px'],
  fontWeight: ['--font-weight'],
  lineHeight: ['--line-height'],
  contentWidth: ['--content-width', 'px'],
  wideWidth: ['--wide-width', 'px'],
  codeFontSize: ['--code-font-size', 'px'],
  bg: ['--color-bg'],
  fg: ['--color-fg'],
  accent: ['--color-accent'],
  codeBg: ['--color-code-bg'],
}

const SYSTEM_BODY = 'ui-serif, Georgia, serif'
const SYSTEM_CODE = 'ui-monospace, monospace'

// First `family` param is the body font, second is the code font. Anything else falls back to system fonts.
export function fontFamilies(url) {
  let names = []
  try {
    names = new URL(url).searchParams.getAll('family').map(f => f.split(':')[0].trim()).filter(Boolean)
  } catch {}
  const quote = name => `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return {
    body: names[0] ? `${quote(names[0])}, ${SYSTEM_BODY}` : SYSTEM_BODY,
    code: names[1] ? `${quote(names[1])}, ${SYSTEM_CODE}` : SYSTEM_CODE,
  }
}

export function withSwap(url) {
  if (!url || /[?&]display=/.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + 'display=swap'
}

export function load(storage = globalThis.localStorage) {
  let stored = {}
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed
  } catch {}
  return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, stored[key] ?? DEFAULTS[key]]))
}

export function save(settings, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function applyToRoot(settings, root = document.documentElement) {
  for (const [key, [name, unit = '']] of Object.entries(CSS_VARS)) {
    root.style.setProperty(name, `${settings[key]}${unit}`)
  }
  const fonts = fontFamilies(settings.fontUrl)
  root.style.setProperty('--font-family', fonts.body)
  root.style.setProperty('--code-font-family', fonts.code)
  applyTheme(settings.diagramTheme, root)
  root.style.colorScheme = isDark(settings.bg) ? 'dark' : 'light'
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

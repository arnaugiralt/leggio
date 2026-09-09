import { THEMES } from 'beautiful-mermaid'

export const STORAGE_KEY = 'md-reader.settings'

// 'page' means diagrams follow the page palette; any other entry is a beautiful-mermaid built-in theme.
export const DIAGRAM_THEMES = ['page', ...Object.keys(THEMES)]

export const DEFAULTS = {
  fontUrl: '',
  fontSize: 17,
  fontWeight: 400,
  lineHeight: 1.6,
  contentWidth: 720,
  tableWidth: 1200,
  codeFontSize: 14,
  bg: '#ffffff',
  fg: '#1a1a1a',
  accent: '#2563eb',
  codeBg: '#f5f5f5',
  diagramTheme: 'page',
}

// setting key -> [css variable, unit]. fontUrl is handled by fontFamilies and applyFontUrl.
const CSS_VARS = {
  fontSize: ['--font-size', 'px'],
  fontWeight: ['--font-weight'],
  lineHeight: ['--line-height'],
  contentWidth: ['--content-width', 'px'],
  tableWidth: ['--table-width', 'px'],
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
  applyDiagramTheme(settings.diagramTheme, root)
  root.style.colorScheme = isDark(settings.bg) ? 'dark' : 'light'
}

const PAGE_DIAGRAM_COLORS = { bg: 'var(--color-bg)', fg: 'var(--color-fg)', accent: 'var(--color-accent)' }

// Unset keys are removed so beautiful-mermaid falls back to colors derived from bg and fg.
function applyDiagramTheme(name, root) {
  const colors = THEMES[name] ?? PAGE_DIAGRAM_COLORS
  for (const key of ['bg', 'fg', 'line', 'accent', 'muted']) {
    if (colors[key]) root.style.setProperty(`--diagram-${key}`, colors[key])
    else root.style.removeProperty(`--diagram-${key}`)
  }
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

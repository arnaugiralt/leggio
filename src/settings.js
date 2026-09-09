export const STORAGE_KEY = 'md-reader.settings'

export const DEFAULTS = {
  fontFamily: 'system-ui, sans-serif',
  fontUrl: '',
  fontSize: 17,
  lineHeight: 1.6,
  contentWidth: 720,
  codeFontFamily: 'ui-monospace, monospace',
  codeFontSize: 14,
  bg: '#ffffff',
  fg: '#1a1a1a',
  accent: '#2563eb',
  codeBg: '#f5f5f5',
}

// setting key -> [css variable, unit]. fontUrl is not a variable, see applyFontUrl.
const CSS_VARS = {
  fontFamily: ['--font-family'],
  fontSize: ['--font-size', 'px'],
  lineHeight: ['--line-height'],
  contentWidth: ['--content-width', 'px'],
  codeFontFamily: ['--code-font-family'],
  codeFontSize: ['--code-font-size', 'px'],
  bg: ['--bg'],
  fg: ['--fg'],
  accent: ['--accent'],
  codeBg: ['--code-bg'],
}

export function load(storage = globalThis.localStorage) {
  try {
    return { ...DEFAULTS, ...JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function save(settings, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function applyToRoot(settings, root = document.documentElement) {
  for (const [key, [name, unit = '']] of Object.entries(CSS_VARS)) {
    root.style.setProperty(name, `${settings[key]}${unit}`)
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
  if (link.href !== url) link.href = url
}

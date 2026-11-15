import { LOOK, PRESETS, DARK, DIAGRAM_THEMES, effective, lookVars } from '@leggio/core'

// The same bounds as CHECKS in packages/app/src/settings.js. package.json repeats them as minimum and maximum.
export const BOUNDS = {
  fontSize: [10, 40],
  fontWeight: [100, 900],
  lineHeight: [1, 2.5],
  contentWidth: [400, 1400],
  wideWidth: [400, 2400],
  codeFontSize: [8, 32],
}

const COLOR = /^#[0-9a-f]{6}$/i
const FONT_NAME = /^[\p{L}\p{N} _-]{0,60}$/u
const number = key => v => typeof v === 'number' && Number.isFinite(v) && v >= BOUNDS[key][0] && v <= BOUNDS[key][1]

const CHECKS = {
  fontUrl: v => typeof v === 'string' && v.length < 2000 && v.startsWith('https://fonts.googleapis.com/'),
  textFont: v => typeof v === 'string' && FONT_NAME.test(v),
  codeFont: v => typeof v === 'string' && FONT_NAME.test(v),
  uiFont: v => typeof v === 'string' && FONT_NAME.test(v),
  bg: v => COLOR.test(v),
  fg: v => COLOR.test(v),
  accent: v => COLOR.test(v),
  codeBg: v => COLOR.test(v),
  diagramTheme: v => DIAGRAM_THEMES.includes(v),
  ...Object.fromEntries(Object.keys(BOUNDS).map(key => [key, number(key)])),
}

const COLORS = ['bg', 'fg', 'accent', 'codeBg']
const withoutNulls = vars => Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== null))

// get(key) reads a leggio.<key> setting. Unset, empty and invalid values leave the preset's value alone.
export function lookFromSettings(get) {
  const preset = PRESETS.find(p => p.name === get('theme')) ?? PRESETS[0]
  const look = { ...preset }
  let colored = false
  for (const key of [...LOOK, 'fontSize']) {
    const value = get(key)
    if (value === undefined || value === null || value === '' || !CHECKS[key]?.(value)) continue
    look[key] = value
    colored ||= COLORS.includes(key)
  }
  const light = withoutNulls(lookVars(look))
  // Only plain Default follows VS Code's theme. A preset or a chosen color stays as it is in both.
  const follows = preset === PRESETS[0] && !colored
  const dark = follows ? withoutNulls(lookVars(effective({ ...look, followSystem: true }, true))) : light
  return { light, dark, fontUrl: look.fontUrl }
}

const escape = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

// The look travels in the rendered HTML, because previewStyles are static files. preview.js copies it onto <body>.
export const lookElement = ({ light, dark, fontUrl }) =>
  `<div id="leggio-look" hidden data-light="${escape(JSON.stringify(light))}" data-dark="${escape(JSON.stringify(dark))}" data-font-url="${escape(fontUrl)}"></div>\n`

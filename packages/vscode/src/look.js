import { LOOK, LOOK_CHECKS, PRESETS, effective, lookVars } from '@leggio/core'

const COLORS = ['bg', 'fg', 'accent', 'codeBg']
const withoutNulls = vars => Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== null))

// get(key) reads a leggio.<key> setting. Unset, empty and invalid values leave the preset's value alone.
export function lookFromSettings(get) {
  const preset = PRESETS.find(p => p.name === get('theme')) ?? PRESETS[0]
  const look = { ...preset }
  let colored = false
  for (const key of [...LOOK, 'fontSize']) {
    const value = get(key)
    if (value === undefined || value === null || value === '' || !LOOK_CHECKS[key](value)) continue
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

import { LOOK, LOOK_DEFAULTS, LOOK_CHECKS, isDefaultLook } from '@leggio/core'

export { LOOK, LOOK_BOUNDS, DIAGRAM_THEMES, PRESETS, DARK, themeLabel, fontName, fontOptions, matchesPreset, effective, completeTheme, applyFontUrl, isDefaultLook } from '@leggio/core'

export const STORAGE_KEY = 'leggio.settings'

export const DEFAULTS = { ...LOOK_DEFAULTS, fontSize: 18, followSystem: true, voice: '', speechRate: 1 }

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

// Import, export and saved themes. A settings file comes from outside, so every value passes the same kind of
// check a control in Settings would give it, and anything that fails is left out rather than guessed at. The look
// keys use core's LOOK_CHECKS; the personal ones are checked here.
const range = (min, max) => v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const CHECKS = {
  ...LOOK_CHECKS,
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
  const look = passing(t, LOOK)
  // A theme with no color left after the checks would match every look, so it isn't a theme.
  return ['bg', 'fg', 'accent', 'codeBg'].some(k => k in look) ? [{ name, ...look }] : []
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

export function exportSettings(settings, themes = []) {
  return { app: 'leggio', version: 1, settings: Object.fromEntries(Object.keys(CHECKS).map(k => [k, settings[k]])), themes }
}

// { settings, themes }: the values that passed, ready to merge. Throws when the text isn't a settings file.
export function readSettingsFile(text) {
  if (text.length > 1_000_000) throw new Error("This file is too large to be Leggio settings.")
  let data
  try {
    data = JSON.parse(text)
  } catch {}
  const s = data?.settings
  if (data?.app !== 'leggio' || !s || typeof s !== 'object' || Array.isArray(s)) throw new Error("This file isn't a Leggio settings file.")
  // Themes sit beside the settings; a file from before kept them inside.
  const themes = Array.isArray(data.themes) ? data.themes : Array.isArray(s.themes) ? s.themes : []
  return { settings: passing(s, Object.keys(CHECKS)), themes: themes.flatMap(readTheme).slice(0, 50) }
}

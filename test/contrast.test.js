import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS, DARK } from '../src/settings.js'

// Every preset must keep its text readable: body, links, interface text and the faintest label at 4.5:1 or
// more. The interface colors are mixes of fg into bg in oklab (the --ui-* tokens in styles.css), so this mixes
// the same way the browser's color-mix does.

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function toOklab([r, g, b]) {
  ;[r, g, b] = [r, g, b].map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(c => Math.min(1, Math.max(0, gam(c))))
}
const mix = (fg, bg, p) => fromOklab(toOklab(hex(fg)).map((v, i) => v * p + toOklab(hex(bg))[i] * (1 - p)))
const luminance = rgb => rgb.map(lin).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const looks = [...PRESETS, { ...PRESETS[0], ...DARK, name: 'Default dark' }]

for (const look of looks) {
  test(`${look.name} keeps text at 4.5:1 or more`, () => {
    const bg = hex(look.bg)
    const roles = {
      body: hex(look.fg),
      link: hex(look.accent),
      'code text': [hex(look.fg), hex(look.codeBg)],
      'muted interface text': mix(look.fg, look.bg, 0.76),
      'faint labels': mix(look.fg, look.bg, 0.7),
    }
    for (const [role, color] of Object.entries(roles)) {
      const ratio = Array.isArray(color[0]) ? contrast(...color) : contrast(color, bg)
      assert.ok(ratio >= 4.5, `${look.name}: ${role} is ${ratio.toFixed(2)}:1`)
    }
  })
}

// Type-checked by scripts/check-core-types.sh, never run. It sits outside test/ because
// node --test also picks up .ts files there.
import MarkdownIt from 'markdown-it'
import { render, leggio, applyLook, lookCss, isLocal, LOOK_DEFAULTS, PRESETS, LOOK_CHECKS, LOOK_BOUNDS } from '@leggio/core'

const html: string = render('# Hi', { localImages: 'keep', webImages: 'defer' })
const md = new MarkdownIt().use(leggio, { footnotes: false, webImages: 'defer' })
const out: string = md.render(html, { localImages: 'keep' })
applyLook(LOOK_DEFAULTS, document.body)
const css: string = lookCss(PRESETS[0], 'body')
const local: boolean = isLocal('a.md')
// @ts-expect-error 'maybe' is not a WebImages value
render('x', { webImages: 'maybe' })
export { out, css, local }

const ok: boolean = LOOK_CHECKS.bg('#ffffff') && LOOK_CHECKS.fontSize(18)
const [min, max]: [number, number] = LOOK_BOUNDS.fontSize
void ok, min, max

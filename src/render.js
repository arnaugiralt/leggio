import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import { renderMermaidSVG } from 'beautiful-mermaid'
import { isLocal } from './fs.js'

// Each definition declares its own aliases (js, ts, sh, py, yml, html, md), so
// registering the canonical name is enough for hljs.getLanguage('js') to resolve.
const languages = { javascript, typescript, json, bash, python, yaml, xml, css, markdown }
for (const [name, definition] of Object.entries(languages)) hljs.registerLanguage(name, definition)

// Names must not collide with the --bg/--fg/--accent that beautiful-mermaid sets on its own <svg>,
// or the SVG ends up with `--bg: var(--bg)` and every derived color goes invalid.
// The --diagram-* variables are set on the root by settings.js: the page palette or a named theme.
const diagramColors = {
  bg: 'var(--diagram-bg)',
  fg: 'var(--diagram-fg)',
  line: 'var(--diagram-line)',
  accent: 'var(--diagram-accent)',
  muted: 'var(--diagram-muted)',
}

// beautiful-mermaid hardcodes Google Fonts imports (Inter, and JetBrains Mono for class/ER diagrams) into every SVG.
// Diagrams use system fonts, so strip all imports and point both font rules at system families.
const FONT_IMPORTS = /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\s*/g
const TEXT_FONT_RULE = /text \{ font-family: [^}]+\}/g
const MONO_FONT_RULE = /\.mono \{ font-family: [^}]+\}/g

function diagram(code) {
  return renderMermaidSVG(code, diagramColors)
    .replace(FONT_IMPORTS, '')
    .replace(TEXT_FONT_RULE, 'text { font-family: system-ui, sans-serif; }')
    .replace(MONO_FONT_RULE, '.mono { font-family: ui-monospace, monospace; }')
}

// html: true only so HTML reaches the allowlist below, which rebuilds the few tags it allows and turns every
// other tag back into text. Nothing a document says in HTML is put on the page as it was written.
const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value
    return ''
  },
})

// Mermaid types beautiful-mermaid has no renderer for; anything else that throws is a syntax problem.
const UNSUPPORTED = new Map([
  ['gantt', 'Gantt charts'], ['pie', 'Pie charts'], ['mindmap', 'Mind maps'], ['gitGraph', 'Git graphs'],
  ['journey', 'User journeys'], ['timeline', 'Timelines'], ['quadrantChart', 'Quadrant charts'],
  ['requirementDiagram', 'Requirement diagrams'], ['sankey-beta', 'Sankey diagrams'],
  ['block-beta', 'Block diagrams'], ['packet-beta', 'Packet diagrams'], ['architecture-beta', 'Architecture diagrams'],
  ['kanban', 'Kanban boards'], ['radar-beta', 'Radar charts'], ['treemap-beta', 'Treemaps'],
  ...['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'].map(t => [t, 'C4 diagrams']),
])

const defaultFence = md.renderer.rules.fence

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (token.info.trim() !== 'mermaid') return defaultFence(tokens, idx, options, env, self)
  try {
    const svg = diagram(token.content)
    // A style such as fill:url(https://…) would be fetched as soon as the SVG is on the page. In a shared
    // document that request tells the host who opened it, so only same-document references (#id) stay.
    return `<figure class="diagram">${env?.share ? svg.replace(/url\((?!\s*['"]?#)[^)]*\)/gi, 'none') : svg}</figure>\n`
  } catch (err) {
    const code = md.utils.escapeHtml(token.content)
    const type = token.content.trim().split(/\s+/)[0]
    const note = UNSUPPORTED.has(type)
      ? `${UNSUPPORTED.get(type)} can't be drawn yet. The source is shown above.`
      : "This diagram couldn't be drawn. Check its syntax."
    // The parser message stays reachable as a tooltip; it is too technical to show as text.
    const title = UNSUPPORTED.has(type) ? '' : ` title="${md.utils.escapeHtml(err.message)}"`
    return `<pre><code class="language-mermaid">${code}</code></pre>\n<p class="diagram-error"${title}>${note}</p>\n`
  }
}

// Heading ids for the outline rail. Duplicate slugs get a numeric suffix.
md.core.ruler.push('heading_ids', state => {
  const seen = new Map()
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i]
    if (token.type !== 'heading_open') continue
    const text = state.tokens[i + 1].children
      .filter(t => t.type === 'text' || t.type === 'code_inline')
      .map(t => t.content)
      .join('')
    let slug = text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section'
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    if (count) slug = `${slug}-${count}`
    token.attrSet('id', slug)
  }
})

// GFM task lists. Only a marker at the very start of an item's first paragraph counts.
// html is off, so the checkbox is an html_inline token we build ourselves (rendered verbatim).
md.core.ruler.push('task_lists', state => {
  const tokens = state.tokens
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i]
    if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
    const first = inline.children[0]
    const m = first?.type === 'text' && /^\[([ xX])\] /.exec(first.content)
    if (!m) continue
    const li = tokens[i - 2]
    li.attrJoin('class', 'task-item')
    for (let j = i - 3; j >= 0; j--) {
      if (tokens[j].level === li.level - 1 && /^(bullet|ordered)_list_open$/.test(tokens[j].type)) {
        tokens[j].attrJoin('class', 'task-list')
        break
      }
    }
    first.content = first.content.slice(m[0].length)
    const box = new state.Token('html_inline', '', 0)
    box.content = `<input type="checkbox" disabled${m[1] === ' ' ? '' : ' checked'}>`
    box.meta = { ours: true } // built here, not written by the document: the HTML allowlist leaves it
    inline.children.unshift(box)
  }
})

// A local image must never reach the network: served from a host, its file name would be sent to that
// host, and it cannot exist there anyway. Viewer resolves data-src from the open folder. In a shared
// document a web image waits too: loading it would tell its host who opened the document, and when.
md.core.ruler.push('local_images', state => {
  for (const block of state.tokens) {
    for (const t of block.children ?? []) {
      if (t.type !== 'image') continue
      const src = t.attrGet('src')
      if (!isLocal(src) && !(state.env.share && !src.startsWith('data:'))) continue
      t.attrs = t.attrs.filter(a => a[0] !== 'src')
      t.attrSet('data-src', src)
    }
  }
})

// Most READMEs open with HTML (a centered logo, badges in links, a <details>). These tags are rebuilt from their
// name and the attributes listed for them; any other tag, and any other attribute, is dropped or shown as text.
// Links and image sources go through markdown-it's own link check (no javascript:, vbscript:, file:, or data:
// except images), and images follow the same rule as markdown images: local or, in a shared document, every
// non-data one, as data-src.
const ALLOWED = {
  img: ['src', 'alt', 'title', 'width', 'height'],
  a: ['href', 'title'],
  p: ['align'],
  div: ['align'],
  details: ['open'],
  summary: [],
  kbd: [],
  sub: [],
  sup: [],
  br: [],
  // Also common in READMEs, and like the rest they carry no address and no script.
  ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(h => [h, ['align']])),
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['align', 'colspan', 'rowspan'],
  td: ['align', 'colspan', 'rowspan'],
  b: [],
  strong: [],
  i: [],
  em: [],
  code: [],
}
const VOID = new Set(['img', 'br'])
const TAG = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const ATTR = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function attrValue(tag, name, raw, share) {
  const value = md.utils.unescapeAll(raw ?? '').trim()
  if (name === 'width' || name === 'height') return /^\d{1,4}%?$/.test(value) ? ['', value] : null
  if (name === 'colspan' || name === 'rowspan') return /^\d{1,3}$/.test(value) ? ['', value] : null
  if (name === 'align') return /^(left|center|right)$/i.test(value) ? ['', value.toLowerCase()] : null
  if (name === 'open') return ['', null]
  if (name === 'href' || name === 'src') {
    const url = md.normalizeLink(value)
    if (!md.validateLink(url)) return null
    if (name === 'src' && (isLocal(value) || (share && !/^data:/i.test(value)))) return ['data-', value]
    return ['', url]
  }
  return ['', value]
}

function allowTag(close, name, attrs, share) {
  const tag = name.toLowerCase()
  if (!Object.hasOwn(ALLOWED, tag)) return null
  if (close) return VOID.has(tag) ? '' : `</${tag}>`
  let out = `<${tag}`
  for (const [, key, a, b, c] of attrs.matchAll(ATTR)) {
    const attr = key.toLowerCase()
    if (!ALLOWED[tag].includes(attr) || (a ?? b ?? c ?? null) === null && attr !== 'open') continue
    const kept = attrValue(tag, attr, a ?? b ?? c, share)
    if (!kept) continue
    const [prefix, value] = kept
    out += value === null ? ` ${attr}` : ` ${prefix}${attr}="${md.utils.escapeHtml(value)}"`
  }
  return `${out}>`
}

export function allowHtml(html, share = false) {
  let out = ''
  let last = 0
  for (const m of html.matchAll(TAG)) {
    out += md.utils.escapeHtml(html.slice(last, m.index))
    last = m.index + m[0].length
    if (m[0].startsWith('<!--')) continue // a comment is the author's note to themselves
    const kept = allowTag(m[1] === '/', m[2], m[3], share)
    out += kept ?? md.utils.escapeHtml(m[0])
  }
  return out + md.utils.escapeHtml(html.slice(last))
}

md.core.ruler.push('html_allowlist', state => {
  for (const token of state.tokens) {
    if (token.type === 'html_block') token.content = allowHtml(token.content, state.env.share)
    for (const child of token.children ?? []) if (child.type === 'html_inline' && !child.meta?.ours) child.content = allowHtml(child.content, state.env.share)
  }
})

// Tables get a wrapper so they can be wider than the text column and scroll when wider than the window.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
md.renderer.rules.table_close = () => '</table>\n</div>\n'

// YAML front matter (Obsidian, Jekyll, Hugo) is data about the file, not part of the text: without this it
// renders as a rule and a heading, and the heading lands in Contents. Only a closed block at the very start.
const FRONT_MATTER = /^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/

export function render(text, { share = false } = {}) {
  return md.render(text.replace(FRONT_MATTER, ''), { share })
}

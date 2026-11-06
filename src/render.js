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
// Tags that stay open across markdown blocks, as <details> does around a markdown body. The rest are inline:
// whatever a paragraph or an HTML block leaves open is closed where it ends.
const BLOCK = new Set(['p', 'div', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
// No part of a tag may cross a "<": without that the pattern backtracks quadratically, and a few KB of share
// link holding '<a x="' over and over froze the tab for minutes.
const TAG = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>"']|"[^<"]*"|'[^<']*')*)>/g
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
    // A held image keeps the address as written: Viewer resolves it against the folder or the document's address.
    if (name === 'src' && (isLocal(value) || (share && !/^data:/i.test(value)))) return ['data-', value]
    return ['', url]
  }
  return ['', value]
}

function openTag(tag, attrs, share) {
  let out = `<${tag}`
  for (const [, key, a, b, c] of attrs.matchAll(ATTR)) {
    const attr = key.toLowerCase()
    const raw = a ?? b ?? c ?? null
    if (!ALLOWED[tag].includes(attr) || (raw === null && attr !== 'open')) continue
    const kept = attrValue(tag, attr, raw, share)
    if (!kept) continue
    const [prefix, value] = kept
    out += value === null ? ` ${attr}` : ` ${prefix}${attr}="${md.utils.escapeHtml(value)}"`
  }
  return `${out}>`
}

const closing = stack => stack.splice(0).reverse().map(t => `</${t}>`).join('')

// Rebuilds allowed tags and escapes everything else. open.inline and open.block are the tags still open: a
// closing tag only closes one of these (anything left open inside it is closed first), and a stray one is dropped.
function allowHtml(html, share, open) {
  let out = ''
  let last = 0
  let kept = 0
  for (const m of html.matchAll(TAG)) {
    out += md.utils.escapeHtml(html.slice(last, m.index))
    last = m.index + m[0].length
    if (m[0].startsWith('<!--')) continue // a comment is the author's note to themselves
    const tag = m[2].toLowerCase()
    if (!Object.hasOwn(ALLOWED, tag)) {
      out += md.utils.escapeHtml(m[0])
      continue
    }
    kept++
    if (VOID.has(tag)) {
      if (m[1] !== '/') out += openTag(tag, m[3], share)
      continue
    }
    const stack = BLOCK.has(tag) ? open.block : open.inline
    if (m[1] !== '/') {
      out += openTag(tag, m[3], share)
      stack.push(tag)
    } else if (stack.includes(tag)) {
      if (stack === open.block) out += closing(open.inline)
      const at = stack.lastIndexOf(tag)
      out += closing(stack.splice(at))
    }
  }
  return { html: out + md.utils.escapeHtml(html.slice(last)), kept }
}

md.core.ruler.push('html_allowlist', state => {
  const open = { block: [], inline: [] }
  for (const token of state.tokens) {
    if (token.type === 'html_block' && !token.meta?.ours) {
      const { html, kept } = allowHtml(token.content, state.env.share, open)
      // Nothing in it was allowed: it was never really HTML to us, so it reads as a paragraph, markdown and all.
      token.content = kept ? html + closing(open.inline) : `<p>${md.renderInline(token.content.trim(), { share: state.env.share })}</p>\n`
    }
    const children = token.children ?? []
    for (const child of children) {
      if (child.type === 'html_inline' && !child.meta?.ours) child.content = allowHtml(child.content, state.env.share, open).html
    }
    // A paragraph closes what it opened, so one unclosed <a> can't turn the rest of the page into a link.
    if (open.inline.length && token.type === 'inline') {
      const close = new state.Token('html_inline', '', 0)
      close.content = closing(open.inline)
      close.meta = { ours: true }
      children.push(close)
    }
  }
  if (open.block.length && !state.inlineMode) {
    const close = new state.Token('html_block', '', 0)
    close.content = `${closing(open.block)}\n`
    close.meta = { ours: true }
    state.tokens.push(close)
  }
})

// Footnotes: [^label] in the text, "[^label]: note" on a line of its own (lazy continuation lines join it).
// Notes are numbered in the order they are first cited and listed at the end, each with a way back; a citation
// with no note stays text, and a note nobody cites is left out. The note text renders inline, through the same
// rules as the rest (so the HTML allowlist applies).
const NOTE_DEF = /^\[\^([^\]\s]{1,100})\]:[ \t]?(.*)$/
// A line that starts another block ends a note, as it ends a paragraph.
const BLOCK_START = /^(?:#{1,6}(?:\s|$)|```|~~~|>|[-*+][ \t]|\d{1,9}[.)][ \t]|(?:[-*_][ \t]*){3,}$)/

md.block.ruler.before(
  'reference',
  'footnote_def',
  (state, startLine, endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false // indented: a code block
    const line = n => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n])
    const m = NOTE_DEF.exec(line(startLine))
    if (!m) return false
    if (silent) return true
    let text = m[2]
    let next = startLine + 1
    while (next < endLine && !state.isEmpty(next) && !NOTE_DEF.test(line(next)) && !BLOCK_START.test(line(next))) text += `\n${line(next++)}`
    const notes = (state.env.notes ??= { text: {}, order: [], cited: {} })
    notes.text[m[1]] ??= text
    state.line = next
    return true
  },
  { alt: ['paragraph', 'reference'] },
)

md.inline.ruler.after('image', 'footnote_ref', (state, silent) => {
  const src = state.src
  if (src.charCodeAt(state.pos) !== 0x5b /* [ */ || src.charCodeAt(state.pos + 1) !== 0x5e /* ^ */) return false
  const end = src.slice(state.pos + 2, Math.min(state.posMax, state.pos + 103)).indexOf(']') + state.pos + 2
  const label = end > state.pos + 2 && src.slice(state.pos + 2, end)
  const notes = state.env.notes
  if (!label || /\s/.test(label) || notes?.text[label] === undefined) return false
  if (!silent) {
    if (!notes.order.includes(label)) notes.order.push(label)
    notes.cited[label] = (notes.cited[label] ?? 0) + 1
    const token = state.push('footnote_ref', '', 0)
    token.meta = { label, n: notes.order.indexOf(label) + 1, nth: notes.cited[label] }
  }
  state.pos = end + 1
  return true
})

// Ids by number, with an underscore: heading ids are letters, digits and hyphens, so they can never meet.
md.renderer.rules.footnote_ref = (tokens, idx) => {
  const { n, nth } = tokens[idx].meta
  return `<sup class="footnote-ref"><a href="#fn_${n}" id="fnref_${n}${nth > 1 ? `_${nth}` : ''}">${n}</a></sup>`
}

md.core.ruler.push('footnote_tail', state => {
  const notes = state.env.notes
  if (state.inlineMode || !notes?.order.length) return
  const token = new state.Token('footnote_block', '', 0)
  token.meta = notes
  state.tokens.push(token)
})

md.renderer.rules.footnote_block = (tokens, idx, options, env) => {
  const notes = tokens[idx].meta
  const items = notes.order.map((label, i) => {
    const text = md.renderInline(notes.text[label], { share: env.share })
    return `<li id="fn_${i + 1}" tabindex="-1">${text} <a href="#fnref_${i + 1}" class="footnote-back" aria-label="Back to the text">↩</a></li>`
  })
  return `<section class="footnotes" aria-label="Notes">\n<ol>\n${items.join('\n')}\n</ol>\n</section>\n`
}

// Tables get a wrapper so they can be wider than the text column and scroll when wider than the window.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
md.renderer.rules.table_close = () => '</table>\n</div>\n'

// YAML front matter (Obsidian, Jekyll, Hugo) is data about the file, not part of the text: without this it
// renders as a rule and a heading, and the heading lands in Contents. Only a closed block at the very start, and
// only one that is empty or starts with a key, so a document that opens with a rule keeps its text.
const FRONT_MATTER = /^\uFEFF?---\r?\n(?:[\w-]+[ \t]*:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/
export const withoutFrontMatter = text => text.replace(FRONT_MATTER, '')

export function render(text, { share = false } = {}) {
  return md.render(withoutFrontMatter(text), { share })
}

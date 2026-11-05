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

const md = new MarkdownIt({
  html: false,
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
    return `<figure class="diagram">${diagram(token.content)}</figure>\n`
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
    inline.children.unshift(box)
  }
})

// Tables get a wrapper so they can be wider than the text column and scroll when wider than the window.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
md.renderer.rules.table_close = () => '</table>\n</div>\n'

export function render(text) {
  return md.render(text)
}

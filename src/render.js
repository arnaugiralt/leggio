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
const diagramColors = {
  bg: 'var(--color-bg)',
  fg: 'var(--color-fg)',
  accent: 'var(--color-accent)',
  surface: 'var(--color-code-bg)',
}

// beautiful-mermaid hardcodes a Google Fonts import for Inter into every SVG. Diagrams use the system font.
const FONT_IMPORT = /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\s*/
const FONT_RULE = /text \{ font-family: [^}]+\}/

function diagram(code) {
  return renderMermaidSVG(code, diagramColors)
    .replace(FONT_IMPORT, '')
    .replace(FONT_RULE, 'text { font-family: system-ui, sans-serif; }')
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value
    return ''
  },
})

const defaultFence = md.renderer.rules.fence

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (token.info.trim() !== 'mermaid') return defaultFence(tokens, idx, options, env, self)
  try {
    return `<figure class="diagram">${diagram(token.content)}</figure>\n`
  } catch (err) {
    const code = md.utils.escapeHtml(token.content)
    const message = md.utils.escapeHtml(err.message)
    return `<pre><code class="language-mermaid">${code}</code></pre>\n<p class="diagram-error">${message}</p>\n`
  }
}

export function render(text) {
  return md.render(text)
}

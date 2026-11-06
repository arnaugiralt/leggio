import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../src/render.js'

const fixture = `# Title

Some text with a link to https://example.com and <b>raw html</b>.

\`\`\`javascript
const answer = 42
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`mermaid
gantt
  title Not supported
\`\`\`

\`\`\`unknownlang
plain text
\`\`\`

<script>alert(1)</script>
`

const out = render(fixture)

test('renders headings', () => {
  assert.match(out, /<h1 id="title">Title<\/h1>/)
})

test('highlights known languages with hljs spans', () => {
  assert.match(out, /<code class="language-javascript"><span class="hljs-keyword">const<\/span>/)
})

test('leaves unknown languages as escaped plain code', () => {
  assert.match(out, /<code class="language-unknownlang">plain text\n<\/code>/)
  assert.doesNotMatch(out, /language-unknownlang"><span/)
})

test('renders supported mermaid as inline svg', () => {
  assert.match(out, /<figure class="diagram"><svg /)
  assert.match(out, /--bg:var\(--diagram-bg\)/)
  assert.match(out, /--line:var\(--diagram-line\)/)
  assert.doesNotMatch(out, /--bg:var\(--bg\)/)
  assert.doesNotMatch(out, /fonts\.googleapis/)
  assert.match(out, /text \{ font-family: system-ui, sans-serif; \}/)
})

test('unsupported mermaid falls back to a code block with an error line', () => {
  assert.match(out, /<code class="language-mermaid">gantt\n  title Not supported\n<\/code>/)
  assert.match(out, /<p class="diagram-error">Gantt charts can't be drawn yet\. The source is shown above\.<\/p>/)
  assert.doesNotMatch(out, /Invalid mermaid header/)
})

test('a broken supported diagram gets a syntax note with the parser message in a title', () => {
  const html = render('```mermaid\nflowchrt LR\n  A --> B\n```')
  assert.match(html, /<p class="diagram-error" title="[^"]+">This diagram couldn't be drawn\. Check its syntax\.<\/p>/)
})

test('task list items get a disabled checkbox and list classes', () => {
  const html = render('- [ ] open\n* [x] done\n+ [X] caps\n\n1. [x] ordered\n\n- [ ] parent\n  - [x] child\n- done [x] later\n- [x]no space\n- [] none')
  assert.match(html, /<ul class="task-list">\n<li class="task-item"><input type="checkbox" disabled>open<\/li>/)
  assert.match(html, /<input type="checkbox" disabled checked>done/)
  assert.match(html, /<input type="checkbox" disabled checked>caps/)
  assert.match(html, /<ol class="task-list">\n<li class="task-item"><input type="checkbox" disabled checked>ordered/)
  assert.match(html, /<li class="task-item"><input type="checkbox" disabled>parent\n<ul class="task-list">\n<li class="task-item"><input type="checkbox" disabled checked>child/)
  assert.match(html, /<li>done \[x\] later<\/li>/)
  assert.match(html, /<li>\[x\]no space<\/li>/)
  assert.match(html, /<li>\[\] none<\/li>/)
  assert.equal((html.match(/<input/g) || []).length, 6)
})

test('escapes raw html', () => {
  assert.doesNotMatch(out, /<script>/)
  assert.doesNotMatch(out, /<b>raw html<\/b>/)
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('linkifies bare urls', () => {
  assert.match(out, /<a href="https:\/\/example.com">https:\/\/example.com<\/a>/)
})

test('class diagrams carry no font imports or web font names', () => {
  const svg = render('```mermaid\nclassDiagram\n  class A {\n    +int x\n  }\n  A <|-- B\n```')
  assert.match(svg, /<figure class="diagram"><svg /)
  assert.doesNotMatch(svg, /fonts\.googleapis|Inter|JetBrains/)
  assert.match(svg, /text \{ font-family: system-ui, sans-serif; \}/)
  assert.match(svg, /\.mono \{ font-family: ui-monospace, monospace; \}/)
})

test('headings get stable, unique ids', () => {
  const html = render('# Hello World\n\n## Hello World\n\n### Café & crème\n\n#### `code` title')
  assert.match(html, /<h1 id="hello-world">/)
  assert.match(html, /<h2 id="hello-world-1">/)
  assert.match(html, /<h3 id="café-crème">/)
  assert.match(html, /<h4 id="code-title">/)
})

test('tables are wrapped so they can break out of the text column', () => {
  const html = render('| a | b |\n|---|---|\n| 1 | 2 |')
  assert.match(html, /<div class="table-wrap"><table>/)
  assert.match(html, /<\/table>\n<\/div>/)
})

test('local images carry data-src and no src; external ones keep src', () => {
  const html = render('![a](logo.png) ![b](/x/y.png) ![c](https://e.com/c.png) ![d](data:image/png;base64,AAAA)')
  assert.match(html, /<img[^>]*data-src="logo.png"/)
  assert.match(html, /<img[^>]*data-src="\/x\/y.png"/)
  assert.doesNotMatch(html, /<img[^>]*data-src="https|<img[^>]*data-src="data:/)
  assert.match(html, /<img src="https:\/\/e.com\/c.png"/)
  assert.doesNotMatch(html, /<img(?![^>]*data-src)[^>]*src="logo/)
})

test('share mode never emits a web src', () => {
  for (const url of ['https://x.test/a.png', '//x.test/a.png']) {
    const out = render(`![a](${url})`, { share: true })
    assert.ok(out.includes(`data-src="${url}"`), out)
    assert.doesNotMatch(out, /\ssrc=/)
  }
})

test('share mode keeps data images', () => {
  assert.match(render('![a](data:image/png;base64,iVBORw0KGgo=)', { share: true }), /\ssrc="data:image\/png;base64,iVBORw0KGgo="/)
})

test('normal mode keeps web src', () => {
  assert.match(render('![a](https://x.test/a.png)'), /\ssrc="https:\/\/x.test\/a.png"/)
})

// Shared documents come from strangers: a diagram label must never become markup.
test('mermaid labels are escaped', () => {
  for (const src of ['flowchart LR\n  A["<img src=x onerror=alert(1)>"] --> B', 'sequenceDiagram\n  Alice->>Bob: <script>x</script>']) {
    assert.doesNotMatch(render('```mermaid\n' + src + '\n```'), /<img|<script/)
  }
})

// A diagram style can point a fill at a web URL, which the browser fetches as soon as the SVG is on the page.
test('share mode drops web urls from diagrams', () => {
  const src = '```mermaid\nflowchart LR\n  A --> B\n  style A fill:url(https://x.test/a.png)\n```'
  assert.match(render(src), /x\.test/) // not a share: the reader's own file keeps its style
  assert.doesNotMatch(render(src, { share: true }), /x\.test/)
})

// Obsidian, Jekyll and Hugo put YAML front matter at the top of every file; it is data, not text.
test('front matter is hidden', () => {
  const out = render('---\ntitle: Notes\ntags: [a, b]\n---\n# Real\n\nText.\n')
  assert.doesNotMatch(out, /title: Notes|<hr>/)
  assert.match(out, /<h1[^>]*>Real<\/h1>/)
})

test('a rule that only looks like front matter stays', () => {
  assert.match(render('Intro\n\n---\n\nMore\n'), /<hr>/)
  assert.match(render('---\nno closing fence\n'), /no closing fence/)
})

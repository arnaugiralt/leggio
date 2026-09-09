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
  assert.match(out, /<h1>Title<\/h1>/)
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
  assert.match(out, /--bg:var\(--bg\)/)
})

test('unsupported mermaid falls back to a code block with an error line', () => {
  assert.match(out, /<code class="language-mermaid">gantt\n  title Not supported\n<\/code>/)
  assert.match(out, /<p class="diagram-error">Invalid mermaid header/)
})

test('escapes raw html', () => {
  assert.doesNotMatch(out, /<script>/)
  assert.doesNotMatch(out, /<b>raw html<\/b>/)
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('linkifies bare urls', () => {
  assert.match(out, /<a href="https:\/\/example.com">https:\/\/example.com<\/a>/)
})

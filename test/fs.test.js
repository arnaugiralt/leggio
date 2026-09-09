import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRelative, isMarkdownName, resolvePath, listMarkdown } from '../src/fs.js'

function file(name) {
  return { kind: 'file', name }
}
function dir(name, entries) {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const e of entries) yield [e.name, e]
    },
  }
}
const names = node => node.children.map(c => c.name)

test('isRelative', () => {
  for (const u of ['img.png', './a.md', '../b.md', 'sub/c.md', 'my%20file.md']) assert.equal(isRelative(u), true, u)
  for (const u of ['#x', '/abs.md', '//host/x', 'https://x', 'http://x', 'mailto:a@b', 'data:image/png;base64,AA']) assert.equal(isRelative(u), false, u)
})

test('isMarkdownName', () => {
  for (const n of ['a.md', 'B.MD', 'c.markdown', 'd.txt']) assert.equal(isMarkdownName(n), true, n)
  for (const n of ['e.png', 'f.json', 'md', 'g.md.bak']) assert.equal(isMarkdownName(n), false, n)
})

test('resolvePath normalizes against the current directory', () => {
  assert.deepEqual(resolvePath(['docs'], './a.md'), ['docs', 'a.md'])
  assert.deepEqual(resolvePath(['docs', 'x'], '../b.md'), ['docs', 'b.md'])
  assert.deepEqual(resolvePath([], 'a/./b//c.md'), ['a', 'b', 'c.md'])
  assert.deepEqual(resolvePath(['docs'], 'my%20file.md'), ['docs', 'my file.md'])
  assert.equal(resolvePath(['docs'], '../../escape.md'), null)
  assert.equal(resolvePath([], '.'), null)
})

test('listMarkdown filters, prunes, and sorts', async () => {
  const root = dir('root', [
    file('b.md'),
    file('a.md'),
    file('x.png'),
    dir('.git', [file('c.md')]),
    dir('node_modules', [file('r.md')]),
    dir('empty', [file('i.png')]),
    dir('docs', [file('z.txt'), dir('deep', [file('d.markdown')])]),
  ])
  const tree = await listMarkdown(root)
  assert.equal(tree.kind, 'directory')
  assert.equal(tree.name, 'root')
  assert.deepEqual(names(tree), ['docs', 'a.md', 'b.md'])
  const docs = tree.children[0]
  assert.deepEqual(names(docs), ['deep', 'z.txt'])
  assert.deepEqual(names(docs.children[0]), ['d.markdown'])
  assert.equal(tree.children[1].handle.name, 'a.md')
})

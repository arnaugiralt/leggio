import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entryFor, add, MAX_RECENT } from '../src/recent.js'

const file = name => ({ kind: 'file', name, isSame: other => other.name === name })
const sameFile = async (a, b) => a.isSame(b)

test('a web document is kept by its address', () => {
  const e = entryFor({ handle: { web: 'https://x.test/a.md', copy: 'url:https://x.test/a.md' }, name: 'a.md', text: '# A' }, 5)
  assert.deepEqual(e, { key: 'url:https://x.test/a.md', kind: 'web', name: 'a.md', url: 'https://x.test/a.md', when: 5 })
})

test('a copy keeps its text, so it can come back after a reload', () => {
  const e = entryFor({ handle: { copy: 'c1' }, name: 'a.md', dirPath: ['docs'], text: '# A' }, 5)
  assert.equal(e.kind, 'copy')
  assert.equal(e.text, '# A')
  assert.equal(e.key, 'copy:docs/a.md')
})

test('a shared document is kept as text too, marked shared', () => {
  assert.equal(entryFor({ handle: { copy: 'share-1', shared: true }, name: 'a.md', text: 'x' }).kind, 'shared')
})

test('a copy too long to keep is left out', () => {
  assert.equal(entryFor({ handle: { copy: 'c1' }, name: 'a.md', text: 'x'.repeat(2_000_001) }), null)
})

test('a real file is kept by its handle and folder', () => {
  const handle = file('a.md')
  const e = entryFor({ handle, name: 'a.md', dirPath: ['docs'], root: 'ROOT', text: 'x' }, 5)
  assert.deepEqual(e, { key: null, kind: 'file', name: 'a.md', dirPath: ['docs'], root: 'ROOT', handle, when: 5 })
})

test('add puts the newest first and drops the older entry of the same document', async () => {
  const list = [{ key: 'url:a', name: 'a' }, { key: null, kind: 'file', handle: file('b.md') }]
  const next = await add(list, { key: null, kind: 'file', handle: file('b.md'), name: 'b.md' }, sameFile)
  assert.equal(next.length, 2)
  assert.equal(next[0].name, 'b.md')
  assert.equal(next[1].key, 'url:a')
})

test(`add keeps at most ${MAX_RECENT}`, async () => {
  let list = []
  for (let i = 0; i < MAX_RECENT + 3; i++) list = await add(list, { key: `url:${i}` }, sameFile)
  assert.equal(list.length, MAX_RECENT)
  assert.equal(list[0].key, `url:${MAX_RECENT + 2}`)
})

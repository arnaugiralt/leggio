import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entryFor, add, MAX_RECENT, docKey, keepScroll, scrollOf } from '../src/recent.js'

const file = name => ({ kind: 'file', name, isSame: other => other.name === name })
const sameFile = async (a, b) => a.isSame(b)

test('a web document is kept by its address', () => {
  const e = entryFor({ handle: { web: 'https://x.test/a.md', copy: 'url:https://x.test/a.md' }, name: 'a.md', text: '# A' }, 5)
  assert.deepEqual(e, { key: 'url:https://x.test/a.md', kind: 'web', name: 'a.md', url: 'https://x.test/a.md', when: 5 })
})

test('a copy keeps its text and its date, so it can come back after a reload', () => {
  const e = entryFor({ handle: { copy: 'c1', file: { size: 3, lastModified: 7 } }, name: 'a.md', dirPath: ['docs'], text: '# A' }, 5)
  assert.equal(e.kind, 'copy')
  assert.equal(e.text, '# A')
  assert.equal(e.modified, 7)
  assert.equal(e.key, 'copy:docs/a.md:3:7')
})

test('two shared documents with the same name both stay', async () => {
  const one = entryFor({ handle: { copy: 'share-1', shared: true }, name: 'notes.md', text: 'one' })
  const two = entryFor({ handle: { copy: 'share-2', shared: true }, name: 'notes.md', text: 'two' })
  assert.equal((await add([one], two, async () => false)).length, 2)
})

test('a shared document is kept as text too, marked shared', () => {
  assert.equal(entryFor({ handle: { copy: 'share-1', shared: true }, name: 'a.md', text: 'x' }).kind, 'shared')
})

test('a copy too long to keep is left out', () => {
  assert.equal(entryFor({ handle: { copy: 'c1' }, name: 'a.md', text: 'x'.repeat(1_000_001) }), null)
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

test('docKey names a document the same way each time it opens', () => {
  assert.equal(docKey({ web: 'https://x.test/a.md' }, null, 'a.md'), 'url:https://x.test/a.md')
  assert.equal(docKey({ copy: 'c1', file: { size: 3, lastModified: 7 } }, ['docs'], 'a.md'), 'copy:docs/a.md:3:7')
  assert.equal(docKey({ copy: 'share-1', shared: true }, null, 'a.md'), 'shared:share-1')
  assert.equal(docKey({ kind: 'file' }, ['docs'], 'a.md', { name: 'handbook' }), 'file:handbook/docs/a.md')
})

test('README.md in two folders keeps two positions', () => {
  assert.notEqual(docKey({ kind: 'file' }, [], 'README.md', { name: 'one' }), docKey({ kind: 'file' }, [], 'README.md', { name: 'two' }))
})

test('scroll positions are kept per document, the oldest dropped past the limit', () => {
  const store = new Map()
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  for (let i = 0; i < 205; i++) keepScroll(`file:${i}.md`, i * 10, storage)
  assert.equal(scrollOf('file:204.md', storage), 2040)
  assert.equal(scrollOf('file:0.md', storage), null)
  keepScroll('file:204.md', 0, storage)
  assert.equal(scrollOf('file:204.md', storage), null) // the top is where every document starts anyway
})

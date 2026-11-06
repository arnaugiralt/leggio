import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encode, decode, shareId } from '../src/share.js'

const reason = r => err => err.reason === r

test('round-trips a document', async () => {
  assert.deepEqual(await decode(await encode('notes.md', '# Hi\n')), { name: 'notes.md', text: '# Hi\n' })
})

test('round-trips unicode name and text', async () => {
  const doc = { name: '情報 📝.md', text: 'שלום — 😀\n' }
  assert.deepEqual(await decode(await encode(doc.name, doc.text)), doc)
})

test('line breaks in the name become spaces', async () => {
  assert.equal((await decode(await encode('a\nb.md', 'x'))).name, 'a b.md')
})

test('encode output is url-safe', async () => {
  assert.match(await encode('a.md', '?&#/+= '.repeat(200) + Math.random()), /^1\.[A-Za-z0-9_-]+$/)
})

test('decode rejects an unknown version', async () => {
  await assert.rejects(decode('2.abc'), reason('version'))
})

test('decode rejects a truncated link', async () => {
  const text = Array.from({ length: 300 }, (_, i) => `line ${i} ${Math.random()}`).join('\n')
  const code = await encode('a.md', text)
  await assert.rejects(decode(code.slice(0, code.length / 2)), reason('damaged'))
  await assert.rejects(decode('1.%%%'), reason('damaged'))
})

test('decode stops at the size cap', async () => {
  const code = await encode('big.md', 'x'.repeat(6_000_000))
  assert.ok(code.length < 50_000)
  await assert.rejects(decode(code), reason('too-large'))
})

test('shareId is stable and short', async () => {
  const code = await encode('a.md', 'x')
  assert.equal(await shareId(code), await shareId(code))
  assert.match(await shareId(code), /^share-[0-9a-f]{16}$/)
})

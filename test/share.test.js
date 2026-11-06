import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encode, decode, shareId, rawUrl, readLink, webName } from '../src/share.js'

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

test('rawUrl rewrites a GitHub blob', () => {
  assert.equal(rawUrl('https://github.com/a/b/blob/main/docs/x.md'), 'https://raw.githubusercontent.com/a/b/main/docs/x.md')
})

test('rawUrl rewrites a gist page', () => {
  assert.equal(rawUrl('https://gist.github.com/a/0123abcd'), 'https://gist.githubusercontent.com/a/0123abcd/raw')
})

test('rawUrl keeps other https', () => {
  assert.equal(rawUrl('https://example.com/a.md?x=1'), 'https://example.com/a.md?x=1')
})

test('rawUrl refuses http and junk', () => {
  for (const url of ['http://example.com/a.md', 'ftp://x', 'not a url']) assert.equal(rawUrl(url), null)
})

test('readLink reads both Leggio links from any origin', () => {
  assert.deepEqual(readLink('https://leggio.compostela.dev/#share=1.abc'), { share: '1.abc' })
  assert.deepEqual(readLink('http://localhost:8000/#url=https%3A%2F%2Fx.test%2Fa.md'), { url: 'https://x.test/a.md' })
})

test('readLink takes a plain https address', () => {
  assert.deepEqual(readLink('  https://x.test/a.md\n'), { url: 'https://x.test/a.md' })
})

test('readLink ignores text', () => {
  for (const text of ['hello', '', 'https://x.test/a.md see this', 'https://x.test/a.md\nhttps://x.test/b.md']) assert.equal(readLink(text), null)
})

// An http address is a link the reader meant, so openLink can say why it won't open.
test('readLink takes an http address', () => {
  assert.deepEqual(readLink('http://x.test/a.md'), { url: 'http://x.test/a.md' })
})

test('readLink survives a malformed Leggio link', () => {
  assert.equal(readLink('https://leggio.compostela.dev/#url=%E0%A4%A'), null)
})

// Only a fragment that holds an address is a Leggio #url= link; any other page with one is a page.
test('readLink keeps an ordinary page whose fragment looks like a link', () => {
  assert.deepEqual(readLink('https://example.com/page#url=foo'), { url: 'https://example.com/page#url=foo' })
})

test('webName decodes the last segment', () => {
  assert.equal(webName('https://x.test/docs/My%20notes.md'), 'My notes.md')
  assert.equal(webName('https://x.test/'), 'Document')
})

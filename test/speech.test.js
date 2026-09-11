import test from 'node:test'
import assert from 'node:assert/strict'
import { sentences, resolveVoice } from '../src/speech.js'

const spans = text => sentences(text).map(({ start, end }) => text.slice(start, end).trim())

test('an abbreviation never ends a chunk', () => {
  // Intl.Segmenter alone breaks after "Dr.", which is spoken as a pause in the wrong place.
  const text = 'A long opening sentence that comfortably clears the eighty character floor on its own. Dr. Smith wrote the spec back in March.'
  assert.deepEqual(spans(text), [
    'A long opening sentence that comfortably clears the eighty character floor on its own.',
    'Dr. Smith wrote the spec back in March.',
  ])
})

test('initials and e.g. hold the sentence together', () => {
  const text = 'The spec covers diagrams, e.g. the mermaid ones, and was reviewed by J. R. Hartley before the release went out.'
  assert.deepEqual(spans(text), [text])
})

test('short sentences merge so the queue does not stutter', () => {
  assert.deepEqual(spans('Yes. No. Maybe.'), ['Yes. No. Maybe.'])
})

test('merging stops at the length cap', () => {
  const long = `A sentence of quite some length that runs past the floor on its own ${'and onward '.repeat(8)}to the end.`
  const out = spans(`Short. ${long} Also short.`)
  assert.equal(out.length, 2)
  assert.ok(out[0].startsWith('Short.'), 'the short opener merges forward')
  assert.equal(out[1], 'Also short.', 'a chunk past the cap does not swallow the next sentence')
})

test('chunks cover the text with no gaps or overlaps', () => {
  const text = 'One sentence here, long enough to stand alone without being merged into its neighbour. Another one follows it, also long enough to stand by itself. A third.'
  const out = sentences(text)
  assert.equal(out[0].start, 0)
  for (let i = 1; i < out.length; i++) assert.equal(out[i].start, out[i - 1].end)
  assert.equal(out.at(-1).end, text.length)
})

test('whitespace-only input yields nothing to speak', () => {
  assert.deepEqual(spans('   \n\n  '), [])
})

test('an unreachable or missing voice falls back to a local one', () => {
  // node has no navigator.onLine, which is precisely the offline case this guards.
  globalThis.speechSynthesis = {
    getVoices: () => [
      { name: 'Google UK English Male', localService: false },
      { name: 'Samantha', localService: true, default: true },
      { name: 'Daniel', localService: true },
    ],
  }
  assert.equal(resolveVoice('Daniel').name, 'Daniel', 'a local voice is used as asked')
  assert.equal(resolveVoice('Google UK English Male').name, 'Samantha', 'a network voice offline falls back to the default local one')
  assert.equal(resolveVoice('Gone').name, 'Samantha', 'a name from another browser falls back too')
  delete globalThis.speechSynthesis
})

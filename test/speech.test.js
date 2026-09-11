import test from 'node:test'
import assert from 'node:assert/strict'
import { sentences, resolveVoice, play, stop, subscribe, retune } from '../src/speech.js'

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

// A fake engine, because the bug lives in how the queue reacts to the events, not in the audio.
function stubSynthesis({ fireStart, fireEnd = true }) {
  const synth = {
    spoken: [],
    voices: [],
    cancelled: 0,
    getVoices: () => [
      { name: 'Local', localService: true, default: true },
      { name: 'Other', localService: true },
    ],
    cancel() {
      this.cancelled++
    },
    pause() {},
    resume() {},
    speak(u) {
      this.spoken.push(u.text)
      this.voices.push(u.voice?.name)
      if (fireStart) u.onstart?.()
      if (fireEnd) u.onend?.()
    },
  }
  globalThis.speechSynthesis = synth
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text
    }
  }
  return synth
}

const CHUNKS = ['One sentence.', 'Two sentences.', 'Three sentences.']

test('a muted tab halts the queue instead of draining it', () => {
  // A muted tab ends every utterance without ever starting it. Chaining on that used to race
  // through the whole document and drag the page to the last sentence.
  const synth = stubSynthesis({ fireStart: false })
  let state
  const unsubscribe = subscribe(s => (state = s))
  play(CHUNKS, { voiceName: 'Local' })
  assert.equal(synth.spoken.length, 1, 'it stops after the first utterance fails to start')
  assert.equal(state.index, 0, 'and holds its place')
  assert.equal(state.stalled, true, 'so the player can say why nothing is happening')
  unsubscribe()
  stop()
  delete globalThis.speechSynthesis
  delete globalThis.SpeechSynthesisUtterance
})

test('a voice that actually starts drains the queue', () => {
  const synth = stubSynthesis({ fireStart: true })
  let state
  const unsubscribe = subscribe(s => (state = s))
  play(CHUNKS, { voiceName: 'Local' })
  assert.deepEqual(synth.spoken, CHUNKS, 'every chunk is spoken in order')
  assert.equal(state.playing, false, 'and the queue closes itself at the end')
  assert.equal(state.stalled, false)
  unsubscribe()
  stop()
  delete globalThis.speechSynthesis
  delete globalThis.SpeechSynthesisUtterance
})

test('changing the voice mid-read restarts the sentence being spoken', async () => {
  // fireEnd false holds the queue on its first utterance, the way a real voice mid-sentence would.
  const synth = stubSynthesis({ fireStart: true, fireEnd: false })
  play(CHUNKS, { voiceName: 'Local' })
  assert.deepEqual(synth.voices, ['Local'])

  retune({ voiceName: 'Other', rate: 1 })
  await new Promise(r => setTimeout(r, 10)) // retune cancels, then speaks on the next tick
  assert.deepEqual(synth.spoken, [CHUNKS[0], CHUNKS[0]], 'the same sentence is spoken again')
  assert.deepEqual(synth.voices, ['Local', 'Other'], 'the second time on the new voice')

  stop()
  delete globalThis.speechSynthesis
  delete globalThis.SpeechSynthesisUtterance
})

test('retune with nothing changed leaves the utterance alone', async () => {
  const synth = stubSynthesis({ fireStart: true, fireEnd: false })
  play(CHUNKS, { voiceName: 'Local' })
  retune({ voiceName: 'Local', rate: 1 })
  await new Promise(r => setTimeout(r, 10))
  assert.equal(synth.spoken.length, 1, 'no restart, so no stutter while the settings sheet is open')

  stop()
  delete globalThis.speechSynthesis
  delete globalThis.SpeechSynthesisUtterance
})

// The only module that talks to speechSynthesis. Nothing here touches the document: the caller
// owns the text, the ranges and the scrolling, so this file stays testable under node.

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'sentence' })

// Chrome leaves a gap between queued utterances, so a run of short sentences sounds clipped.
// Merging under this length trades highlight precision for continuity.
const MIN_CHARS = 80
// ponytail: keeps an utterance under the ~15s where Chrome truncates a long one, and keeps the
// first network round trip short. A single sentence past this is left whole; splitting inside a
// sentence wrecks the prosody. Split on commas if a real document ever trips it.
const MAX_CHARS = 200

export const supported =
  typeof speechSynthesis !== 'undefined' && typeof Intl.Segmenter === 'function'

// Intl.Segmenter breaks after a common abbreviation, so "Dr. Smith" arrives as two sentences and
// is spoken with a pause in the wrong place. This is the short list that turns up in prose plus
// single-letter initials; a heuristic, not a parser. A wrong join only costs a missing pause,
// while a wrong split is audible, so this errs toward joining.
const ABBREV = /\b(?:[A-Z]|Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|cf|Fig|No|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.\s*$/

// Sentence spans over one string, short ones merged forward. Offsets index into `text`.
export function sentences(text) {
  const out = []
  let open = null
  for (const { segment, index } of SEGMENTER.segment(text)) {
    if (!segment.trim()) continue
    const end = index + segment.length
    const dangling = open && ABBREV.test(text.slice(open.start, open.end))
    const tooShort = open && open.end - open.start < MIN_CHARS && end - open.start <= MAX_CHARS
    if (dangling || tooShort) open.end = end
    else out.push((open = { start: index, end }))
  }
  return out
}

export function voices() {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices()
}

// The stored name can be missing (another browser, another machine) or unreachable (a network
// voice with no connection), so resolution always ends at a local voice.
export function resolveVoice(name) {
  const all = voices()
  const wanted = all.find(v => v.name === name)
  if (wanted && (wanted.localService || globalThis.navigator?.onLine)) return wanted
  return localFallback(all) ?? all[0] ?? null
}

const localFallback = all => all.find(v => v.localService && v.default) ?? all.find(v => v.localService)

// Nothing tells a page that its tab is muted, so the only honest signal is silence: an utterance
// that never reports starting. The same watchdog catches a wedged engine or a voice that never
// arrives, which from the reader's side is the same complaint - it did nothing.
const STALL_MS = 3000

let queue = []
let index = -1
let voice = null
let rate = 1
let paused = false
let current = null // the utterance we are chained to; a superseded one must not advance the queue
let stalled = false
let stallTimer = 0
const listeners = new Set()

// Word boundaries fire several times a second, so they bypass subscribe() and its re-render: the
// caller gets a raw callback and is expected to paint without going through component state.
// Only local voices fire these at all; a cloud voice simply never calls it.
let onWord = null
export function setWordHandler(fn) {
  onWord = fn
}

export function subscribe(fn) {
  listeners.add(fn)
  fn(state())
  return () => listeners.delete(fn)
}

const state = () => ({ index, playing: index >= 0, paused, stalled })
const emit = () => listeners.forEach(fn => fn(state()))

export function play(chunks, { from = 0, voiceName = '', rate: speed = 1 } = {}) {
  stop()
  queue = chunks
  voice = resolveVoice(voiceName)
  rate = speed
  speakAt(Math.min(Math.max(from, 0), chunks.length - 1))
}

function speakAt(i) {
  if (i < 0 || i >= queue.length) return stop()
  index = i
  const u = new SpeechSynthesisUtterance(queue[i])
  if (voice) u.voice = voice
  u.rate = rate
  let started = false
  u.onstart = () => {
    started = true
    clearTimeout(stallTimer)
    if (!stalled) return
    stalled = false
    emit()
  }
  // A muted tab ends every utterance at once without ever starting it. Chained, that drains the
  // whole queue as fast as JS runs and drags the page to the last sentence, which is what a reader
  // sees as "it scrolled to the bottom by itself". An end without a start never played: halt there.
  u.onend = () => {
    if (current !== u) return
    if (!started) return halt()
    speakAt(i + 1)
  }
  u.onboundary = e => {
    if (current === u && e.name === 'word') onWord?.(i, e.charIndex, e.charLength)
  }
  u.onerror = e => {
    if (current !== u) return // cancel() reports 'interrupted' on the utterance we just replaced
    if (e.error === 'interrupted' || e.error === 'canceled') return
    // A network voice can drop mid-document. Finish the read on a local one rather than stop dead.
    const local = localFallback(voices())
    if (voice && !voice.localService && local) {
      voice = local
      speakAt(i)
    } else stop()
  }
  current = u
  paused = false
  clearTimeout(stallTimer)
  stallTimer = setTimeout(() => {
    stalled = true
    emit()
  }, STALL_MS)
  speechSynthesis.speak(u)
  emit()
}

// Stop speaking but hold the place, so the hint has something to sit on and skipping retries.
function halt() {
  current = null
  clearTimeout(stallTimer)
  speechSynthesis.cancel()
  stalled = true
  paused = false
  emit()
}

function cancel() {
  current = null
  clearTimeout(stallTimer)
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function stop() {
  cancel()
  queue = []
  index = -1
  paused = false
  stalled = false
  emit()
}

export function skip(delta) {
  if (index < 0) return
  const next = index + delta
  cancel()
  // speak() in the same tick as cancel() is dropped often enough in Chrome that the next tick is
  // the accepted fix.
  setTimeout(() => speakAt(next), 0)
}

// Settings changed mid-read. A voice cannot be swapped inside an utterance, so the sentence being
// spoken restarts on the new one and the rest of the queue simply follows. While paused there is
// nothing to restart, so the new values wait for the next sentence.
export function retune({ voiceName = '', rate: speed = 1 } = {}) {
  const next = resolveVoice(voiceName)
  const changed = next?.name !== voice?.name || speed !== rate // by name: getVoices() need not return the same objects twice
  voice = next
  rate = speed
  if (!changed || index < 0 || paused) return
  const at = index
  cancel()
  setTimeout(() => speakAt(at), 0) // same cancel-then-next-tick dance as skip()
}

export function toggle() {
  if (index < 0) return
  paused = !paused
  paused ? speechSynthesis.pause() : speechSynthesis.resume()
  emit()
}

// speechSynthesis is global to the tab and keeps talking after the page goes away.
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => speechSynthesis.cancel())

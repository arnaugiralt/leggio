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

let queue = []
let index = -1
let voice = null
let rate = 1
let paused = false
let current = null // the utterance we are chained to; a superseded one must not advance the queue
const listeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  fn(state())
  return () => listeners.delete(fn)
}

const state = () => ({ index, playing: index >= 0, paused })
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
  u.onend = () => current === u && speakAt(i + 1)
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
  speechSynthesis.speak(u)
  emit()
}

function cancel() {
  current = null
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function stop() {
  cancel()
  queue = []
  index = -1
  paused = false
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

export function toggle() {
  if (index < 0) return
  paused = !paused
  paused ? speechSynthesis.pause() : speechSynthesis.resume()
  emit()
}

// speechSynthesis is global to the tab and keeps talking after the page goes away.
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => speechSynthesis.cancel())

import { useEffect, useRef, useState } from 'preact/hooks'
import * as speech from './speech.js'

// Read aloud, one sentence per utterance. Everything DOM-shaped lives here; speech.js owns the queue.
// Blocks whose text is not prose: read aloud they are noise.
const SKIP = 'pre, table, .table-wrap, .diagram'
const HIGHLIGHT = 'spoken'

// One string per block with the text nodes behind it, so a sentence that straddles <strong> or
// <code> still becomes a single utterance and a single Range.
function blocks(article) {
  const out = []
  for (const el of article.children) {
    if (el.matches(SKIP)) continue
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    })
    let text = ''
    const parts = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      parts.push({ node: n, start: text.length })
      text += n.textContent
    }
    if (text.trim()) out.push({ text, parts })
  }
  return out
}

function rangeFor(parts, start, end) {
  const at = offset => {
    let hit = parts[0]
    for (const part of parts) {
      if (part.start > offset) break
      hit = part
    }
    return [hit.node, Math.min(offset - hit.start, hit.node.textContent.length)]
  }
  const range = document.createRange()
  range.setStart(...at(start))
  range.setEnd(...at(end))
  return range
}

function collect(article) {
  const out = []
  for (const { text, parts } of blocks(article)) {
    for (const { start, end } of speech.sentences(text)) {
      if (text.slice(start, end).trim()) out.push({ text: text.slice(start, end), range: rangeFor(parts, start, end) })
    }
  }
  return out
}

export function Speech({ articleRef, text, settings }) {
  const [{ playing, paused, index }, setStatus] = useState({ playing: false, paused: false, index: -1 })
  const items = useRef([])
  const follow = useRef(true)

  useEffect(() => speech.subscribe(setStatus), [])

  // A new document invalidates every Range we are holding.
  useEffect(() => () => speech.stop(), [text])

  useEffect(() => {
    if (!playing || index < 0) {
      CSS.highlights?.delete(HIGHLIGHT)
      return
    }
    const range = items.current[index]?.range
    if (!range) return
    CSS.highlights?.set(HIGHLIGHT, new Highlight(range))
    if (!follow.current) return
    const rect = range.getBoundingClientRect()
    const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    if (rect.top < top || rect.bottom > innerHeight - 32) window.scrollTo({ top: scrollY + rect.top - innerHeight / 3 })
  }, [playing, index])

  // Reading follows the page until the reader takes the wheel back; skipping hands it over again.
  useEffect(() => {
    const release = () => (follow.current = false)
    for (const type of ['wheel', 'touchmove']) window.addEventListener(type, release, { passive: true })
    return () => {
      for (const type of ['wheel', 'touchmove']) window.removeEventListener(type, release)
    }
  }, [])

  function start() {
    const article = articleRef.current
    if (!article) return
    items.current = collect(article)
    if (!items.current.length) return
    // Start where the reader is looking, not at the top of a document they are halfway through.
    const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    const from = items.current.findIndex(i => i.range.getBoundingClientRect().bottom > top)
    follow.current = true
    speech.play(items.current.map(i => i.text), {
      from: from < 0 ? 0 : from,
      voiceName: settings.voice,
      rate: settings.speechRate,
    })
  }

  function jump(delta) {
    follow.current = true
    speech.skip(delta)
  }

  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape' && playing) speech.stop()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [playing])

  if (!speech.supported) return null
  // The bar button is the on/off switch and never changes width, so nothing beside it moves.
  // Everything else lives on the player, because reading is a mode and a mode gets its own surface.
  return (
    <>
      <button type="button" class="quiet reading-toggle" aria-pressed={playing} onClick={playing ? () => speech.stop() : start}>
        {playing ? 'Reading' : 'Read'}
      </button>
      {playing && (
        <div class="player" role="group" aria-label="Reading controls">
          <span class="player-count">
            {index + 1} of {items.current.length}
          </span>
          <button type="button" class="quiet" aria-label="Previous sentence" onClick={() => jump(-1)}>‹</button>
          <button type="button" class="quiet player-wide" onClick={() => speech.toggle()}>{paused ? 'Resume' : 'Pause'}</button>
          <button type="button" class="quiet" aria-label="Next sentence" onClick={() => jump(1)}>›</button>
        </div>
      )}
    </>
  )
}

import { useEffect, useState } from 'preact/hooks'

const TOP_OFFSET = 96 // px below the viewport top at which a heading counts as current
const JUMP_MS = 280 // Chromium's own smooth scroll scales with distance and crawls across a long document

// `behavior: instant` on every step: the root's scroll-behavior: smooth would otherwise
// queue a UA animation per frame. Cancelled by any real scroll input.
function scrollToY(target) {
  const start = window.scrollY
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || start === target) {
    window.scrollTo({ top: target, behavior: 'instant' })
    return
  }
  let cancelled = false
  const stop = () => { cancelled = true }
  for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, stop, { once: true, passive: true })
  const t0 = performance.now()
  const step = now => {
    const p = Math.min((now - t0) / JUMP_MS, 1)
    if (cancelled) return
    window.scrollTo({ top: start + (target - start) * (1 - (1 - p) ** 3), behavior: 'instant' })
    if (p < 1) requestAnimationFrame(step)
    else for (const type of ['wheel', 'touchstart', 'keydown']) removeEventListener(type, stop)
  }
  requestAnimationFrame(step)
}

// Reads headings from the rendered article so the document is parsed once.
// Shows nothing for documents with fewer than two headings.
export function Outline({ articleRef, text }) {
  const [headings, setHeadings] = useState([])
  const [active, setActive] = useState(null)

  useEffect(() => {
    const nodes = [...(articleRef.current?.querySelectorAll('h1, h2, h3, h4') ?? [])]
    setHeadings(nodes.map(h => ({ id: h.id, text: h.textContent, level: Number(h.tagName[1]) })))
  }, [text])

  useEffect(() => {
    if (headings.length < 2) return
    const nodes = headings.map(h => document.getElementById(h.id)).filter(Boolean)
    let frame = 0
    const update = () => {
      frame = 0
      let current = nodes[0].id
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= TOP_OFFSET) current = node.id
        else break
      }
      // Short trailing content can leave the last heading below TOP_OFFSET even at
      // max scroll. Snap to it once there is no more page left to scroll.
      const canScroll = document.documentElement.scrollHeight > window.innerHeight + 2
      if (canScroll && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = nodes[nodes.length - 1].id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [headings])

  if (headings.length < 2) return null

  function jump(e, id) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    scrollToY(el.getBoundingClientRect().top + window.scrollY - pad)
    // The panel stays open on :focus-within, so a mouse click would leave it up after
    // the pointer moves away. detail is 0 for a keyboard activation, which keeps focus.
    if (e.detail) e.currentTarget.blur()
  }

  return (
    <div class="outline">
      <div class="rail" aria-hidden="true">
        {headings.map(h => (
          <span key={h.id} class={`tick level-${h.level}${h.id === active ? ' active' : ''}`} />
        ))}
      </div>
      <nav class="panel" aria-label="Contents">
        <ol>
          {headings.map(h => (
            <li key={h.id} class={`level-${h.level}${h.id === active ? ' active' : ''}`}>
              <a href={`#${h.id}`} aria-current={h.id === active ? 'true' : undefined} onClick={e => jump(e, h.id)}>
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}

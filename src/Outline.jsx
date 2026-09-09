import { useEffect, useState } from 'preact/hooks'

const TOP_OFFSET = 96 // px below the viewport top at which a heading counts as current

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
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav class="outline" aria-label="Contents">
      <ol>
        {headings.map(h => (
          <li key={h.id} class={`level-${h.level}${h.id === active ? ' active' : ''}`}>
            <a href={`#${h.id}`} aria-current={h.id === active ? 'true' : undefined} onClick={e => jump(e, h.id)}>
              <span class="tick" aria-hidden="true" />
              <span class="title">{h.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

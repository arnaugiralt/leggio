import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { render } from './render.js'
import { isLocal, resolvePath, getFileByPath } from './fs.js'
import { X } from './icons.jsx'

// Renders markdown, then resolves relative images and links against the open folder in a DOM pass.
export function Viewer({ text, articleRef, root, dirPath, onFollow, onJump, onRelative }) {
  const html = useMemo(() => render(text), [text])
  const urls = useRef([])
  const [zoomed, setZoomed] = useState(null)

  useEffect(() => {
    const article = articleRef.current
    if (!article) return
    for (const a of article.querySelectorAll('a[href^="http:"], a[href^="https:"], a[href^="//"]')) {
      a.target = '_blank'
      a.rel = 'noopener'
    }
    urls.current.forEach(URL.revokeObjectURL)
    urls.current = []
    // Setting img.src also rewrites the src attribute, so the original relative path is
    // captured once per element and restored here before any re-resolution. Without this,
    // reopening the same (memoized, unchanged) html without folder context would leave a
    // stale, revoked blob: URL on the image instead of falling back to the relative path.
    for (const img of article.querySelectorAll('img[src]')) {
      if (img.dataset.origSrc === undefined) img.dataset.origSrc = img.getAttribute('src')
      img.src = img.dataset.origSrc
    }
    // Above the folder check: diagrams open in the lightbox with or without one.
    for (const fig of article.querySelectorAll('.diagram')) {
      fig.tabIndex = 0
      fig.setAttribute('role', 'button')
      fig.setAttribute('aria-label', 'Open diagram full size')
    }
    // Without a folder, relative images are broken and links cannot be followed: App offers the folder.
    onRelative(!dirPath && [...article.querySelectorAll('img[src], a[href]')].some(el => isLocal(el.getAttribute(el.localName === 'a' ? 'href' : 'src'))))
    if (!root || !dirPath) return
    let cancelled = false
    for (const img of article.querySelectorAll('img[src]')) {
      const src = img.dataset.origSrc
      if (!isLocal(src)) continue
      const segments = resolvePath(dirPath, src)
      if (!segments) continue
      getFileByPath(root, segments)
        .then(handle => handle.getFile())
        .then(file => {
          if (cancelled) return
          const url = URL.createObjectURL(file)
          urls.current.push(url)
          img.src = url
        })
        .catch(() => {}) // leave the original src; the browser shows a broken image with alt text
    }
    return () => {
      cancelled = true
    }
  }, [html, root, dirPath])

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])

  function zoom(target) {
    const svg = target.closest('.diagram')?.querySelector('svg')
    if (!svg) return false
    // The viewBox ratio sizes the dialog to the diagram: without it the svg letterboxes
    // inside a full-viewport box and the lightbox is mostly empty background.
    const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
    setZoomed({ html: svg.outerHTML, ratio: w && h ? w / h : null })
    return true
  }

  function onKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ' ') && zoom(e.target)) e.preventDefault()
  }

  function onClick(e) {
    if (zoom(e.target)) return
    const hashLink = e.target.closest('a[href^="#"]')
    if (hashLink) {
      e.preventDefault() // the native jump would add a history entry without the document in it
      onJump(decodeURIComponent(hashLink.getAttribute('href').slice(1)))
      return
    }
    const a = e.target.closest('a[href]')
    if (!a || !isLocal(a.getAttribute('href'))) return
    e.preventDefault() // a relative href would navigate the window itself away from the reader
    onFollow(a.getAttribute('href'))
  }

  return (
    <>
      <article ref={articleRef} class="prose" dangerouslySetInnerHTML={{ __html: html }} onClick={onClick} onKeyDown={onKeyDown} />
      {zoomed && <Lightbox {...zoomed} onClose={() => setZoomed(null)} />}
    </>
  )
}

// <dialog> carries the top layer, the backdrop, focus containment and Esc; only the
// backdrop click is ours. Mounted on demand, so there is no exit transition to stage.
function Lightbox({ html, ratio, onClose }) {
  const ref = useRef(null)
  useEffect(() => ref.current.showModal(), [])
  return (
    <dialog
      ref={ref}
      class="lightbox"
      style={ratio ? { '--diagram-ar': ratio } : undefined}
      onClose={onClose}
      onClick={() => ref.current.close()} // the whole surface is the way out; the svg fills it
    >
      <button type="button" class="lightbox-close quiet" aria-label="Close" title="Close (Esc)">
        <X size={18} />
      </button>
      {/* own element, so the button above is not wiped when the svg is set */}
      <div class="lightbox-svg" dangerouslySetInnerHTML={{ __html: html }} />
    </dialog>
  )
}

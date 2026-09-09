import { useEffect, useMemo, useRef } from 'preact/hooks'
import { render } from './render.js'
import { isRelative, isMarkdownName, resolvePath, getFileByPath } from './fs.js'

// Renders markdown, then resolves relative images and links against the open folder in a DOM pass.
export function Viewer({ text, articleRef, root, dirPath, onOpenRelative }) {
  const html = useMemo(() => render(text), [text])
  const urls = useRef([])

  useEffect(() => {
    const article = articleRef.current
    if (!article) return
    for (const a of article.querySelectorAll('a[href^="http:"], a[href^="https:"]')) {
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
    if (!root || !dirPath) return
    let cancelled = false
    for (const img of article.querySelectorAll('img[src]')) {
      const src = img.dataset.origSrc
      if (!isRelative(src)) continue
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
    for (const a of article.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (isRelative(href) && isMarkdownName(href.split('#')[0])) a.dataset.internal = ''
    }
    return () => {
      cancelled = true
    }
  }, [html, root, dirPath])

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])

  function onClick(e) {
    const a = e.target.closest('a[data-internal]')
    if (!a || !dirPath) return
    e.preventDefault()
    const [path, hash] = a.getAttribute('href').split('#')
    const segments = resolvePath(dirPath, path)
    if (segments) onOpenRelative(segments, hash)
  }

  return <article ref={articleRef} class="prose" dangerouslySetInnerHTML={{ __html: html }} onClick={onClick} />
}

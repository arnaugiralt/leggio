import { useMemo } from 'preact/hooks'
import { render } from './render.js'

export function Viewer({ text, articleRef }) {
  const html = useMemo(() => render(text), [text])
  return <article ref={articleRef} class="prose" dangerouslySetInnerHTML={{ __html: html }} />
}

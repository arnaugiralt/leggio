import { useMemo } from 'preact/hooks'
import { render } from './render.js'

export function Viewer({ text }) {
  const html = useMemo(() => render(text), [text])
  return <article class="prose" dangerouslySetInnerHTML={{ __html: html }} />
}

import { useEffect, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'

const MARKDOWN_NAME = /\.(md|markdown|txt)$/i

export function App() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')

  async function openFile(file) {
    if (!file) return
    if (!MARKDOWN_NAME.test(file.name) && !file.type.startsWith('text/')) {
      setError(`${file.name} is not a markdown or text file.`)
      return
    }
    try {
      setDoc({ name: file.name, text: await file.text() })
      setError('')
    } catch {
      setError(`Could not read ${file.name}.`)
    }
  }

  useEffect(() => {
    const prevent = e => e.preventDefault()
    const drop = e => {
      e.preventDefault()
      openFile(e.dataTransfer.files[0])
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return (
    <>
      <header class="bar">
        <label class="open">
          Open
          <input type="file" accept=".md,.markdown,.txt" onChange={e => openFile(e.currentTarget.files[0])} />
        </label>
        {doc && <span class="name">{doc.name}</span>}
      </header>
      {error && <p class="error">{error}</p>}
      {doc ? <Viewer text={doc.text} /> : <p class="empty">Drop a markdown file here, or use Open.</p>}
    </>
  )
}

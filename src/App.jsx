import { useEffect, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Settings } from './Settings.jsx'
import { DEFAULTS, load, save, applyToRoot, applyFontUrl } from './settings.js'

const MARKDOWN_NAME = /\.(md|markdown|txt)$/i

export function App() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(load)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    applyToRoot(settings)
    applyFontUrl(settings.fontUrl)
    save(settings)
  }, [settings])

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
        <button type="button" class="settings-toggle" onClick={() => setShowSettings(v => !v)}>
          {showSettings ? 'Close settings' : 'Settings'}
        </button>
      </header>
      {showSettings && (
        <aside class="settings-panel">
          <Settings settings={settings} onChange={patch => setSettings(prev => ({ ...prev, ...patch }))} onReset={() => setSettings({ ...DEFAULTS })} />
        </aside>
      )}
      {error && <p class="error">{error}</p>}
      {doc ? <Viewer text={doc.text} /> : <p class="empty">Drop a markdown file here, or use Open.</p>}
    </>
  )
}

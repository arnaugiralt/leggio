import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { DEFAULTS, load, save, applyToRoot, applyFontUrl } from './settings.js'

const MARKDOWN_NAME = /\.(md|markdown|txt)$/i
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

export function App() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(load)
  const [showSettings, setShowSettings] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef()
  const article = useRef()

  useEffect(() => {
    applyToRoot(settings)
    applyFontUrl(settings.fontUrl)
    save(settings)
  }, [settings])

  useEffect(() => {
    document.title = doc ? doc.name : 'md reader'
  }, [doc])

  async function openFile(file) {
    if (!file) return
    if (!MARKDOWN_NAME.test(file.name) && !file.type.startsWith('text/')) {
      setError(`${file.name} is not a markdown or text file.`)
      return
    }
    try {
      setDoc({ name: file.name, text: await file.text() })
      setError('')
      window.scrollTo(0, 0)
    } catch {
      setError(`Could not read ${file.name}.`)
    }
  }

  const pick = () => fileInput.current.click()

  useEffect(() => {
    const over = e => {
      e.preventDefault()
      setDragging(true)
    }
    // relatedTarget is null only when the pointer leaves the window.
    const leave = e => {
      if (!e.relatedTarget) setDragging(false)
    }
    const drop = e => {
      e.preventDefault()
      setDragging(false)
      openFile(e.dataTransfer.files[0])
    }
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        pick()
      } else if (e.key === 'Escape') {
        setShowSettings(false)
      }
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      window.removeEventListener('keydown', key)
    }
  }, [])

  return (
    <div class={`app${showSettings ? ' settings-open' : ''}${dragging ? ' dragging' : ''}`}>
      <header class="bar">
        <span class="bar-title">{doc ? doc.name : 'md reader'}</span>
        <div class="bar-actions">
          <button type="button" class="quiet" onClick={pick}>Open</button>
          <button type="button" class="quiet" aria-expanded={showSettings} aria-controls="settings" onClick={() => setShowSettings(v => !v)}>
            Settings
          </button>
        </div>
      </header>
      <input
        ref={fileInput}
        type="file"
        accept=".md,.markdown,.txt"
        hidden
        onChange={e => {
          openFile(e.currentTarget.files[0])
          e.currentTarget.value = ''
        }}
      />
      <main class="main">
        {error && <p class="error" role="alert">{error}</p>}
        {doc ? (
          <>
            <Outline articleRef={article} text={doc.text} />
            <Viewer text={doc.text} articleRef={article} />
          </>
        ) : (
          <div class="empty">
            <p class="empty-title">Drop a markdown file here</p>
            <button type="button" class="quiet primary" onClick={pick}>Open a file</button>
            <p class="empty-hint">
              or press <kbd>{isMac ? '⌘' : 'Ctrl'} O</kbd>
            </p>
          </div>
        )}
      </main>
      <aside id="settings" class="sheet" aria-label="Settings" aria-hidden={!showSettings}>
        <Settings settings={settings} onChange={patch => setSettings(prev => ({ ...prev, ...patch }))} onReset={() => setSettings({ ...DEFAULTS })} />
      </aside>
    </div>
  )
}

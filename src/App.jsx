import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { Sidebar } from './Sidebar.jsx'
import { DEFAULTS, load, save, applyToRoot, applyFontUrl } from './settings.js'
import * as fs from './fs.js'
import * as idb from './idb.js'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const UI_KEY = 'md-reader.ui'

function loadUi() {
  try {
    return { sidebarOpen: false, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') }
  } catch {
    return { sidebarOpen: false }
  }
}

export function App() {
  const [folder, setFolder] = useState(null) // { handle, name, tree }
  const [pinned, setPinned] = useState([]) // [{ kind, name, handle, missing? }]
  const [current, setCurrent] = useState(null) // { handle, name, dirPath, text }
  const [currentPinned, setCurrentPinned] = useState(false)
  const [restorable, setRestorable] = useState(null) // { folder, filePath }
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(load)
  const [showSettings, setShowSettings] = useState(false)
  const [ui, setUi] = useState(loadUi)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef()
  const article = useRef()
  const stopFileWatch = useRef(() => {})
  const stopFolderWatch = useRef(() => {})
  const keepScroll = useRef(null)

  useEffect(() => {
    applyToRoot(settings)
    applyFontUrl(settings.fontUrl)
    save(settings)
  }, [settings])

  useEffect(() => {
    localStorage.setItem(UI_KEY, JSON.stringify(ui))
  }, [ui])

  useEffect(() => {
    document.title = current ? current.name : 'md reader'
  }, [current])

  // Files opened from the OS: only fires in an installed PWA, and only once per launch.
  // The queue hands over real FileSystemFileHandles, so watching and relative images keep working.
  useEffect(() => {
    window.launchQueue?.setConsumer(({ files }) => {
      if (files?.length) openFile(files[0])
    })
  }, [])

  // Pins and the restore record, once.
  useEffect(() => {
    idb.get('pinned').then(items => items && setPinned(items))
    idb.get('last').then(last => last?.folder && setRestorable(last))
  }, [])

  // After a live reload re-render, put the reader back where they were.
  useEffect(() => {
    if (keepScroll.current !== null) {
      window.scrollTo(0, keepScroll.current)
      keepScroll.current = null
    }
  }, [current])

  // Is the current file pinned? isSameEntry is async, so this is derived in an effect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let found = false
      if (current?.handle) {
        for (const item of pinned) {
          if (item.kind === 'file' && (await item.handle.isSameEntry(current.handle))) found = true
        }
      }
      if (!cancelled) setCurrentPinned(found)
    })()
    return () => {
      cancelled = true
    }
  }, [current, pinned])

  async function openFolder(handle) {
    try {
      if (!(await fs.ensurePermission(handle))) {
        setError(`Access to ${handle.name} was not granted.`)
        return false
      }
      const tree = await fs.listMarkdown(handle)
      setFolder({ handle, name: handle.name, tree })
      setUi(u => ({ ...u, sidebarOpen: true })) // show the result; otherwise opening a folder looks like nothing happened
      setRestorable(null)
      setError('')
      idb.set('last', { folder: handle, filePath: null })
      stopFolderWatch.current()
      let timer = 0
      const relist = () => {
        clearTimeout(timer)
        timer = setTimeout(async () => {
          try {
            const tree = await fs.listMarkdown(handle)
            setFolder(f => (f && f.handle === handle ? { ...f, tree } : f))
          } catch {}
        }, 300)
      }
      const stopWatch = fs.watch(handle, relist)
      window.addEventListener('focus', relist)
      stopFolderWatch.current = () => {
        stopWatch()
        window.removeEventListener('focus', relist)
        clearTimeout(timer)
      }
      return true
    } catch {
      setError(`Could not open ${handle.name}.`)
      return false
    }
  }

  // dirPath and root are set when the file lives inside an open folder; null otherwise.
  async function openFile(handle, { dirPath = null, root = null } = {}) {
    try {
      if (!(await fs.ensurePermission(handle))) {
        setError(`Access to ${handle.name} was not granted.`)
        return false
      }
      const text = await fs.readText(handle)
      setCurrent({ handle, name: handle.name, dirPath, text })
      setRestorable(null)
      setError('')
      window.scrollTo(0, 0)
      if (root && dirPath) idb.set('last', { folder: root, filePath: [...dirPath, handle.name] })
      stopFileWatch.current()
      stopFileWatch.current = fs.watch(handle, async () => {
        try {
          const next = await fs.readText(handle)
          setCurrent(c => {
            if (!c || c.handle !== handle || c.text === next) return c
            keepScroll.current = window.scrollY
            return { ...c, text: next }
          })
        } catch {
          setError(`${handle.name} was deleted or moved.`)
          stopFileWatch.current() // nothing left to watch
        }
      })
      return true
    } catch {
      setError(`Could not read ${handle.name}.`)
      return false
    }
  }

  // Plain File objects from the input element or a non-Chromium drop. No handle, no watch, no relative resolution.
  async function openBlob(file) {
    if (!file) return
    if (!fs.isMarkdownName(file.name) && !file.type.startsWith('text/')) {
      setError(`${file.name} is not a markdown or text file.`)
      return
    }
    try {
      stopFileWatch.current()
      setCurrent({ handle: null, name: file.name, dirPath: null, text: await file.text() })
      setRestorable(null)
      setError('')
      window.scrollTo(0, 0)
    } catch {
      setError(`Could not read ${file.name}.`)
    }
  }

  async function openRelative(segments, hash) {
    if (!folder) return
    try {
      const handle = await fs.getFileByPath(folder.handle, segments)
      await openFile(handle, { dirPath: segments.slice(0, -1), root: folder.handle })
      if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
    } catch {
      setError(`${segments.join('/')} not found in this folder.`)
    }
  }

  async function openPinned(item, index) {
    const ok = item.kind === 'directory' ? await openFolder(item.handle) : await openFile(item.handle)
    if (!ok) setPinned(p => p.map((x, i) => (i === index ? { ...x, missing: true } : x)))
  }

  async function togglePin(item) {
    let index = -1
    for (let i = 0; i < pinned.length; i++) if (await pinned[i].handle.isSameEntry(item.handle)) index = i
    const next = index >= 0 ? pinned.filter((_, i) => i !== index) : [...pinned, { kind: item.kind, name: item.name, handle: item.handle }]
    setPinned(next)
    idb.set('pinned', next.map(({ kind, name, handle }) => ({ kind, name, handle })))
  }

  async function restore() {
    const last = restorable
    if (!(await openFolder(last.folder))) return
    if (!last.filePath) return
    try {
      const handle = await fs.getFileByPath(last.folder, last.filePath)
      await openFile(handle, { dirPath: last.filePath.slice(0, -1), root: last.folder })
    } catch {
      setError(`${last.filePath.join('/')} was not found.`)
    }
  }

  async function pickFile() {
    if (!fs.supported) return fileInput.current.click()
    const handle = await fs.pickFile()
    if (handle) openFile(handle)
  }

  async function pickFolder() {
    const handle = await fs.pickDirectory()
    if (handle) openFolder(handle)
  }

  const toggleSidebar = () => setUi(u => ({ ...u, sidebarOpen: !u.sidebarOpen }))

  useEffect(() => {
    window.mdreader = { openFolder, openFile }
    const over = e => {
      e.preventDefault()
      setDragging(true)
    }
    const leave = e => {
      if (!e.relatedTarget) setDragging(false)
    }
    const drop = async e => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0] // read synchronously; the list is gone after the event
      const handle = await fs.handleFromDrop(e.dataTransfer)
      if (handle?.kind === 'directory') openFolder(handle)
      else if (handle?.kind === 'file') openFile(handle)
      else openBlob(file)
    }
    const key = e => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        e.shiftKey ? pickFolder() : pickFile()
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
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
      stopFileWatch.current()
      stopFolderWatch.current()
    }
  }, [])

  const classes = ['app', ui.sidebarOpen && 'sidebar-open', showSettings && 'settings-open', dragging && 'dragging'].filter(Boolean).join(' ')

  return (
    <div class={classes}>
      <header class="bar">
        <div class="bar-actions">
          <button type="button" class="quiet" aria-expanded={ui.sidebarOpen} aria-controls="files" onClick={toggleSidebar}>
            Files
          </button>
        </div>
        <span class="bar-title">{current ? current.name : 'md reader'}</span>
        <div class="bar-actions">
          {current?.handle && (
            <button type="button" class="quiet" onClick={() => togglePin({ kind: 'file', name: current.name, handle: current.handle })}>
              {currentPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button type="button" class="quiet" onClick={pickFile}>Open</button>
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
          openBlob(e.currentTarget.files[0])
          e.currentTarget.value = ''
        }}
      />
      <nav id="files" class="side" aria-label="Files" aria-hidden={!ui.sidebarOpen}>
        <Sidebar folder={folder} pinned={pinned} current={current} onOpenFile={(h, dirPath, root) => openFile(h, { dirPath, root })} onOpenPinned={openPinned} onPickFolder={pickFolder} onTogglePin={togglePin} />
      </nav>
      <main class="main">
        {error && <p class="error" role="alert">{error}</p>}
        {current ? (
          <>
            <Outline articleRef={article} text={current.text} />
            <Viewer text={current.text} articleRef={article} root={folder?.handle ?? null} dirPath={current.dirPath} onOpenRelative={openRelative} />
          </>
        ) : (
          <div class="empty">
            <p class="empty-title">{restorable ? 'Welcome back' : 'Drop a markdown file or folder here'}</p>
            {restorable ? (
              <button type="button" class="quiet primary" onClick={restore}>Continue in {restorable.folder.name}</button>
            ) : (
              <button type="button" class="quiet primary" onClick={pickFile}>Open a file</button>
            )}
            <div class="empty-actions">
              {restorable && <button type="button" class="quiet" onClick={pickFile}>Open a file</button>}
              {fs.supported && <button type="button" class="quiet" onClick={pickFolder}>Open a folder</button>}
            </div>
            <p class="empty-hint">
              <kbd>{isMac ? '⌘' : 'Ctrl'} O</kbd> file, <kbd>{isMac ? '⌘' : 'Ctrl'} ⇧ O</kbd> folder, <kbd>{isMac ? '⌘' : 'Ctrl'} B</kbd> files panel
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

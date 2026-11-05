import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Speech } from './Speech.jsx'
import { DEFAULTS, load, save, applyToRoot, applyFontUrl } from './settings.js'
import * as fs from './fs.js'
import { useLibrary, FOLDER_NOTICE } from './useLibrary.js'
import { ChevronLeft, ChevronRight } from './icons.jsx'

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
  const [settings, setSettings] = useState(load)
  const [showSettings, setShowSettings] = useState(false)
  const [ui, setUi] = useState(loadUi)
  const [dragging, setDragging] = useState(false)
  const [hasRelative, setHasRelative] = useState(false)
  const [folderOfferHidden, setFolderOfferHidden] = useState(false)
  const fileInput = useRef()
  const article = useRef()
  const { folder, pinned, current, currentPinned, restorable, notice, setNotice, back, forward, openFolder, openFolderFor, openFile, openBlob, followLink, openPinned, togglePin, restore, jumpTo } = useLibrary({
    onFolderOpen: () => setUi(u => ({ ...u, sidebarOpen: true })),
  })

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

  // Keyed on the handle, not current: a live reload of the same file must not bring the offer back.
  useEffect(() => setFolderOfferHidden(false), [current?.handle])

  async function pickFile() {
    if (!fs.supported) return fileInput.current.click()
    const handle = await fs.pickFile()
    if (handle) openFile(handle)
  }

  async function pickFolder() {
    const handle = await fs.pickDirectory()
    if (handle) openFolder(handle)
  }

  async function pickFolderForCurrent() {
    const handle = await fs.pickDirectory({ startIn: current?.handle })
    if (handle) openFolderFor(handle)
  }

  const toggleSidebar = () => setUi(u => ({ ...u, sidebarOpen: !u.sidebarOpen }))

  useEffect(() => {
    window.mdreader = { openFolder, openFile, openFolderFor }
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
      } else if (mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault() // in a tab, Chrome's own ⌘[ would also go back, out of the app when the button is disabled
        if (e.key === '[' ? window.navigation?.canGoBack : window.navigation?.canGoForward) e.key === '[' ? history.back() : history.forward()
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
    }
  }, [])

  // Relative links and images cannot resolve without the file's folder; a stated problem wins over this offer.
  const shown = notice ?? (current?.handle && fs.supported && hasRelative && !folderOfferHidden ? FOLDER_NOTICE : null)
  const actions = {
    another: ['Open another file', () => (folder ? setUi(u => ({ ...u, sidebarOpen: true })) : pickFile())],
    folder: ['Open folder', pickFolderForCurrent],
  }
  const classes = ['app', ui.sidebarOpen && 'sidebar-open', showSettings && 'settings-open', dragging && 'dragging'].filter(Boolean).join(' ')

  return (
    <div class={classes}>
      <header class="bar">
        <div class="bar-actions">
          <button type="button" class="quiet" aria-expanded={ui.sidebarOpen} aria-controls="files" onClick={toggleSidebar}>
            Files
          </button>
          {current && (
            <>
              <button type="button" class="quiet nav" aria-label="Back" title={back ? `Back to ${back}` : 'Back'} disabled={back === null} onClick={() => history.back()}>
                <ChevronLeft />
              </button>
              <button type="button" class="quiet nav" aria-label="Forward" title={forward ? `Forward to ${forward}` : 'Forward'} disabled={forward === null} onClick={() => history.forward()}>
                <ChevronRight />
              </button>
            </>
          )}
        </div>
        <span class="bar-title">{current ? current.name : 'md reader'}</span>
        <div class="bar-actions">
          {current && <Speech articleRef={article} text={current.text} settings={settings} />}
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
        {shown && (
          <div class="notice" role="status">
            <span>{shown.text}</span>
            <span class="notice-buttons">
              {shown.action && <button type="button" class="quiet notice-action" onClick={actions[shown.action][1]}>{actions[shown.action][0]}</button>}
              {shown.action !== 'another' && <button type="button" class="quiet" aria-label="Dismiss" onClick={() => { setNotice(null); setFolderOfferHidden(true) }}>✕</button>}
            </span>
          </div>
        )}
        {current ? (
          <>
            <Outline articleRef={article} text={current.text} />
            <Viewer text={current.text} articleRef={article} root={folder?.handle ?? null} dirPath={current.dirPath} onFollow={followLink} onJump={jumpTo} onRelative={setHasRelative} />
          </>
        ) : (
          <div class="empty">
            <p class="empty-title">{restorable ? 'Welcome back' : 'Drop a markdown file or folder here'}</p>
            {restorable ? (
              <button type="button" class="quiet primary" onClick={() => restore()}>Continue in {restorable.folder.name}</button>
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

import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Speech } from './Speech.jsx'
import { DEFAULTS, load, save, applyToRoot, applyFontUrl } from './settings.js'
import * as fs from './fs.js'
import { useLibrary, FOLDER_NOTICE } from './useLibrary.js'
import { ChevronLeft, ChevronRight, List, X } from './icons.jsx'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const UI_KEY = 'md-reader.ui'
const TIP_KEY = 'md-reader.install-tip-dismissed'

// Below this the panels are overlays, not columns (keep in step with the max-width in styles.css).
const narrow = () => matchMedia('(max-width: 759.98px)').matches

function loadUi() {
  try {
    const ui = { sidebarOpen: false, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') }
    // A drawer remembered from a wide window must not open over the document.
    return narrow() ? { ...ui, sidebarOpen: false } : ui
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
  const [hasContents, setHasContents] = useState(false)
  const [folderOfferHidden, setFolderOfferHidden] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)
  const [tipHidden, setTipHidden] = useState(() => {
    try {
      return !!localStorage.getItem(TIP_KEY)
    } catch {
      return false
    }
  })
  const fileInput = useRef()
  const article = useRef()
  const { folder, pinned, current, currentPinned, restorable, notice, setNotice, back, forward, openFolder, openFolderFor, openFile, openBlob, followLink, openPinned, togglePin, restore, jumpTo } = useLibrary({
    // A drawer would cover the document the folder is about to open (and every restore); the empty state has its own button.
    onFolderOpen: () => narrow() || setUi(u => ({ ...u, sidebarOpen: true })),
  })

  useEffect(() => {
    applyToRoot(settings)
    applyFontUrl(settings.fontUrl)
    save(settings)
  }, [settings])

  useEffect(() => {
    // At narrow width the drawer is a passing state; saving it would clobber the wide-window preference.
    if (!narrow()) localStorage.setItem(UI_KEY, JSON.stringify(ui))
  }, [ui])

  useEffect(() => {
    document.title = current ? current.name : 'md reader'
  }, [current])

  // Keyed on the handle, not current: a live reload of the same file must not bring the offer back.
  useEffect(() => setFolderOfferHidden(false), [current?.handle])

  // Chrome only fires this when the app is installable and not yet installed.
  useEffect(() => {
    const onPrompt = e => {
      e.preventDefault() // hold it so the tip can offer the install in context
      setInstallEvent(e)
    }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function hideTip() {
    setTipHidden(true)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {}
  }

  async function install() {
    const event = installEvent
    setInstallEvent(null) // a prompt event is single-use
    hideTip()
    await event.prompt()
  }

  async function pickFile() {
    if (!fs.supported) return fileInput.current.click()
    const handle = await fs.pickFile()
    if (handle) openFile(handle)
  }

  async function pickFolder() {
    const handle = await fs.pickDirectory()
    if (handle) openFolder(handle, { pick: true })
  }

  async function pickFolderForCurrent() {
    const handle = await fs.pickDirectory({ startIn: current?.handle })
    if (handle) openFolderFor(handle)
  }

  const toggleSidebar = () => setUi(u => ({ ...u, sidebarOpen: !u.sidebarOpen }))
  const closeDrawer = () => narrow() && setUi(u => ({ ...u, sidebarOpen: false }))

  useEffect(() => {
    window.mdreader = { openFolder: h => openFolder(h, { pick: true }), openFile, openFolderFor }
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
      if (handle?.kind === 'directory') openFolder(handle, { pick: true })
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
        if (narrow()) setUi(u => ({ ...u, sidebarOpen: false }))
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
  const tip = { text: `Install md reader to open .md files from ${isMac ? 'Finder' : 'your file manager'}.`, action: 'install', tip: true }
  const shownOrTip = shown ?? (current && installEvent && !tipHidden ? tip : null)
  const actions = {
    install: ['Install', install],
    another: ['Open another file', () => (folder ? setUi(u => ({ ...u, sidebarOpen: true })) : pickFile())],
    folder: ['Open folder', pickFolderForCurrent],
  }
  // Read, Pin and Open: inline in a wide bar, a popover under "More" in a narrow one (display: contents in between).
  const menu = read => (
    <div id="bar-menu" class="bar-menu" popover="auto" onClick={e => e.currentTarget.matches(':popover-open') && e.currentTarget.hidePopover()}>
      {read}
      {current?.handle && (
        <button type="button" class="quiet" onClick={() => togglePin({ kind: 'file', name: current.name, handle: current.handle })}>
          {currentPinned ? 'Unpin' : 'Pin'}
        </button>
      )}
      <button type="button" class="quiet" onClick={pickFile}>Open</button>
    </div>
  )
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
        <span class="bar-title" title={current?.dirPath?.length ? [...current.dirPath, current.name].join(' / ') : undefined}>
          <bdi>
            {current?.dirPath?.length > 0 && <span class="dim">{current.dirPath.join(' / ')} / </span>}
            {current ? current.name : 'md reader'}
          </bdi>
        </span>
        <div class="bar-actions">
          {hasContents && (
            <button type="button" class="quiet contents-btn" popovertarget="contents" aria-label="Contents" title="Contents">
              <List size={16} />
              <span class="label">Contents</span>
            </button>
          )}
          <button type="button" class="quiet more-btn" popovertarget="bar-menu" aria-label="More actions" title="More">
            More
          </button>
          {current ? <Speech articleRef={article} text={current.text} settings={settings}>{menu}</Speech> : menu(null)}
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
      {ui.sidebarOpen && <div class="scrim" onClick={toggleSidebar} />}
      <nav id="files" class="side" aria-label="Files" aria-hidden={!ui.sidebarOpen}>
        <Sidebar folder={folder} pinned={pinned} current={current} onOpenFile={(h, dirPath, root) => { closeDrawer(); openFile(h, { dirPath, root }) }} onOpenPinned={(item, i) => { if (item.kind !== 'directory') closeDrawer(); openPinned(item, i) }} onPickFolder={pickFolder} onTogglePin={togglePin} />
      </nav>
      <main class="main">
        {shownOrTip && (
          <div class={shownOrTip.tip ? 'notice tip' : 'notice'} role="status">
            <span>{shownOrTip.text}</span>
            <span class="notice-buttons">
              {shownOrTip.action && <button type="button" class="quiet notice-action" onClick={actions[shownOrTip.action][1]}>{actions[shownOrTip.action][0]}</button>}
              {shownOrTip.tip && <button type="button" class="quiet" onClick={hideTip}>Not now</button>}
              {shownOrTip.action !== 'another' && !shownOrTip.tip && <button type="button" class="quiet" aria-label="Dismiss" onClick={() => { setNotice(null); setFolderOfferHidden(true) }}>✕</button>}
            </span>
          </div>
        )}
        {current ? (
          <>
            <Outline articleRef={article} text={current.text} onContents={setHasContents} />
            <Viewer text={current.text} articleRef={article} root={folder?.handle ?? null} dirPath={current.dirPath} onFollow={followLink} onJump={jumpTo} onRelative={setHasRelative} />
          </>
        ) : folder ? (
          <div class="empty">
            <p class="empty-title">{folder.tree.children.length ? `Choose a document from ${folder.name}` : `No markdown files in ${folder.name}`}</p>
            <button type="button" class="quiet primary narrow-only" onClick={toggleSidebar}>Show files</button>
          </div>
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
            <p class="empty-hint">Files are read on this computer and never uploaded.</p>
            <p class="empty-hint">
              <kbd>{isMac ? '⌘' : 'Ctrl'} O</kbd> file, <kbd>{isMac ? '⌘' : 'Ctrl'} ⇧ O</kbd> folder, <kbd>{isMac ? '⌘' : 'Ctrl'} B</kbd> files panel
            </p>
          </div>
        )}
      </main>
      <aside id="settings" class="sheet" aria-label="Settings" aria-hidden={!showSettings}>
        <button type="button" class="quiet sheet-close" aria-label="Close settings" onClick={() => setShowSettings(false)}>
          <X size={18} />
        </button>
        <Settings settings={settings} onChange={patch => setSettings(prev => ({ ...prev, ...patch }))} onReset={() => setSettings({ ...DEFAULTS })} />
      </aside>
    </div>
  )
}

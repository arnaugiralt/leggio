import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Speech } from './Speech.jsx'
import { DEFAULTS, LOOK, load, save, applyToRoot, applyFontUrl, effective, isDefaultLook } from './settings.js'
import * as fs from './fs.js'
import * as share from './share.js'
import { useLibrary, FOLDER_NOTICE } from './useLibrary.js'
import { ChevronLeft, ChevronRight, List, X } from './icons.jsx'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'
const UI_KEY = 'leggio.ui'
const TIP_KEY = 'leggio.install-tip-dismissed'
const COPY_KEY = 'leggio.copy-note-dismissed'

const COPY_NOTICE = { text: "Leggio is reading a copy of this file, so it won't update when the file changes.", action: 'reopen' }

// Dismissals are conveniences: with site storage blocked they last for the session.
function remembered(key) {
  try {
    return !!localStorage.getItem(key)
  } catch {
    return false
  }
}
function remember(key) {
  try {
    localStorage.setItem(key, '1')
  } catch {}
}

// Below this the panels are overlays, not columns (keep in step with the max-width in styles.css).
const NARROW = '(max-width: 759.98px)' // the drawer breakpoint in styles.css
const narrow = () => matchMedia(NARROW).matches
const PAPER = document.querySelector('meta[name="theme-color"]')?.content

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
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [showSettings, setShowSettings] = useState(false)
  const [ui, setUi] = useState(loadUi)
  const [dragging, setDragging] = useState(false)
  const [hasRelative, setHasRelative] = useState(false)
  const [hasContents, setHasContents] = useState(false)
  const [folderOfferHidden, setFolderOfferHidden] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)
  const [tipHidden, setTipHidden] = useState(() => remembered(TIP_KEY))
  const [copyNoticeHidden, setCopyNoticeHidden] = useState(() => remembered(COPY_KEY))
  const [webImages, setWebImages] = useState({ count: 0, hosts: [] }) // in a shared document, reported by Viewer
  // For one shared document, by its share id, so another link starts with web images off again. Read during
  // render, not reset in an effect: an effect runs after Viewer has already loaded the next document's images.
  const [sharedChoice, setSharedChoice] = useState({ id: null, imagesOn: false, noticeHidden: false })
  const [reveal, setReveal] = useState(null) // { path, n }: a folder the tree should expand and scroll to
  const [focusRows, setFocusRows] = useState(0)
  const fileInput = useRef()
  const folderInput = useRef()
  const folderFor = useRef(false) // the folder input is open to find the current file's folder, not to browse one
  // False once the File System Access API is missing or blocked: from then on files open as copies, through the inputs.
  const fileAccess = useRef(fs.supported)
  const filesBtn = useRef()
  const settingsBtn = useRef()
  const settingsTitle = useRef()
  const toDocument = useRef(false) // a file picked in the drawer: the person chose to read, so focus goes to the page
  const seen = useRef({ settings: false, drawer: false }) // previous open state, so the first render moves no focus
  const article = useRef()
  const { folder, pinned, current, currentPinned, restorable, notice, setNotice, back, forward, openFolder, openFolderFor, openFile, followLink, openPinned, checkPins, togglePin, restore, jumpTo } = useLibrary({
    // A drawer would cover the document the folder is about to open (and every restore); the empty state has its own button.
    onFolderOpen: () => narrow() || setUi(u => ({ ...u, sidebarOpen: true })),
    onReveal: path => {
      setUi(u => ({ ...u, sidebarOpen: true })) // the person followed a link to a folder, so a drawer is what they asked for
      setReveal(r => ({ path, n: (r?.n ?? 0) + 1 }))
    },
  })

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Saved settings keep Default's light palette; the dark one is applied on top while followSystem holds.
  const lookShown = effective(settings, dark)
  useEffect(() => {
    applyToRoot(lookShown)
    applyFontUrl(settings.fontUrl)
  }, [settings, dark])
  useEffect(() => save(settings), [settings])

  // With the title bar hidden, the OS paints the strips behind the window controls in theme-color, so there it
  // follows the page. The paper color stays for the normal title bar.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const mq = matchMedia('(display-mode: window-controls-overlay)')
    const update = () => meta && (meta.content = mq.matches ? lookShown.bg : PAPER)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [lookShown.bg])

  // Edits start from what is on screen, so changing one color on a dark Default keeps the other dark ones.
  // The look is followed only while it equals Default; picking Default (or Reset) turns following back on.
  const change = patch =>
    setSettings(prev => {
      if (!LOOK.some(k => k in patch)) return { ...prev, ...patch }
      const next = { ...effective(prev, dark), ...patch }
      next.followSystem = patch.followSystem ?? isDefaultLook(next)
      if (next.followSystem) for (const k of LOOK) next[k] = DEFAULTS[k]
      return next
    })

  useEffect(() => {
    // At narrow width the drawer is a passing state; saving it would clobber the wide-window preference.
    if (narrow()) return
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui))
    } catch {}
  }, [ui])

  // Shrinking a window with the side panel open would leave the drawer over the document; growing it back
  // restores the saved wide-window preference.
  useEffect(() => {
    const mq = matchMedia(NARROW)
    const onChange = () => setUi(u => ({ ...u, sidebarOpen: mq.matches ? false : loadUi().sidebarOpen }))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (ui.sidebarOpen) checkPins()
  }, [ui.sidebarOpen, pinned.length])

  // After the commit, so the panel is already visible: a hidden element cannot take focus.
  // File rows are the buttons without aria-expanded; the last section is the folder tree, after the pins.
  const focusFiles = () =>
    (document.querySelector('#files .row-main[aria-current]') ?? document.querySelector('#files section:last-of-type .row-main:not([aria-expanded])') ?? document.querySelector('#files button'))?.focus()
  useEffect(() => {
    if (focusRows) focusFiles()
  }, [focusRows])

  // The sheet and the drawer sit far from the bar in the tab order, so opening one moves focus in and
  // closing it brings focus back. Closing only steals focus that was inside the panel (or lost to the page).
  const stranded = el => {
    const a = document.activeElement
    return a === document.body || el.contains(a)
  }
  useEffect(() => {
    if (showSettings) settingsTitle.current.focus()
    else if (seen.current.settings && stranded(document.getElementById('settings'))) settingsBtn.current.focus()
    seen.current.settings = showSettings
  }, [showSettings])
  useEffect(() => {
    if (narrow()) {
      if (ui.sidebarOpen) focusFiles()
      else if (seen.current.drawer && toDocument.current) article.current?.focus()
      else if (seen.current.drawer && stranded(document.getElementById('files'))) filesBtn.current.focus()
      toDocument.current = false
    }
    seen.current.drawer = ui.sidebarOpen
  }, [ui.sidebarOpen])

  useEffect(() => {
    document.title = current ? (current.handle?.shared ? `${current.name} (shared)` : current.name) : 'Leggio'
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
    remember(TIP_KEY)
  }

  async function install() {
    const event = installEvent
    setInstallEvent(null) // a prompt event is single-use
    hideTip()
    await event.prompt()
  }

  // A managed Chrome can block file access, and then the pickers throw instead of opening. The file inputs still
  // work, but after the failed picker the click may no longer count as a user gesture, so the notice offers the
  // input as a fresh click.
  function blocked(action) {
    fileAccess.current = false
    setNotice({ text: "This browser blocks file access, so Leggio can only open a copy. A copy won't update when the file changes.", action })
  }

  async function pickFile() {
    if (!fileAccess.current) return fileInput.current.click()
    try {
      const handle = await fs.pickFile()
      if (handle) openFile(handle)
    } catch {
      blocked('copyFile')
    }
  }

  // Takes an options object, not a flag, because it is also a click handler and gets the event as its argument.
  async function pickFolder({ forCurrent = false } = {}) {
    folderFor.current = forCurrent
    // A copy can only be found in a copied folder (by name, size and date), never in a real one.
    if (!fileAccess.current || (forCurrent && current?.handle?.copy)) return folderInput.current.click()
    try {
      const handle = await fs.pickDirectory({ startIn: forCurrent ? current?.handle : undefined })
      if (handle) forCurrent ? openFolderFor(handle) : openFolder(handle, { pick: true })
    } catch {
      blocked('copyFolder')
    }
  }

  const toggleSidebar = () => setUi(u => ({ ...u, sidebarOpen: !u.sidebarOpen }))
  const closeDrawer = () => narrow() && setUi(u => ({ ...u, sidebarOpen: false }))

  // A file picked in the drawer: the reader chose to read, so the drawer closes and focus goes to the page.
  function readFromDrawer() {
    toDocument.current = narrow()
    closeDrawer()
  }

  // Below 760px the bar has no room for a Contents button, so it lives in the More menu. The menu hides
  // itself first: a popover opened from inside it would be hidden along with it.
  function openContentsFromMenu(e) {
    e.stopPropagation()
    e.currentTarget.closest('[popover]').hidePopover()
    const contents = document.getElementById('contents')
    contents?.showPopover()
    ;(contents?.querySelector('a[aria-current]') ?? contents?.querySelector('a'))?.focus()
  }

  useEffect(() => {
    window.leggio = { openFolder: h => openFolder(h, { pick: true }), openFile, openFolderFor }
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
      // All three are taken before the first await: the data transfer is emptied once the event returns.
      const file = e.dataTransfer.files[0]
      const entry = e.dataTransfer.items?.[0]?.webkitGetAsEntry?.()
      const pending = fs.handleFromDrop(e.dataTransfer)
      // A handle keeps live reload and restore. Without one, or when access to it is denied, read a copy.
      const handle = await pending.catch(() => null)
      let target = handle && !(await fs.isDenied(handle)) ? handle : null
      try {
        target ??= entry ? await fs.fromEntry(entry) : file && fs.fromFile(file)
      } catch {
        return setNotice({ text: `Could not read ${entry?.name ?? file?.name}.` })
      }
      if (target?.kind === 'directory') openFolder(target, { pick: true })
      else if (target) openFile(target)
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

  const shared = !!current?.handle?.shared
  const sharedView = shared && sharedChoice.id === current.handle.copy ? sharedChoice : { imagesOn: false, noticeHidden: false }
  const setSharedView = change => setSharedChoice({ ...sharedView, ...change, id: current.handle.copy })
  const loadImages = () => setSharedView({ imagesOn: true })
  // A download, the same way followLink hands over a file: a new file the browser saves, never the reader's own.
  function saveShared() {
    const url = URL.createObjectURL(new Blob([current.text], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = current.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  // The clipboard gets a promise, not the link: compressing is async, and a write after an await may no longer
  // count as part of the click.
  async function shareLink() {
    let tooLong = 0
    const link = share.encode(current.name, current.text).then(code => {
      if (code.length > share.LINK_LIMIT) throw ((tooLong = code.length), new Error('too long'))
      return new Blob([`${location.origin}${location.pathname}#share=${code}`], { type: 'text/plain' })
    })
    link.catch(() => {}) // handled below, through the clipboard write
    const local = [...(article.current?.querySelectorAll('img[data-src]') ?? [])].filter(img => fs.isLocal(img.dataset.src)).length
    try {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': link })])
      } catch (err) {
        if (tooLong) throw err
        // Browsers without promise values in ClipboardItem: write the finished link, still within the click.
        await navigator.clipboard.writeText(await (await link).text())
      }
      const images = local === 1 ? " 1 local image isn't included." : local > 1 ? ` ${local} local images aren't included.` : ''
      setNotice({ text: `Link copied. Anyone with the link can read this document.${images}` })
    } catch {
      setNotice({
        text: tooLong
          ? `This document is too long to share as a link. A link holds about ${Math.round(share.LINK_LIMIT / 1000)} KB, and this one would be ${Math.round(tooLong / 1000)} KB.`
          : "Couldn't copy the link.",
      })
    }
  }

  // The one notice slot shows the first of these that applies.
  const shown = [
    // A stated notice: an error, a deleted file. Dismissing a stated folder offer also hides the derived one.
    notice && { ...notice, dismiss: notice.action !== 'another' && (() => (setNotice(null), setFolderOfferHidden(true))) },
    // Relative links and images cannot resolve without the file's folder.
    shared && webImages.count > 0 && !sharedView.imagesOn && !sharedView.noticeHidden && {
      text: `${webImages.count === 1 ? '1 image in this document loads' : `${webImages.count} images in this document load`} from the web. Loading ${webImages.count === 1 ? 'it lets that site' : 'them lets those sites'} see that you opened it.`,
      action: 'images',
      dismiss: () => setSharedView({ noticeHidden: true }),
    },
    // A shared document has no folder and no file to reopen; "Shared" in the bar explains it instead.
    !shared && current?.handle && hasRelative && !folderOfferHidden && { ...FOLDER_NOTICE, dismiss: () => setFolderOfferHidden(true) },
    !shared && current?.handle?.copy && !copyNoticeHidden && { ...COPY_NOTICE, dismiss: () => (setCopyNoticeHidden(true), remember(COPY_KEY)) },
    current && installEvent && !tipHidden && { text: `Install Leggio to open .md files from ${isMac ? 'Finder' : 'your file manager'}.`, action: 'install', tip: true },
  ].find(Boolean)
  const actions = {
    install: ['Install', install],
    images: ['Load images', loadImages],
    another: ['Open another file', () => (folder ? (setUi(u => ({ ...u, sidebarOpen: true })), setFocusRows(n => n + 1)) : pickFile())],
    folder: ['Open folder', () => pickFolder({ forCurrent: true })],
    reopen: ['Open again', () => (current.root?.copy ? pickFolder() : pickFile())],
    copyFile: ['Open a copy', () => fileInput.current.click()],
    copyFolder: ['Open a copy', () => folderInput.current.click()],
  }
  // Read, Pin, Share and Open: inline in a wide bar, a popover under "More" in a narrow one (display: contents in between).
  const menu = read => (
    <div id="bar-menu" class="bar-menu" popover="auto" onClick={e => e.currentTarget.matches(':popover-open') && e.currentTarget.hidePopover()}>
      {read}
      {hasContents && (
        <button type="button" class="quiet menu-contents" onClick={openContentsFromMenu}>Contents</button>
      )}
      {current?.handle && !current.handle.copy && (
        <button type="button" class="quiet" onClick={() => togglePin({ kind: 'file', name: current.name, handle: current.handle })}>
          {currentPinned ? 'Unpin' : 'Pin'}
        </button>
      )}
      {current && (
        <button type="button" class="quiet" onClick={shareLink}>
          Share
        </button>
      )}
      <button type="button" class="quiet" title={`Open (${mod}O)`} onClick={pickFile}>Open file</button>
    </div>
  )
  const classes = ['app', ui.sidebarOpen && 'sidebar-open', showSettings && 'settings-open', dragging && 'dragging'].filter(Boolean).join(' ')

  return (
    <div class={classes}>
      {current && <a class="skip" href="#document" onClick={e => { e.preventDefault(); article.current?.focus() }}>Skip to document</a>}
      <header class="bar">
        <div class="bar-actions">
          <button ref={filesBtn} type="button" class="quiet" title={`Files (${mod}B)`} aria-expanded={ui.sidebarOpen} aria-controls="files" onClick={toggleSidebar}>
            Files
          </button>
          {current && (
            <>
              <button type="button" class="quiet nav" aria-label="Back" title={`${back ? `Back to ${back}` : 'Back'} (${mod}[)`} disabled={back === null} onClick={() => history.back()}>
                <ChevronLeft size="1.2em" />
              </button>
              <button type="button" class="quiet nav" aria-label="Forward" title={`${forward ? `Forward to ${forward}` : 'Forward'} (${mod}])`} disabled={forward === null} onClick={() => history.forward()}>
                <ChevronRight size="1.2em" />
              </button>
            </>
          )}
        </div>
        <span class={shared ? 'bar-title from-link' : 'bar-title'} title={current && !shared ? [...(current.dirPath ?? []), current.name].join(' / ') : undefined}>
          {/* Where the document comes from, in the place a folder path takes: "Shared / name" like "docs / name". */}
          {shared && (
            <>
              <button type="button" class="quiet crumb" popovertarget="shared-info" title="Shared with you">
                Shared
              </button>
              <span class="dim" aria-hidden="true">/</span>
            </>
          )}
          <bdi>
            {current?.dirPath?.length > 0 && <span class="dim">{current.dirPath.join(' / ')} / </span>}
            {current ? current.name : 'Leggio'}
          </bdi>
        </span>
        {shared && (
          <div id="shared-info" class="shared-pop" popover="auto">
            <p class="shared-pop-title">Shared with you</p>
            <p>This document came inside a link. It isn't a file on this device, so it won't update and can't be pinned.</p>
            {webImages.count > 0 && (
              <div class="shared-pop-row">
                <p>
                  {sharedView.imagesOn
                    ? `Images loaded from ${webImages.hosts.length === 1 ? '1 site' : `${webImages.hosts.length} sites`}.`
                    : `Web images are off: ${webImages.count === 1 ? '1 image' : `${webImages.count} images`} from ${webImages.hosts.length === 1 ? '1 site' : `${webImages.hosts.length} sites`}.`}
                </p>
                {!sharedView.imagesOn && <button type="button" class="quiet notice-action" onClick={loadImages}>Load images</button>}
              </div>
            )}
            <button type="button" class="quiet notice-action" onClick={saveShared}>Save as file</button>
          </div>
        )}
        <div class="bar-actions">
          {hasContents && (
            <button type="button" class="quiet contents-btn" popovertarget="contents" aria-label="Contents" title="Contents">
              <List size="1.2em" />
              <span class="label">Contents</span>
            </button>
          )}
          <button type="button" class="quiet more-btn" popovertarget="bar-menu" aria-label="More actions" title="More">
            More
          </button>
          {current ? <Speech articleRef={article} text={current.text} settings={settings}>{menu}</Speech> : menu(null)}
          <button ref={settingsBtn} type="button" class="quiet" aria-expanded={showSettings} aria-controls="settings" onClick={() => setShowSettings(v => !v)}>
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
          const file = e.currentTarget.files[0] // before the reset below, which empties the list
          e.currentTarget.value = ''
          if (file) openFile(fs.fromFile(file))
        }}
      />
      <input
        ref={folderInput}
        type="file"
        webkitdirectory
        hidden
        onChange={e => {
          const root = fs.fromFileList(e.currentTarget.files)
          e.currentTarget.value = ''
          if (root) folderFor.current ? openFolderFor(root) : openFolder(root, { pick: true })
        }}
      />
      {ui.sidebarOpen && <div class="scrim" onClick={toggleSidebar} />}
      <nav id="files" class="side" aria-label="Files" aria-hidden={!ui.sidebarOpen}>
        <Sidebar reveal={reveal} folder={folder} pinned={pinned} current={current} onOpenFile={(h, dirPath, root) => { readFromDrawer(); openFile(h, { dirPath, root }) }} onOpenPinned={item => { if (item.kind !== 'directory') readFromDrawer(); openPinned(item) }} onPickFolder={pickFolder} onTogglePin={togglePin} />
      </nav>
      <main class="main">
        {shown && (
          <div class={shown.tip ? 'notice tip' : 'notice'} role="status">
            <span>{shown.text}</span>
            <span class="notice-buttons">
              {shown.action && <button type="button" class="quiet notice-action" onClick={actions[shown.action][1]}>{actions[shown.action][0]}</button>}
              {shown.tip && <button type="button" class="quiet" onClick={hideTip}>Not now</button>}
              {shown.dismiss && <button type="button" class="quiet" aria-label="Dismiss" onClick={shown.dismiss}>✕</button>}
            </span>
          </div>
        )}
        {current ? (
          <>
            <Outline articleRef={article} text={current.text} onContents={setHasContents} />
            <Viewer text={current.text} articleRef={article} root={current.root} dirPath={current.dirPath} onFollow={followLink} onJump={jumpTo} onRelative={setHasRelative} shared={shared} imagesOn={sharedView.imagesOn} onWebImages={setWebImages} />
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
              <button type="button" class="quiet" onClick={pickFolder}>Open a folder</button>
            </div>
            <p class="empty-hint">Files are read on this computer and never uploaded.</p>
            <p class="empty-hint">
              <kbd>{isMac ? '⌘' : 'Ctrl'} O</kbd> file, <kbd>{isMac ? '⌘' : 'Ctrl'} ⇧ O</kbd> folder, <kbd>{isMac ? '⌘' : 'Ctrl'} B</kbd> files panel
            </p>
          </div>
        )}
      </main>
      <aside id="settings" class="sheet" aria-label="Settings" aria-hidden={!showSettings}>
        <div class="sheet-head">
          <h2 ref={settingsTitle} tabindex="-1">Settings</h2>
          <button type="button" class="quiet sheet-close" aria-label="Close settings" onClick={() => setShowSettings(false)}>
            <X size="1.2em" />
          </button>
        </div>
        <Settings settings={lookShown} onChange={change} open={showSettings} dark={dark} />
      </aside>
    </div>
  )
}

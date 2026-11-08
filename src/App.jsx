import { useEffect, useRef, useState } from 'preact/hooks'
import { Viewer } from './Viewer.jsx'
import { Outline } from './Outline.jsx'
import { Settings } from './Settings.jsx'
import { Sidebar, findIn } from './Sidebar.jsx'
import { Speech } from './Speech.jsx'
import { DEFAULTS, LOOK, load, save, loadThemes, saveThemes, applyToRoot, applyFontUrl, effective, isDefaultLook } from './settings.js'
import * as fs from './fs.js'
import * as share from './share.js'
import { useLibrary, FOLDER_NOTICE } from './useLibrary.js'
import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, FileText, List, Menu, X } from './icons.jsx'
import { LinkForm, OpenMenu, menuKeys } from './OpenMenu.jsx'
import { where } from './recent.js'
import { Shortcuts } from './Shortcuts.jsx'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'
const KEYS = {
  file: isMac ? '⌘O' : 'Ctrl+O',
  folder: isMac ? '⇧⌘O' : 'Ctrl+Shift+O',
  files: isMac ? '⌘B' : 'Ctrl+B',
  search: isMac ? '⇧⌘F' : 'Ctrl+Shift+F',
  history: isMac ? '⌘[  ⌘]' : 'Ctrl+[  Ctrl+]',
}
const UI_KEY = 'leggio.ui'
const TIP_KEY = 'leggio.install-tip-dismissed'
const COPY_KEY = 'leggio.copy-note-dismissed'

const CHAT_LINK = 4000 // characters; see shareLink
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

// Phones and tablets: their own bar (icons, 44 px targets, hidden while scrolling down). Keep in step with
// the same media query in styles.css. A narrow desktop window keeps the text bar.
const PHONE = '(max-width: 759.98px) and (pointer: coarse)'
const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
// iOS never offers an install prompt; it has Add to Home Screen in the Share sheet instead.
const iosBrowser = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches

// The Files panel's width on wide windows: dragged or set by keyboard, never so wide the text drops below 32rem.
const SIDE = { min: 200, max: 480, default: 260, step: 16 }
const SHEET_W = 344 // --sheet-w in styles.css
const sideMax = settingsOpen => Math.max(SIDE.min, Math.min(SIDE.max, innerWidth - 512 - (settingsOpen && innerWidth >= 1100 ? SHEET_W : 0)))
const clampSide = (w, settingsOpen) => Math.round(Math.max(SIDE.min, Math.min(sideMax(settingsOpen), w)))

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
  const [themes, setThemes] = useState(loadThemes) // the reader's saved looks, beside the presets
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
  const [webImages, setWebImages] = useState({ count: 0, hosts: [] }) // in a shared or web document, reported by Viewer
  const [linkField, setLinkField] = useState(false) // the empty state's address field is showing
  const [linkBusy, setLinkBusy] = useState(false) // an address field is waiting for its document and says so itself
  // For one shared document, by its share id, so another link starts with web images off again. Read during
  // render, not reset in an effect: an effect runs after Viewer has already loaded the next document's images.
  const [sharedChoice, setSharedChoice] = useState({ id: null, imagesOn: false, noticeHidden: false })
  const [query, setQuery] = useState('') // search in the open folder, in the Files panel
  const [shortcuts, setShortcuts] = useState(false) // the keyboard shortcuts list is open
  const [, setWindowWidth] = useState(0) // a resize re-renders, so the Files panel's width limit follows the window
  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWindowWidth(innerWidth))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [find, setFind] = useState(null) // { q, handle }: a document opened from search, its matches marked
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
  const { cancelOpen, recent, openRecent, forgetRecent, restoreRecent, loading, openLink, folder, pinned, current, currentPinned, restorable, notice, setNotice, back, forward, openFolder, openFolderFor, openFile, followLink, openPinned, checkPins, togglePin, restore, jumpTo } = useLibrary({
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
  useEffect(() => saveThemes(themes), [themes])

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
  // File rows are the buttons without aria-expanded; the last section is the folder tree, after pins and Recent.
  const focusFiles = () =>
    (document.querySelector('#files .row-main[aria-current]') ?? document.querySelector('#files section:last-of-type .row-main:not([aria-expanded])') ?? document.querySelector('#files .row-main') ?? document.querySelector('#files button'))?.focus()
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
      else if (seen.current.drawer && stranded(document.getElementById('files'))) filesBtn.current?.focus()
      toDocument.current = false
    }
    seen.current.drawer = ui.sidebarOpen
  }, [ui.sidebarOpen])

  const openControl = useRef() // OpenMenu's showLink, for the narrow More menu
  const folderNow = useRef(folder)
  folderNow.current = folder // the key handler is set up once, at mount
  const openLinkRef = useRef(openLink)
  openLinkRef.current = openLink // the paste listener is set up once, at mount

  useEffect(() => {
    const from = current?.handle?.shared ? 'shared' : current?.handle?.web && new URL(current.handle.web).host
    document.title = current ? (from ? `${current.name} (${from})` : current.name) : 'Leggio'
  }, [current])

  // On paper a closed <details> would lose its content: open them for the print, and close them again after.
  useEffect(() => {
    const before = () => document.querySelectorAll('#document details:not([open])').forEach(d => ((d.open = true), (d.dataset.printOpened = '')))
    const after = () => document.querySelectorAll('#document details[data-print-opened]').forEach(d => ((d.open = false), delete d.dataset.printOpened))
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  // A document opened from search: its matches are marked (the CSS Custom Highlight API, as read-aloud uses)
  // and the first one is brought into view, once: a live reload marks them again but leaves the reader where
  // they are. Any other document clears them.
  const findShown = useRef(null)
  useEffect(() => {
    if (!window.CSS?.highlights) return
    CSS.highlights.delete('find')
    const article = document.getElementById('document')
    if (!find || !current || current.handle !== find.handle || !article) return
    const ranges = []
    const walk = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      for (const [at, length] of findIn(node.data, find.q)) {
        const range = new Range()
        range.setStart(node, at)
        range.setEnd(node, at + length)
        ranges.push(range)
      }
    }
    if (!ranges.length) return
    CSS.highlights.set('find', new Highlight(...ranges))
    if (findShown.current === find) return
    findShown.current = find
    requestAnimationFrame(() => ranges[0].startContainer.parentElement?.scrollIntoView({ block: 'center' }))
  }, [current, find])

  // Keyed on the handle, not current: a live reload of the same file must not bring the offer back.
  useEffect(() => setFolderOfferHidden(false), [current?.handle])

  // On a phone the bar slides away while reading down the page and comes back on the way up, as Safari's does.
  // Never while something opened from it is showing, and never near the top, where it says what is open.
  useEffect(() => {
    const phone = matchMedia(PHONE)
    const root = document.documentElement
    let last = scrollY
    const show = () => root.classList.remove('bar-hidden')
    const onScroll = () => {
      const y = scrollY
      const dy = y - last
      last = y
      if (!phone.matches || y < 80 || document.querySelector('.app.sidebar-open, .app.settings-open, :popover-open')) return show()
      if (dy > 6) root.classList.add('bar-hidden')
      else if (dy < -6) show()
    }
    const bar = document.querySelector('.bar')
    window.addEventListener('scroll', onScroll, { passive: true })
    bar.addEventListener('focusin', show) // a keyboard reaching the bar must see it
    return () => {
      window.removeEventListener('scroll', onScroll)
      bar.removeEventListener('focusin', show)
    }
  }, [])

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
        if (!e.shiftKey) pickFile()
        else if (fs.canOpenFolders) pickFolder()
      } else if (mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault() // in a tab, Chrome's own ⌘[ would also go back, out of the app when the button is disabled
        if (e.key === '[' ? window.navigation?.canGoBack : window.navigation?.canGoForward) e.key === '[' ? history.back() : history.forward()
      } else if ((mod && e.shiftKey && e.key.toLowerCase() === 'f') || (e.key === '/' && !mod && !e.altKey && !e.target.closest?.('input, textarea, select, [contenteditable]'))) {
        // Search the open folder: ⌘⇧F, or / as on many sites. ⌘F stays the browser's find in the document.
        if (!folderNow.current) return
        e.preventDefault()
        setUi(u => ({ ...u, sidebarOpen: true }))
        requestAnimationFrame(() => document.querySelector('#files .search input')?.select()) // a new search replaces the last
      } else if (e.key === '?' && !mod && !touch && !e.target.closest?.('input, textarea, select, [contenteditable]')) {
        e.preventDefault()
        setShortcuts(true)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      } else if (e.key === 'Escape') {
        // One Esc closes one thing: a dialog (the shortcuts list) handles its own, and Settings stays open behind it.
        if (document.querySelector('dialog[open]')) return
        setShowSettings(false)
        if (narrow()) setUi(u => ({ ...u, sidebarOpen: false }))
      }
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    // A link pasted anywhere but a text field opens; any other paste is left alone.
    const paste = e => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (openLinkRef.current(e.clipboardData.getData('text'))) e.preventDefault()
    }
    window.addEventListener('keydown', key)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('paste', paste)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      window.removeEventListener('keydown', key)
    }
  }, [])

  const shared = !!current?.handle?.shared
  const web = current?.handle?.web ?? null // the address a web document was read from
  const host = web && new URL(web).host
  const foreign = shared || !!web // came from someone or somewhere else: not one of the reader's files
  const sharedView = foreign && sharedChoice.id === current.handle.copy ? sharedChoice : { imagesOn: false, noticeHidden: false }
  const setSharedView = change => setSharedChoice({ ...sharedView, ...change, id: current.handle.copy })
  const loadImages = () => setSharedView({ imagesOn: true })
  // A download, the same way followLink hands over a file: a new file the browser saves, never the reader's own.
  function saveShared() {
    const url = URL.createObjectURL(new Blob([current.text], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fs.isMarkdownName(current.name) ? current.name : `${current.name}.md` // a link can carry any name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  // The clipboard gets a promise, not the link: compressing is async, and a write after an await may no longer
  // count as part of the click.
  async function shareLink() {
    let size = 0
    const blob = url => ((size = url.length), new Blob([url], { type: 'text/plain' }))
    // A web document is already public at its address, so its link points there and stays short.
    const link = web
      ? Promise.resolve(blob(`${location.origin}${location.pathname}#url=${encodeURIComponent(web)}`))
      : share.encode(current.name, current.text).then(code => blob(`${location.origin}${location.pathname}#share=${code}`))
    // A web document's relative images resolve against its address, so none of them is left behind.
    const local = web ? 0 : [...(article.current?.querySelectorAll('img[data-src]') ?? [])].filter(img => fs.isLocal(img.dataset.src)).length
    try {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': link })])
      } catch {
        // Browsers without promise values in ClipboardItem: write the finished link, still within the click.
        await navigator.clipboard.writeText(await (await link).text())
      }
      const images = local === 1 ? " 1 local image isn't included." : local > 1 ? ` ${local} local images aren't included.` : ''
      // Telegram's message limit is 4,096 characters, and Slack turns long messages into snippets around there too.
      const long = size > CHAT_LINK ? ` At ${Math.round(size / 1000)} KB, chat apps such as Slack or Telegram will probably send the link as a file. For a document this long, sending the file itself works better.` : ''
      setNotice({ text: `Link copied. Anyone with the link can read this document.${images}${long}` })
    } catch {
      setNotice({ text: "Couldn't copy the link." })
    }
  }

  // Recent leaves out what is open: it is always the newest entry.
  const isOpen = e => current && e === recent[0]
  const others = recent.filter(e => !isOpen(e))
  const forgotten = useRef(null)
  // Forget leaves the panel for the notice with Undo: the drawer would cover it, and the section it was in is gone.
  async function forget() {
    forgotten.current = await forgetRecent()
    closeDrawer()
    setNotice({ text: 'Recent is cleared.', action: 'undoForget' })
    requestAnimationFrame(() => document.querySelector('.notice .notice-action')?.focus())
  }
  // After Undo, focus goes back to where Recent lives: its first row if the panel shows, else the Files button.
  const focusRecent = () => requestAnimationFrame(() => (document.querySelector('#files[aria-hidden="false"] [aria-label="Recent"] .row-main') ?? filesBtn.current)?.focus())

  // The one notice slot shows the first of these that applies.
  const shown = [
    // A web document on its way, over the one being read (with nothing open, the main area says it instead).
    loading && current && !linkBusy && { text: `Opening ${loading.name} from ${loading.host}…`, action: 'cancel' },
    // A stated notice: an error, a deleted file. Dismissing a stated folder offer also hides the derived one.
    notice && { ...notice, dismiss: notice.action !== 'another' && (() => (setNotice(null), setFolderOfferHidden(true))) },
    // Relative links and images cannot resolve without the file's folder.
    foreign && webImages.count > 0 && !sharedView.imagesOn && !sharedView.noticeHidden && {
      text: `${webImages.count === 1 ? '1 image in this document loads' : `${webImages.count} images in this document load`} from the web. Loading ${webImages.count === 1 ? 'it lets that site' : 'them lets those sites'} see that you opened it.`,
      action: 'images',
      dismiss: () => setSharedView({ noticeHidden: true }),
    },
    // A shared or web document has no folder and no file to reopen; the bar says where it comes from instead.
    // Not where no folder can open (a phone): its button would be a dead end.
    !foreign && fs.canOpenFolders && current?.handle && hasRelative && !folderOfferHidden && { ...FOLDER_NOTICE, dismiss: () => setFolderOfferHidden(true) },
    // Not on a touch screen: there every file is a copy, so the notice tells the reader nothing they can act on.
    !foreign && !touch && current?.handle?.copy && !copyNoticeHidden && { ...COPY_NOTICE, dismiss: () => (setCopyNoticeHidden(true), remember(COPY_KEY)) },
    current && installEvent && !tipHidden && { text: `Install Leggio to open .md files from ${isMac ? 'Finder' : 'your file manager'}.`, action: 'install', tip: true },
    current && iosBrowser && !standalone && !tipHidden && { text: 'Add Leggio to your Home Screen: tap Share, then Add to Home Screen.', tip: true },
  ].find(Boolean)
  const actions = {
    install: ['Install', install],
    cancel: ['Cancel', () => loading?.cancel()],
    undoForget: ['Undo', () => (forgotten.current && restoreRecent(forgotten.current), setNotice(null), focusRecent())],
    images: ['Load images', loadImages],
    another: ['Open another file', () => (folder ? (setUi(u => ({ ...u, sidebarOpen: true })), setFocusRows(n => n + 1)) : pickFile())],
    folder: ['Open folder', () => pickFolder({ forCurrent: true })],
    reopen: ['Open again', () => (current.root?.copy ? pickFolder() : pickFile())],
    copyFile: ['Open a copy', () => fileInput.current.click()],
    copyFolder: ['Open a copy', () => folderInput.current.click()],
  }
  // Read, Pin, Share and Open: inline in a wide bar, a popover under "More" in a narrow one (display: contents in between).
  const menu = read => (
    <div
      id="bar-menu"
      class="bar-menu"
      popover="auto"
      onToggle={e => e.newState === 'open' && [...e.currentTarget.querySelectorAll('button')].find(b => b.offsetParent)?.focus()}
      onKeyDown={e => e.currentTarget.matches(':popover-open') && menuKeys(e)} onClick={e => e.currentTarget.matches(':popover-open') && e.currentTarget.hidePopover()}>
      {read}
      {hasContents && (
        <button type="button" class="quiet menu-contents" onClick={openContentsFromMenu}>Contents</button>
      )}
      {current?.handle && !current.handle.copy && (
        <button type="button" class="quiet" onClick={() => togglePin({ kind: 'file', name: current.name, handle: current.handle })}>
          {currentPinned ? 'Unpin' : 'Pin'}
        </button>
      )}
      {/* On a shared or web document, keeping it is the likely next step; sending it on moves to the popover. */}
      {current && (
        <button type="button" class="quiet" onClick={foreign ? saveShared : shareLink}>
          {foreign ? 'Save file' : 'Share'}
        </button>
      )}
      {/* Wide: one Open button and its menu. Narrow: the same actions, flat in More, with no menu inside a menu. */}
      <button type="button" class="quiet open-btn" popovertarget="open-menu" aria-label="Open" title="Open a file, folder or link">
        Open <ChevronDown size="1em" />
      </button>
      <button type="button" class="quiet narrow-item menu-sep" onClick={pickFile}>Open a file…</button>
      {fs.canOpenFolders && <button type="button" class="quiet narrow-item" onClick={pickFolder}>Open a folder…</button>}
      <button type="button" class="quiet narrow-item" onClick={e => (e.stopPropagation(), e.currentTarget.closest('[popover]').hidePopover(), openControl.current.showLink())}>
        Open a link…
      </button>
      {/* A phone's bar keeps only ☰ ‹ › ⋯; Settings, used rarely, moves in here. */}
      <button type="button" class="quiet phone-item menu-sep" onClick={() => setShowSettings(true)}>
        Settings
      </button>
    </div>
  )
  const classes = ['app', ui.sidebarOpen && 'sidebar-open', showSettings && 'settings-open', dragging && 'dragging'].filter(Boolean).join(' ')
  const sideW = clampSide(ui.sideW ?? SIDE.default, showSettings)
  const setSideW = w => setUi(u => ({ ...u, sideW: w === SIDE.default ? undefined : w }))
  // Dragging writes the width straight to the page and saves it once, at the end: a render per pointer move
  // would re-render the document.
  function resizeStart(e) {
    if (e.button !== 0) return
    e.preventDefault() // no text selection while dragging
    const handle = e.currentTarget
    const app = handle.closest('.app')
    handle.setPointerCapture(e.pointerId)
    let w = sideW
    const move = ev => {
      w = clampSide(ev.clientX, showSettings)
      app.style.setProperty('--side-w', `${w}px`)
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      setSideW(w)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }
  function resizeKey(e) {
    const to = { ArrowLeft: sideW - SIDE.step, ArrowRight: sideW + SIDE.step, Home: SIDE.min, End: sideMax(showSettings) }[e.key]
    if (to === undefined) return
    e.preventDefault()
    setSideW(clampSide(to, showSettings))
  }

  return (
    <div class={classes} style={`--side-w:${sideW}px`}>
      {current && <a class="skip" href="#document" onClick={e => { e.preventDefault(); article.current?.focus() }}>Skip to document</a>}
      <header class="bar">
        <div class="bar-actions">
          {/* Hidden where it would show nothing: no folder can open (a phone) and there is no folder, pin or recent document. */}
          {(fs.canOpenFolders || folder || pinned.length > 0 || others.length > 0) && (
            <button ref={filesBtn} type="button" class="quiet files-btn" title={`Files (${mod}B)`} aria-label="Files" aria-expanded={ui.sidebarOpen} aria-controls="files" onClick={toggleSidebar}>
              <Menu size="1.25em" class="phone-icon" />
              <span class="phone-hide">Files</span>
            </button>
          )}
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
        <span class={foreign ? 'bar-title from-link' : 'bar-title'} title={current && !foreign ? [...(current.dirPath ?? []), current.name].join(' / ') : undefined}>
          {/* Where the document comes from, in the place a folder path takes: "Shared / name" or "host / name",
              like "docs / name". */}
          {foreign && (
            <>
              <button type="button" class="quiet crumb" popovertarget="shared-info" title={web ? `Read from ${host}` : 'Shared with you'}>
                {web ? (
                  <>
                    {/* A host can be long; in a narrow bar "Web" leaves the name its room, and the popover names the host. */}
                    <span class="crumb-long">{host}</span>
                    <span class="crumb-short">Web</span>
                  </>
                ) : (
                  'Shared'
                )}
              </button>
              <span class="dim" aria-hidden="true">/</span>
            </>
          )}
          <bdi>
            {current?.dirPath?.length > 0 && <span class="dim path">{current.dirPath.join(' / ')} / </span>}
            {current ? current.name : 'Leggio'}
          </bdi>
        </span>
        <OpenMenu id="open-menu" keys={KEYS} canFolders={fs.canOpenFolders} onFile={pickFile} onFolder={pickFolder} onLink={openLink} onCancelLink={cancelOpen} onLinkBusy={setLinkBusy} notify={text => setNotice({ text })} control={openControl} />
        {foreign && (
          <div id="shared-info" class="shared-pop" popover="auto">
            <p class="shared-pop-title">{web ? `Read from ${host}` : 'Shared with you'}</p>
            <p>{web ? '' : 'This document came inside a link. '}It isn't a file on this device, so it won't update and can't be pinned.</p>
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
            <button type="button" class="quiet notice-action" onClick={e => (e.currentTarget.closest('[popover]').hidePopover(), shareLink())}>
              Copy link
            </button>
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
            <Ellipsis size="1.25em" class="phone-icon" />
            <span class="phone-hide">More</span>
          </button>
          {current ? <Speech articleRef={article} text={current.text} settings={settings}>{menu}</Speech> : menu(null)}
          <button ref={settingsBtn} type="button" class="quiet settings-btn" aria-expanded={showSettings} aria-controls="settings" onClick={() => setShowSettings(v => !v)}>
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
      {ui.sidebarOpen && (
        <div
          class="side-resize"
          role="separator"
          tabindex="0"
          aria-orientation="vertical"
          aria-label="Files panel width"
          aria-valuemin={SIDE.min}
          aria-valuemax={sideMax(showSettings)}
          aria-valuenow={sideW}
          title="Drag to resize. Double-click to reset."
          onPointerDown={resizeStart}
          onKeyDown={resizeKey}
          onDblClick={() => setSideW(SIDE.default)}
        />
      )}
      <nav id="files" class="side" aria-label="Files" aria-hidden={!ui.sidebarOpen}>
        <Sidebar reveal={reveal} folder={folder} pinned={pinned} recent={others} current={current} onOpenRecent={entry => { readFromDrawer(); openRecent(entry) }} onForgetRecent={forget} onOpenFile={(h, dirPath, root, q) => { readFromDrawer(); setFind(q ? { q, handle: h } : null); openFile(h, { dirPath, root }) }} onOpenPinned={item => { if (item.kind !== 'directory') readFromDrawer(); openPinned(item) }} onPickFolder={pickFolder} onTogglePin={togglePin} query={query} setQuery={q => (setQuery(q), q.trim() || setFind(null))} restorable={folder ? null : restorable} onRestore={() => restore({ folder: restorable.folder })} />
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
        {loading && !current && !linkField ? (
          <div class="empty" role="status">
            <p class="empty-title">Opening {loading.name}</p>
            <p class="empty-hint">from {loading.host}…</p>
            <button type="button" class="quiet" onClick={loading.cancel}>
              Cancel
            </button>
          </div>
        ) : current ? (
          <>
            <Outline articleRef={article} text={current.text} onContents={setHasContents} />
            <Viewer text={current.text} articleRef={article} root={current.root} dirPath={current.dirPath} onFollow={followLink} onJump={jumpTo} onRelative={setHasRelative} shared={shared} base={web} imagesOn={sharedView.imagesOn} onWebImages={setWebImages} />
          </>
        ) : folder ? (
          <div class="empty">
            <p class="empty-title">{folder.tree.children.length ? `Choose a document from ${folder.name}` : `No markdown files in ${folder.name}`}</p>
            <button type="button" class="quiet primary narrow-only" onClick={toggleSidebar}>Show files</button>
          </div>
        ) : (
          <div class="empty">
            <p class="empty-title">{recent.length || restorable ? 'Welcome back' : touch ? 'Open a markdown file' : 'Drop a markdown file or folder here'}</p>
            {/* What was read last comes first: Recent, or the folder of an older session that kept no list. */}
            {recent.length > 0 ? (
              // The Files panel's Recent rows, so the two read as the same list.
              <section class="empty-recent" aria-labelledby="empty-recent-heading">
                <h2 id="empty-recent-heading">Recent</h2>
                <ul class="tree">
                  {recent.slice(0, 3).map(entry => (
                    <li key={entry.key ?? entry.when}>
                      <div class="row">
                        <button type="button" class="row-main" title={entry.name} onClick={() => openRecent(entry)}>
                          <FileText size={14} class="kind" />
                          <span class="row-name">{entry.name}</span>
                          <span class="row-meta">{where(entry)}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : restorable ? (
              <button type="button" class="quiet primary" onClick={() => restore()}>Continue in {restorable.folder.name}</button>
            ) : (
              <button type="button" class="quiet primary" onClick={pickFile}>Open a file</button>
            )}
            <div class="empty-actions">
              {(recent.length > 0 || restorable) && <button type="button" class="quiet action" onClick={pickFile}>Open a file</button>}
              {fs.canOpenFolders && <button type="button" class="quiet action" onClick={pickFolder}>Open a folder</button>}
              {!linkField && (
                <button type="button" class="quiet action" onClick={() => setLinkField(true)}>
                  Open a link…
                </button>
              )}
            </div>
            {linkField && <LinkForm onOpen={openLink} onClose={() => setLinkField(false)} onCancel={cancelOpen} onBusy={setLinkBusy} notify={text => setNotice({ text })} />}
            <p class="empty-hint">Files are read on this device and never uploaded.{touch ? '' : ' Paste a link anywhere to open it.'}</p>
            {!touch && <p class="empty-hint">
              <kbd>{isMac ? '⌘' : 'Ctrl'} O</kbd> file, <kbd>{isMac ? '⌘' : 'Ctrl'} ⇧ O</kbd> folder, <kbd>{isMac ? '⌘' : 'Ctrl'} B</kbd> files panel
            </p>}
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
        <Settings
          settings={lookShown}
          onChange={change}
          open={showSettings}
          dark={dark}
          themes={themes}
          onThemes={setThemes}
          onImport={read => {
            // Imported themes join the saved ones; a name already there keeps the one on this device.
            const before = { settings, themes }
            const added = read.themes.filter(n => !themes.some(o => o.name === n.name))
            change(read.settings)
            setThemes([...themes, ...added])
            return { added: added.length, undo: () => (setSettings(before.settings), setThemes(before.themes)) }
          }}
          onShortcuts={touch ? null : () => setShortcuts(true)}
        />
      </aside>
      {shortcuts && <Shortcuts keys={KEYS} canFolders={fs.canOpenFolders} onClose={() => setShortcuts(false)} />}
    </div>
  )
}

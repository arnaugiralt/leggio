import { useEffect, useRef, useState } from 'preact/hooks'
import * as fs from './fs.js'
import * as idb from './idb.js'

export const FOLDER_NOTICE = { text: 'This file links to other files next to it. Open its folder to follow links and show images.', action: 'folder' }

const nav = window.navigation

// The folder, the open document, pins and restore: every action that opens something, with
// the watchers and the IndexedDB records that follow from it. App keeps layout and input.
export function useLibrary({ onFolderOpen, onReveal }) {
  const [folder, setFolder] = useState(null) // { handle, name, tree }
  const [pinned, setPinned] = useState([]) // [{ id, kind, name, handle, missing? }]
  const [current, setCurrent] = useState(null) // { handle, name, dirPath, root, text }; root is the folder it was opened in, which may not be the sidebar's
  const [currentPinned, setCurrentPinned] = useState(false)
  const [restorable, setRestorable] = useState(null) // { folder, filePath }
  const [notice, setNotice] = useState(null) // { text, action?: 'another' | 'folder' }, shown by App until another document opens
  const setError = text => setNotice(text ? { text } : null)
  const currentRef = useRef(null)
  currentRef.current = current // links and the folder grant run from mount-time closures, where state is stale
  const pendingLink = useRef(null) // the relative link clicked before the folder was granted
  const stopFileWatch = useRef(() => {})
  const stopFolderWatch = useRef(() => {})
  const folderRef = useRef(null)
  const keepScroll = useRef(null)
  const launched = useRef(null) // the file handle the OS opened this window with
  // Name of the document Back or Forward goes to: null when there is none, '' when it is unknown.
  const [back, setBack] = useState(null)
  const [forward, setForward] = useState(null)

  // Files opened from the OS: only fires in an installed PWA, and only once per launch.
  // The queue hands over real FileSystemFileHandles, so watching and relative images keep working.
  // It races the silent restore below, whose file open lands later (after the folder listing),
  // so restore checks this ref and leaves the launched file in place.
  useEffect(() => {
    window.launchQueue?.setConsumer(({ files }) => {
      if (!files?.length) return
      launched.current = files[0]
      openFile(files[0])
    })
  }, [])

  // Pins and the restore record, once. A handle that is still granted needs no gesture,
  // so skip the welcome screen entirely and put the reader back in the document.
  useEffect(() => {
    // Pins saved before ids existed get one for this session; the next pin change stores it.
    idb.get('pinned').then(items => items && setPinned(items.map(item => ({ ...item, id: item.id ?? crypto.randomUUID() }))))
    idb.get('last').then(async last => {
      if (!last?.folder) return
      // A pinned file can live outside the folder, so it carries its own grant.
      const granted = (await fs.hasPermission(last.folder)) && (!last.file || (await fs.hasPermission(last.file)))
      if (granted && (await restore(last))) return
      setRestorable(last)
    })
  }, [])

  // After a live reload or a Back, put the reader where they were. Instant: the root's smooth
  // scroll-behavior would otherwise animate from the top of the document.
  useEffect(() => {
    if (keepScroll.current !== null) {
      window.scrollTo({ top: keepScroll.current, behavior: 'instant' })
      keepScroll.current = null
    }
  }, [current])

  // Session history. Each document open is a browser history entry, so ⌘[, the mouse buttons and
  // the trackpad swipe come from the browser. The document lives in the entry's Navigation API
  // state: history.state would be simpler, but Chrome drops any history.state holding a handle
  // on Back and Forward. Scroll is saved into the current entry as it settles, because a
  // traversal reports the change after it happened, too late to save the entry left behind.
  useEffect(() => {
    if (!nav) return // no Navigation API: no history, and both buttons stay disabled
    history.scrollRestoration = 'manual' // ours restores after the document renders; the browser's would land on the old one
    let timer = 0
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const entry = nav.currentEntry.getState()
        if (entry) writeEntry({ ...entry, scrollY: window.scrollY })
      }, 150)
    }
    const onChange = e => {
      const list = nav.entries()
      const i = nav.currentEntry.index
      setBack(nav.canGoBack ? (list[i - 1]?.getState()?.name ?? '') : null)
      setForward(nav.canGoForward ? (list[i + 1]?.getState()?.name ?? '') : null)
      if (e?.navigationType !== 'traverse') return
      clearTimeout(timer) // a pending save belongs to the entry just left
      goTo(nav.currentEntry.getState())
    }
    onChange()
    window.addEventListener('scroll', onScroll, { passive: true })
    nav.addEventListener('currententrychange', onChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      nav.removeEventListener('currententrychange', onChange)
    }
  }, [])

  // Is the current file pinned? isSame is async, so this is derived in an effect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let found = false
      if (current?.handle) {
        for (const item of pinned) {
          if (item.kind === 'file' && (await fs.isSame(item.handle, current.handle))) found = true
        }
      }
      if (!cancelled) setCurrentPinned(found)
    })()
    return () => {
      cancelled = true
    }
  }, [current, pinned])

  useEffect(
    () => () => {
      stopFileWatch.current()
      stopFolderWatch.current()
    },
    [],
  )

  // pick: the person chose this folder (picker, drop, pin), so show them something. Restore, history and
  // openFolderFor reopen a folder around a document of their own and leave it alone.
  async function openFolder(handle, { pick = false } = {}) {
    try {
      if (!(await fs.ensurePermission(handle))) {
        setError(`Access to ${handle.name} was not granted.`)
        return false
      }
      const tree = await fs.listMarkdown(handle)
      setFolder({ handle, name: handle.name, tree })
      folderRef.current = handle // openFile can be called from a mount-time closure (drop, shortcuts), where the state read is stale
      onFolderOpen() // show the result; otherwise opening a folder looks like nothing happened
      setRestorable(null)
      setError('')
      // A copy cannot be reopened after a reload, so it never replaces the restore record.
      if (!currentRef.current && !handle.copy) idb.set('last', { folder: handle, filePath: null, file: null }) // reading something: its own record stays
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
      if (pick) {
        const files = tree.children.filter(c => c.kind === 'file')
        const find = re => files.find(c => re.test(c.name))
        const start = find(/^readme\.(md|markdown|txt)$/i) ?? find(/^index\.(md|markdown|txt)$/i)
        if (start) openFile(start.handle, { dirPath: [], root: handle })
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

  // A new document starts at its top, not animated up from the old position.
  function show(doc) {
    setCurrent(doc)
    setRestorable(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // dirPath and root are set when the file lives inside an open folder; null otherwise.
  async function openFile(handle, { dirPath = null, root = null, fromHistory = false } = {}) {
    try {
      if (!(await fs.ensurePermission(handle))) {
        setError(`Access to ${handle.name} was not granted.`)
        return false
      }
      const file = await fs.getFile(handle)
      // Pickers and links only offer markdown names; a drop can bring anything. Other text files still open.
      if (!fs.isMarkdownName(handle.name) && !file.type.startsWith('text/')) {
        setError(`${handle.name} isn't a markdown file. Open a .md, .markdown or .txt file.`)
        return false
      }
      const text = await file.text()
      if (!fromHistory) await record({ handle, name: handle.name, dirPath, root })
      show({ handle, name: handle.name, dirPath, root, text })
      // The path is what survives a folder being re-granted, but pins and the picker give no path,
      // so the handle rides along as the fallback.
      const inFolder = root ?? folderRef.current
      if (inFolder && !inFolder.copy && !handle.copy) idb.set('last', { folder: inFolder, filePath: root && dirPath ? [...dirPath, handle.name] : null, file: handle })
      stopFileWatch.current()
      stopFileWatch.current = fs.watch(handle, async () => {
        try {
          const next = await (await fs.getFile(handle)).text()
          setCurrent(c => {
            if (!c || c.handle !== handle || c.text === next) return c
            keepScroll.current = window.scrollY
            return { ...c, text: next }
          })
        } catch {
          setNotice({ text: `${handle.name} was moved or deleted. You're reading the last version.`, action: 'another' })
          stopFileWatch.current() // nothing left to watch
        }
      })
      return true
    } catch {
      setError(`Could not read ${handle.name}.`)
      return false
    }
  }

  // The sidebar follows the document's folder (Finder's Back, a link back out of another folder).
  // No README auto-open: the person already has a document.
  async function showFolder(root) {
    if (!(await fs.isSame(folderRef.current, root))) await openFolder(root)
  }

  // Every relative link lands here, so none of them can navigate the window. It resolves against the
  // document's own folder, which is not necessarily the one the sidebar shows.
  async function followLink(href) {
    const cur = currentRef.current
    const root = cur?.root
    if (!cur?.dirPath || !root) {
      pendingLink.current = href // followed once the folder is granted
      return setNotice(FOLDER_NOTICE)
    }
    const [path, hash] = href.split('#')
    const segments = fs.resolvePath(cur.dirPath, path)
    const name = path.split('/').filter(Boolean).pop() || path
    try {
      if (!segments) throw 0
      let handle
      try {
        handle = await fs.getFileByPath(root, segments)
      } catch (err) {
        if (err.name !== 'TypeMismatchError') throw err
        await fs.getDirByPath(root, segments) // a folder: show it in the tree
        await showFolder(root)
        return onReveal(segments)
      }
      if (fs.isMarkdownName(name)) {
        await showFolder(root)
        await openFile(handle, { dirPath: segments.slice(0, -1), root })
        if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
        return
      }
      const file = await fs.getFile(handle)
      const url = URL.createObjectURL(file)
      if (fs.opensInTab(file.type)) window.open(url, '_blank')
      else {
        // A blob URL has no file name, so a tab would save it under a GUID.
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setNotice({ text: `Downloaded ${file.name}.` })
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000) // the tab or the download has fetched it long before
    } catch {
      setError(`${name} isn't in this folder.`)
    }
  }

  // The open file came without a folder. Once one is granted, find the file inside it and
  // reopen it with a folder context so links and images resolve.
  async function openFolderFor(dir) {
    const cur = currentRef.current
    if (!cur?.handle || !(await openFolder(dir))) return false
    const segments = await fs.resolve(dir, cur.handle)
    if (!segments) {
      setNotice({ text: `${cur.name} isn't inside ${dir.name}. Choose the folder that contains it.`, action: 'folder' })
      return false
    }
    await openFile(cur.handle, { dirPath: segments.slice(0, -1), root: dir })
    const link = pendingLink.current
    pendingLink.current = null
    if (link) await followLink(link)
    return true
  }

  // By id, not position: the list can change while the permission prompt is up.
  async function openPinned(item) {
    const markMissing = () => setPinned(p => p.map(x => (x.id === item.id ? { ...x, missing: true } : x)))
    // A pin whose target is gone says so in its row instead of failing as a read error.
    if ((await fs.hasPermission(item.handle)) && !(await fs.exists(item.handle))) return markMissing()
    const ok = item.kind === 'directory' ? await openFolder(item.handle, { pick: true }) : await openFile(item.handle)
    if (!ok) markMissing()
  }

  // Only where access is already granted: a prompt would need a gesture, and the panel opening is not one.
  async function checkPins() {
    const gone = new Map()
    for (const item of pinned) if (await fs.hasPermission(item.handle)) gone.set(item.handle, !(await fs.exists(item.handle)))
    setPinned(p => (p.some(x => gone.has(x.handle) && gone.get(x.handle) !== !!x.missing) ? p.map(x => (gone.has(x.handle) ? { ...x, missing: gone.get(x.handle) } : x)) : p))
  }

  async function togglePin(item) {
    let index = -1
    for (let i = 0; i < pinned.length; i++) if (await fs.isSame(pinned[i].handle, item.handle)) index = i
    // A row key: names repeat (README.md in two folders) and handles are not stable values across reloads.
    const next = index >= 0 ? pinned.filter((_, i) => i !== index) : [...pinned, { id: crypto.randomUUID(), kind: item.kind, name: item.name, handle: item.handle }]
    setPinned(next)
    idb.set('pinned', next.map(({ id, kind, name, handle }) => ({ id, kind, name, handle })))
  }

  async function restore(last = restorable) {
    if (!(await openFolder(last.folder))) return false
    // openFolder just saved a record without a file; the launched open ran before the folder was set, so it saved none.
    if (launched.current) {
      idb.set('last', { folder: last.folder, filePath: null, file: launched.current })
      return true
    }
    if (!last.filePath && !last.file) return true
    try {
      const handle = last.filePath ? await fs.getFileByPath(last.folder, last.filePath) : last.file
      await openFile(handle, { dirPath: last.filePath?.slice(0, -1) ?? null, root: last.filePath ? last.folder : null })
    } catch {
      setError(`${last.filePath?.join('/') ?? last.file.name} was not found.`)
    }
    return true
  }

  function writeEntry(entry, push = false) {
    if (!nav) return
    if (push) history.pushState(null, '')
    nav.updateCurrentEntry({ state: entry })
  }

  // A new document pushes an entry; the first one in the window, or the same file again, replaces.
  // ponytail: for a copy, entry.root is the whole copied tree, and the browser clones it into history state on
  // every write, scroll saves included. Fine for notes; for a copied folder of thousands of files, keep copies in
  // a module-level map and store only the copy id here.
  async function record(entry) {
    const prev = nav?.currentEntry.getState()
    const same = await fs.isSame(prev?.handle, entry.handle)
    if (!prev || same) return writeEntry(entry)
    writeEntry({ ...prev, scrollY: window.scrollY }) // the debounced save may not have caught the last scroll
    writeEntry(entry, true)
  }

  async function goTo(entry) {
    // ponytail: Chrome keeps only the current entry's state across a reload, so older entries come back
    // empty. Mirroring each folder path into history.state would let them reopen from the open folder.
    // No handle: an entry saved before plain files became copies.
    if (!entry?.handle) return setError('This document was opened before the window reloaded. Open it again from Files.')
    keepScroll.current = entry.scrollY ?? null
    // The tree follows the document, as Finder's Back changes the location.
    if (entry.root) await showFolder(entry.root)
    if (!(await openFile(entry.handle, { dirPath: entry.dirPath, root: entry.root, fromHistory: true }))) {
      keepScroll.current = null
      setError(`${entry.name} was moved or deleted.`) // the entry stays, so the next Back steps past it
    }
  }

  // A link to a heading in the same document is an entry too, so Back returns from a footnote or a table of contents.
  function jumpTo(id) {
    const el = document.getElementById(id)
    if (!el) return setNotice({ text: `Section “${id}” isn't in this document.` })
    const entry = nav?.currentEntry.getState()
    if (entry) {
      writeEntry({ ...entry, scrollY: window.scrollY })
      writeEntry({ ...entry, scrollY: null }, true)
    }
    el.scrollIntoView({ block: 'start' })
  }

  return { folder, pinned, current, currentPinned, restorable, notice, setNotice, back, forward, openFolder, openFolderFor, openFile, followLink, openPinned, checkPins, togglePin, restore, jumpTo }
}

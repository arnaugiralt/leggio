// The only module that touches the File System Access API. A Tauri backend would replace this file.
// Every function here also takes a copy (see "Copies" below), so other modules never call handle methods.

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window
// Whether a folder can be opened at all: the picker, or a folder input. Phones and tablets report the folder input
// too (iOS does), but its picker offers no folders there, so a touch-only device gets no folder action.
export const canOpenFolders =
  typeof window !== 'undefined' && (supported || ('webkitdirectory' in HTMLInputElement.prototype && !matchMedia('(hover: none) and (pointer: coarse)').matches))

const MARKDOWN = /\.(md|markdown|txt)$/i
export const isMarkdownName = name => MARKDOWN.test(name)

// A leading "word:" reads as a scheme, as in a real href; write ./notes:draft.md to force a relative path.
// Relative means: no fragment, not root-relative, not protocol-relative, no scheme.
export const isRelative = url => !/^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(url)

// Followable from the reader: relative, or root-relative (/x), which resolves from the open folder's root.
export const isLocal = url => isRelative(url) || /^\/(?!\/)/.test(url)

// startIn may be a file handle: the picker then opens in that file's folder, so granting it is one click.
export async function pickDirectory({ startIn } = {}) {
  try {
    return await window.showDirectoryPicker({ mode: 'read', ...(startIn && !startIn.copy && { startIn }) })
  } catch (err) {
    if (err.name === 'AbortError') return null
    throw err
  }
}

export async function pickFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } }],
    })
    return handle
  } catch (err) {
    if (err.name === 'AbortError') return null
    throw err
  }
}

// Must be called synchronously inside the drop handler; dataTransfer items are gone after the event.
export function handleFromDrop(dataTransfer) {
  const item = dataTransfer.items?.[0]
  return item?.getAsFileSystemHandle ? item.getAsFileSystemHandle() : Promise.resolve(null)
}

// Safe outside a user gesture: it never prompts, it only reports an already-granted handle.
export async function hasPermission(handle) {
  if (!handle.queryPermission) return true
  return (await handle.queryPermission({ mode: 'read' })) === 'granted'
}

// Denied, not just ungranted: 'prompt' can still be granted (ensurePermission asks), so only 'denied' rules a handle out.
// A query that fails counts as denied, so the caller falls back to a copy instead of stopping.
export async function isDenied(handle) {
  try {
    return !!handle.queryPermission && (await handle.queryPermission({ mode: 'read' })) === 'denied'
  } catch {
    return true
  }
}

// Call from a user gesture whenever a prompt is possible.
export async function ensurePermission(handle) {
  if (!handle.queryPermission) return true
  const opts = { mode: 'read' }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  return (await handle.requestPermission(opts)) === 'granted'
}

const byName = (a, b) => a.name.localeCompare(b.name)
const skipped = name => name.startsWith('.') || name === 'node_modules'

// Markdown files only; hidden folders and node_modules skipped; folders without markdown pruned; folders first.
export async function listMarkdown(dir) {
  const files = []
  const dirs = []
  for await (const [name, handle] of dir.copy ? dir.children.map(c => [c.name, c]) : dir.entries()) {
    if (skipped(name)) continue
    if (handle.kind === 'directory') {
      const child = await listMarkdown(handle)
      if (child.children.length) dirs.push(child)
    } else if (MARKDOWN.test(name)) {
      files.push({ name, kind: 'file', handle })
    }
  }
  return { name: dir.name, kind: 'directory', handle: dir, children: [...dirs.sort(byName), ...files.sort(byName)] }
}

export const getFile = handle => (handle.copy ? Promise.resolve(handle.file) : handle.getFile())

// FileSystemObserver where present. Fallback polls lastModified once a second for files only;
// folders without the observer are relisted on window focus by the caller. A copy never changes.
export function watch(handle, onChange) {
  if (handle.copy) return () => {}
  if (typeof FileSystemObserver === 'function') {
    const observer = new FileSystemObserver(() => onChange())
    observer.observe(handle, { recursive: handle.kind === 'directory' }).catch(() => {})
    return () => observer.disconnect()
  }
  if (handle.kind !== 'file') return () => {}
  let last = null
  const tick = async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const { lastModified } = await handle.getFile()
      if (last !== null && lastModified !== last) onChange()
      last = lastModified
    } catch {}
  }
  tick()
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}

function decode(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

// dirPath: the current file's directory as segments from the folder root. Returns null when the path escapes the root or is empty.
export function resolvePath(dirPath, relative) {
  const out = relative.startsWith('/') ? [] : [...dirPath]
  for (const raw of relative.split('/')) {
    const seg = decode(raw)
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (!out.length) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.length ? out : null
}

// A copy throws the same DOMException names as a handle, so callers handle both alike.
async function child(dir, name, kind) {
  if (!dir.copy) return kind === 'file' ? dir.getFileHandle(name) : dir.getDirectoryHandle(name)
  const hit = dir.children.find(c => c.name === name)
  if (!hit) throw new DOMException(`${name} was not found`, 'NotFoundError')
  if (hit.kind !== kind) throw new DOMException(`${name} is not a ${kind}`, 'TypeMismatchError')
  return hit
}

// A decoded segment may contain '/' (from %2F); getDirectoryHandle and getFileHandle reject such names, so it fails closed.
export async function getFileByPath(root, segments) {
  let dir = root
  for (const seg of segments.slice(0, -1)) dir = await child(dir, seg, 'directory')
  return child(dir, segments[segments.length - 1], 'file')
}

export async function getDirByPath(root, segments) {
  let dir = root
  for (const seg of segments) dir = await child(dir, seg, 'directory')
  return dir
}

export async function isSame(a, b) {
  if (!a || !b) return false
  if (a.copy || b.copy) return a.copy === b.copy && a.kind === b.kind && a.path.join('/') === b.path.join('/')
  return a === b || a.isSameEntry(b)
}

// The path of handle inside dir, or null when it is not inside.
export async function resolve(dir, handle) {
  if (!dir.copy) return handle.copy ? null : dir.resolve(handle)
  if (dir.copy === handle.copy) return handle.path.slice(0, dir.path.length).join('/') === dir.path.join('/') ? handle.path.slice(dir.path.length) : null
  // A copy has no location on disk. The file is taken to be the one in the folder with its name, size and date,
  // if exactly one matches.
  const file = await getFile(handle)
  const same = copiedFiles(dir).filter(c => c.name === file.name && c.file.size === file.size && c.file.lastModified === file.lastModified)
  return same.length === 1 ? same[0].path.slice(dir.path.length) : null
}

const copiedFiles = dir => dir.children.flatMap(c => (c.kind === 'file' ? [c] : copiedFiles(c)))

// Only NotFoundError means gone; anything else (permission, a busy disk) says nothing about the entry.
export async function exists(handle) {
  if (handle.copy) return true
  try {
    if (handle.kind === 'file') await handle.getFile()
    else await handle.entries().next()
    return true
  } catch (err) {
    return err.name !== 'NotFoundError'
  }
}

// Copies. Without the File System Access API, or when the browser blocks it (a managed Chrome can), files come
// from a file input or a drop instead. Those give File objects read at that moment: no live reload, no restore,
// no pins. A copy is plain data plus File objects, never a class, because history state keeps it through a
// structured clone, which drops methods. `copy` is an id shared by every node of one copy, so isSame works on clones.

export function fromFile(file) {
  return { copy: crypto.randomUUID(), kind: 'file', name: file.name, path: [file.name], file }
}

// files: [[segments below the root], File]. Folders are created from the paths, so empty ones never appear.
function copyTree(name, files) {
  const copy = crypto.randomUUID()
  const root = { copy, kind: 'directory', name, path: [], children: [] }
  for (const [segments, file] of files) {
    if (segments.some(skipped)) continue
    let dir = root
    segments.slice(0, -1).forEach((seg, i) => {
      let next = dir.children.find(c => c.kind === 'directory' && c.name === seg)
      if (!next) dir.children.push((next = { copy, kind: 'directory', name: seg, path: segments.slice(0, i + 1), children: [] }))
      dir = next
    })
    dir.children.push({ copy, kind: 'file', name: file.name, path: segments, file })
  }
  return root
}

// From <input webkitdirectory>: each file's webkitRelativePath starts with the chosen folder's name.
export function fromFileList(list) {
  const files = [...list].map(file => [file.webkitRelativePath.split('/'), file])
  if (!files.length) return null
  return copyTree(files[0][0][0], files.map(([segments, file]) => [segments.slice(1), file]))
}

// From a drop, through the older entries API, which no file access setting blocks. The entry must be taken
// inside the drop handler; reading it later is fine.
export async function fromEntry(entry) {
  const fileOf = e => new Promise((resolve, reject) => e.file(resolve, reject))
  if (entry.isFile) return fromFile(await fileOf(entry))
  const files = []
  async function walk(dir, prefix) {
    const reader = dir.createReader()
    // readEntries returns at most 100 entries per call; an empty batch is the end.
    for (let batch; (batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))).length; ) {
      for (const e of batch) {
        if (skipped(e.name)) continue
        if (e.isDirectory) await walk(e, [...prefix, e.name])
        else files.push([[...prefix, e.name], await fileOf(e)])
      }
    }
  }
  await walk(entry, [])
  return copyTree(entry.name, files)
}

// Types a new tab shows instead of saving. SVG and HTML are left out: opened from a blob URL they run
// scripts in this app's origin, with its folder grants.
export const opensInTab = type => /^(image|audio|video)\//.test(type) ? type !== 'image/svg+xml' : type === 'application/pdf' || type === 'text/plain'

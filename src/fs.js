// The only module that touches the File System Access API. A Tauri backend would replace this file.

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

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
    return await window.showDirectoryPicker({ mode: 'read', ...(startIn && { startIn }) })
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

// Call from a user gesture whenever a prompt is possible.
export async function ensurePermission(handle) {
  if (!handle.queryPermission) return true
  const opts = { mode: 'read' }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  return (await handle.requestPermission(opts)) === 'granted'
}

const byName = (a, b) => a.name.localeCompare(b.name)

// Markdown files only; hidden folders and node_modules skipped; folders without markdown pruned; folders first.
export async function listMarkdown(dir) {
  const files = []
  const dirs = []
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.') || name === 'node_modules') continue
    if (handle.kind === 'directory') {
      const child = await listMarkdown(handle)
      if (child.children.length) dirs.push(child)
    } else if (MARKDOWN.test(name)) {
      files.push({ name, kind: 'file', handle })
    }
  }
  return { name: dir.name, kind: 'directory', handle: dir, children: [...dirs.sort(byName), ...files.sort(byName)] }
}

export const readText = async handle => (await handle.getFile()).text()

// FileSystemObserver where present. Fallback polls lastModified once a second for files only;
// folders without the observer are relisted on window focus by the caller.
export function watch(handle, onChange) {
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

// A decoded segment may contain '/' (from %2F); getDirectoryHandle and getFileHandle reject such names, so it fails closed.
export async function getFileByPath(root, segments) {
  let dir = root
  for (const seg of segments.slice(0, -1)) dir = await dir.getDirectoryHandle(seg)
  return dir.getFileHandle(segments[segments.length - 1])
}

export async function getDirByPath(root, segments) {
  let dir = root
  for (const seg of segments) dir = await dir.getDirectoryHandle(seg)
  return dir
}

// Only NotFoundError means gone; anything else (permission, a busy disk) says nothing about the entry.
export async function exists(handle) {
  try {
    if (handle.kind === 'file') await handle.getFile()
    else await handle.entries().next()
    return true
  } catch (err) {
    return err.name !== 'NotFoundError'
  }
}

// Types a new tab shows instead of saving. SVG and HTML are left out: opened from a blob URL they run
// scripts in this app's origin, with its folder grants.
export const opensInTab = type => /^(image|audio|video)\//.test(type) ? type !== 'image/svg+xml' : type === 'application/pdf' || type === 'text/plain'

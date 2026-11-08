// Recent documents: what to keep of each one, and the list's order. Pure, so it runs under node; useLibrary
// stores the list in IndexedDB and reopens entries.
//
// A real file is kept by its handle (and its folder, so links still resolve). A web document is kept by its
// address and fetched again. A copy, and a shared document, have no file to go back to, so their text is kept
// on the device: that is how a phone, which only reads copies, gets its document back after a reload.

export const MAX_RECENT = 10

// Where a recent document comes from, in its row's one muted line: its folder, its host, or "Shared".
export function where(entry) {
  if (entry.kind === 'web') return new URL(entry.url).host
  if (entry.kind === 'shared') return 'Shared'
  // A file at a folder's root names the folder, so two README.md entries can be told apart.
  return entry.dirPath?.length ? entry.dirPath.join(' / ') : entry.root?.name ?? ''
}
// Characters; a bigger copy isn't kept. Under the 5 MB a shared document may decode to, even in 4-byte UTF-8.
export const MAX_TEXT = 1_000_000

export function entryFor({ handle, name, dirPath = null, root = null, text }, when = Date.now()) {
  if (handle.web) return { key: docKey(handle), kind: 'web', name, url: handle.web, when }
  if (handle.copy) {
    if (text.length > MAX_TEXT) return null
    const kind = handle.shared ? 'shared' : 'copy'
    // The date comes back on the copy made from this text, so it keeps its key, and its scroll position.
    return { key: docKey(handle, dirPath, name), kind, name, dirPath, text, modified: handle.file?.lastModified ?? 0, when }
  }
  return { key: null, kind: 'file', name, dirPath, root, handle, when }
}

// Newest first; an older entry for the same document drops out. Handles can only be compared asynchronously,
// so sameFile decides for real files.
export async function add(list, entry, sameFile) {
  const rest = []
  for (const e of list) {
    const same = entry.key ? e.key === entry.key : e.kind === 'file' && (await sameFile(e.handle, entry.handle))
    if (!same) rest.push(e)
  }
  return [entry, ...rest].slice(0, MAX_RECENT)
}

// One name per document, stable across opens: what Recent and the scroll position know it by. Two documents with
// one name must not share it: a shared one goes by its share id, a copy by its size and date too, and a file by
// the folder it was opened in (every folder has a README.md).
export function docKey(handle, dirPath, name, root) {
  const path = [...(dirPath ?? []), name].join('/')
  if (handle.web) return `url:${handle.web}`
  if (handle.shared) return `shared:${handle.copy}`
  if (handle.copy) return `copy:${path}:${handle.file?.size ?? 0}:${handle.file?.lastModified ?? 0}`
  return `file:${root?.name ? `${root.name}/` : ''}${path}`
}

// Where each document was left, so reopening it from Recent, a pin or a reload resumes there. Long documents
// are read over days. A plain object in localStorage, newest last, cut to the last 200.
const SCROLL_KEY = 'leggio.scroll'
const MAX_SCROLLS = 200

function scrolls(storage) {
  try {
    const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(SCROLL_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function keepScroll(key, y, storage) {
  const all = scrolls(storage)
  delete all[key] // re-added last, so the order stays oldest first
  if (y > 0) all[key] = Math.round(y)
  const keys = Object.keys(all)
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SCROLLS))) delete all[k]
  try {
    ;(storage ?? globalThis.localStorage).setItem(SCROLL_KEY, JSON.stringify(all))
  } catch {}
}

export const scrollOf = (key, storage) => scrolls(storage)[key] ?? null

// "Forget recent" forgets where documents were left too; the old map comes back with Undo.
export function forgetScrolls(storage) {
  const all = scrolls(storage)
  try {
    ;(storage ?? globalThis.localStorage).removeItem(SCROLL_KEY)
  } catch {}
  return all
}

export function restoreScrolls(all, storage) {
  try {
    ;(storage ?? globalThis.localStorage).setItem(SCROLL_KEY, JSON.stringify(all))
  } catch {}
}

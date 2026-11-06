// Recent documents: what to keep of each one, and the list's order. Pure, so it runs under node; useLibrary
// stores the list in IndexedDB and reopens entries.
//
// A real file is kept by its handle (and its folder, so links still resolve). A web document is kept by its
// address and fetched again. A copy, and a shared document, have no file to go back to, so their text is kept
// on the device: that is how a phone, which only reads copies, gets its document back after a reload.

export const MAX_RECENT = 10
export const MAX_TEXT = 2_000_000 // characters; a bigger copy isn't kept

export function entryFor({ handle, name, dirPath = null, root = null, text }, when = Date.now()) {
  if (handle.web) return { key: `url:${handle.web}`, kind: 'web', name, url: handle.web, when }
  if (handle.copy) {
    if (text.length > MAX_TEXT) return null
    const kind = handle.shared ? 'shared' : 'copy'
    return { key: `${kind}:${[...(dirPath ?? []), name].join('/')}`, kind, name, dirPath, text, when }
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

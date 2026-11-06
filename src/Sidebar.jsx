import { useEffect, useRef, useState } from 'preact/hooks'
import * as fs from './fs.js'
import { FileText, Folder, FolderOpen, X } from './icons.jsx'

function PinButton({ item, label = 'Pin', onTogglePin }) {
  if (item.handle.copy) return null // a pin reopens its file after a reload, and a copy cannot be reopened
  // Out of the Tab order: the tree takes one Tab stop, and P pins the row that has focus.
  return (
    <button type="button" class="pin" tabindex="-1" aria-label={`${label} ${item.name}`} onClick={() => onTogglePin(item)}>
      {label}
    </button>
  )
}

// The tree keyboard pattern, shared by the pins, the folder tree and search results: one Tab stop per list,
// ↑↓ move, → opens a folder or steps into it, ← closes it or steps out, Home and End, letters jump to a name,
// P pins. Rows are the .row-main buttons; Enter and Space are their own clicks.
let typed = ''
let typedAt = 0
function onTreeKey(e) {
  const tree = e.currentTarget
  const rows = [...tree.querySelectorAll('.row-main')]
  const row = e.target.closest('.row-main')
  const i = rows.indexOf(row)
  if (i < 0) return
  const go = n => {
    e.preventDefault()
    rows[Math.max(0, Math.min(rows.length - 1, n))]?.focus()
  }
  const expanded = row.getAttribute('aria-expanded')
  const plain = !e.metaKey && !e.ctrlKey && !e.altKey
  if (e.key === 'ArrowDown') go(i + 1)
  else if (e.key === 'ArrowUp') go(i - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(rows.length - 1)
  else if (e.key === 'ArrowRight' && expanded !== null) {
    e.preventDefault()
    expanded === 'false' ? row.click() : go(i + 1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (expanded === 'true') row.click()
    else row.closest('li')?.parentElement.closest('li')?.querySelector('.row-main')?.focus()
  } else if ((e.key === 'p' || e.key === 'P') && plain && row.parentElement.querySelector('.pin')) {
    e.preventDefault()
    row.parentElement.querySelector('.pin').click()
  } else if (e.key.length === 1 && /\S/.test(e.key) && plain) {
    const now = Date.now()
    typed = now - typedAt < 600 ? typed + e.key.toLowerCase() : e.key.toLowerCase()
    typedAt = now
    // A repeated first letter moves on to the next match; a longer prefix starts from this row.
    const order = [...rows.slice(i + (typed.length > 1 ? 0 : 1)), ...rows.slice(0, i + 1)]
    const hit = order.find(r => r.querySelector('.row-name')?.textContent.toLowerCase().startsWith(typed))
    if (hit) go(rows.indexOf(hit))
  }
}

// After each render: one row in each list takes Tab (the focused one, else the one that had it, else the open
// document's, else the first).
function rove(container) {
  for (const tree of container.querySelectorAll('[role="tree"]')) {
    const rows = [...tree.querySelectorAll('.row-main')]
    const keep = rows.find(r => r === document.activeElement) ?? rows.find(r => r.tabIndex === 0 && r.dataset.roved) ?? rows.find(r => r.getAttribute('aria-current')) ?? rows[0]
    for (const r of rows) {
      r.tabIndex = r === keep ? 0 : -1
      r.dataset.roved = ''
    }
  }
}

function Tree({ node, root, path, collapsed, toggle, activePath, onOpenFile, onTogglePin, label }) {
  return (
    <ul class="tree" role={label ? 'tree' : 'group'} aria-label={label} onKeyDown={label ? onTreeKey : undefined}>
      {node.children.map(child => {
        const childPath = [...path, child.name]
        const key = childPath.join('/')
        if (child.kind === 'directory') {
          const open = !collapsed.has(key)
          return (
            <li key={key} data-path={key} role="none">
              <div class="row">
                <button type="button" role="treeitem" class="row-main" title={child.name} aria-expanded={open ? 'true' : 'false'} onClick={() => toggle(key)}>
                  {open ? <FolderOpen size={14} class="kind" /> : <Folder size={14} class="kind" />}
                  <span class="row-name">{child.name}</span>
                </button>
                <PinButton item={child} onTogglePin={onTogglePin} />
              </div>
              {open && <Tree node={child} root={root} path={childPath} collapsed={collapsed} toggle={toggle} activePath={activePath} onOpenFile={onOpenFile} onTogglePin={onTogglePin} />}
            </li>
          )
        }
        const active = key === activePath
        return (
          <li key={key} role="none">
            <div class={`row${active ? ' active' : ''}`}>
              <button type="button" role="treeitem" class="row-main" title={child.name} aria-current={active ? 'page' : undefined} onClick={() => onOpenFile(child.handle, path, root)}>
                <FileText size={14} class="kind" />
                <span class="row-name">{child.name}</span>
              </button>
              <PinButton item={child} onTogglePin={onTogglePin} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Every markdown file in the tree, with its folder path.
function filesOf(node, path = []) {
  return node.children.flatMap(c => (c.kind === 'directory' ? filesOf(c, [...path, c.name]) : [{ name: c.name, handle: c.handle, path }]))
}

// A short piece of text around the first match.
function snippet(text, at, length) {
  const start = Math.max(0, at - 40)
  const end = Math.min(text.length, at + length + 60)
  // Markup would read as noise here: headings' #, emphasis, a link's address.
  const plain = text.slice(start, end).replace(/\]\([^)]*\)/g, '').replace(/[#*_`>~[\]!]+/g, '').replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${plain}${end < text.length ? '…' : ''}`
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Search in the open folder: names first, then text. Files are read on the first search and kept until they
// change (by date and size), so a reader who never searches pays nothing.
function Search({ folder, onOpenFile, query, setQuery }) {
  const [result, setResult] = useState(null) // { names, texts, matches, read, total, failed, done }
  const cache = useRef(new Map()) // path → { stamp, text }
  const input = useRef()
  const list = useRef()

  useEffect(() => cache.current.clear(), [folder.handle])
  useEffect(() => list.current && rove(list.current.parentElement)) // results stream in after the panel's own render

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) return setResult(null)
    let stop = false
    const files = filesOf(folder.tree)
    const names = files.filter(f => [...f.path, f.name].join('/').toLowerCase().includes(q))
    const texts = []
    let matches = 0
    let failed = 0
    setResult({ names, texts: [], matches: 0, read: 0, total: files.length, failed: 0, done: false })
    const timer = setTimeout(async () => {
      for (let n = 0; n < files.length && !stop; n++) {
        const f = files[n]
        const key = [...f.path, f.name].join('/')
        try {
          const file = await fs.getFile(f.handle)
          const stamp = `${file.lastModified}:${file.size}`
          let hit = cache.current.get(key)
          if (hit?.stamp !== stamp) cache.current.set(key, (hit = { stamp, text: await file.text() }))
          const lower = hit.text.toLowerCase()
          const at = lower.indexOf(q)
          if (at >= 0) {
            let count = 0
            for (let i = at; i >= 0; i = lower.indexOf(q, i + q.length)) count++
            matches += count
            texts.push({ ...f, count, snippet: snippet(hit.text, at, q.length) })
          }
        } catch {
          failed++
        }
        // Results arrive in batches, so a large folder shows its first matches at once.
        if (!stop && (n % 25 === 24 || n === files.length - 1)) setResult({ names, texts: [...texts], matches, read: n + 1, total: files.length, failed, done: n === files.length - 1 })
      }
    }, 120) // typing pauses before reading starts
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [query, folder.tree])

  const open = f => onOpenFile(f.handle, f.path, folder.handle, query.trim())
  const row = (f, extra) => (
    <li key={[...f.path, f.name].join('/')} role="none">
      <div class="row">
        <button type="button" role="treeitem" class="row-main result" title={[...f.path, f.name].join(' / ')} onClick={() => open(f)}>
          <FileText size={14} class="kind" />
          <span class="result-text">
            <span class="row-name">{f.name}</span>
            {f.path.length > 0 && <span class="result-meta">{f.path.join(' / ')}</span>}
            {extra}
          </span>
        </button>
      </div>
    </li>
  )

  return (
    <>
      <div class="search" role="search">
        <input
          ref={input}
          type="search"
          value={query}
          placeholder={`Search ${folder.name}`}
          aria-label={`Search in ${folder.name}`}
          onInput={e => setQuery(e.currentTarget.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              document.querySelector('#files .results .row-main')?.focus()
            } else if (e.key === 'Escape' && query) {
              e.stopPropagation() // clears the search; a second Esc closes the drawer as usual
              setQuery('')
            }
          }}
        />
        {query && (
          <button type="button" class="quiet search-clear" aria-label="Clear search" onClick={() => (setQuery(''), input.current.focus())}>
            <X size={14} />
          </button>
        )}
      </div>
      {result && (
        // One tree for both groups, so ↓ runs from the name matches on into the text matches.
        <div ref={list} class="results" role="tree" aria-label="Search results" onKeyDown={onTreeKey}>
          {result.names.length > 0 && (
            <>
              <h3>Names</h3>
              <ul class="tree" role="group" aria-label="Files whose name matches">
                {result.names.slice(0, 50).map(f => row(f))}
              </ul>
            </>
          )}
          {result.texts.length > 0 && (
            <>
              <h3>
                Text · {plural(result.matches, 'match', 'matches')} in {plural(result.texts.length, 'file', 'files')}
              </h3>
              <ul class="tree" role="group" aria-label="Files whose text matches">
                {result.texts.map(f => row(f, <span class="result-snippet">{f.snippet}</span>))}
              </ul>
            </>
          )}
          <p class="side-hint" role="status">
            {!result.done
              ? `Searching… ${result.read} of ${result.total} files`
              : !result.names.length && !result.texts.length
                ? `Nothing matches “${query.trim()}” in ${folder.name}.`
                : result.failed > 0
                  ? `${plural(result.failed, "file couldn't", "files couldn't")} be read.`
                  : ''}
          </p>
        </div>
      )}
    </>
  )
}

// Pinned items, the open folder's markdown tree, and search in that folder. Folders start expanded; collapse
// state is keyed by path.
export function Sidebar({ reveal, folder, pinned, current, onOpenFile, onOpenPinned, onPickFolder, onTogglePin, query, setQuery }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const box = useRef()
  // The document keeps the folder it was opened in; its row only shows when that is the folder in the tree.
  const [sameRoot, setSameRoot] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const same = !!(current?.root && folder && (await fs.isSame(current.root, folder.handle)))
      if (!cancelled) setSameRoot(same)
    })()
    return () => {
      cancelled = true
    }
  }, [current?.root, folder?.handle])
  const activePath = sameRoot && current.dirPath ? [...current.dirPath, current.name].join('/') : null

  useEffect(() => rove(box.current))

  // A link to a folder: expand it and its parents, then bring its row into view once they are rendered.
  useEffect(() => {
    if (!reveal) return
    const keys = reveal.path.map((_, i) => reveal.path.slice(0, i + 1).join('/'))
    setCollapsed(prev => new Set([...prev].filter(k => !keys.includes(k))))
    requestAnimationFrame(() => document.querySelector(`#files [data-path="${CSS.escape(keys[keys.length - 1])}"]`)?.scrollIntoView({ block: 'nearest' }))
  }, [reveal])

  const toggle = key =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div class="sidebar" ref={box}>
      {pinned.length > 0 && <section>
        <h2>Pinned</h2>
        <ul class="tree" role="tree" aria-label="Pinned" onKeyDown={onTreeKey}>
          {pinned.map(item => (
            <li key={item.id} role="none">
              <div class={`row${item.missing ? ' missing' : ''}`}>
                <button type="button" role="treeitem" class="row-main" title={item.name} onClick={() => onOpenPinned(item)}>
                  {item.kind === 'directory' ? <Folder size={14} class="kind" /> : <FileText size={14} class="kind" />}
                  <span class="row-name">{item.missing ? `${item.name} is gone` : item.name}</span>
                </button>
                <PinButton item={item} label="Unpin" onTogglePin={onTogglePin} />
              </div>
            </li>
          ))}
        </ul>
      </section>}
      {(folder || fs.canOpenFolders) && <section>
        <h2>
          <span class="row-name">{folder ? folder.name : 'Folder'}</span>
          {fs.canOpenFolders && (
            <button type="button" class="quiet small" onClick={onPickFolder}>
              {folder ? 'Change folder' : 'Open a folder'}
            </button>
          )}
        </h2>
        {folder && folder.tree.children.length > 0 && <Search folder={folder} onOpenFile={onOpenFile} query={query} setQuery={setQuery} />}
        {folder && !folder.tree.children.length && <p class="side-hint">No markdown files in {folder.name}.</p>}
        {folder && !query.trim() && <Tree node={folder.tree} root={folder.handle} path={[]} collapsed={collapsed} toggle={toggle} activePath={activePath} onOpenFile={onOpenFile} onTogglePin={onTogglePin} label={folder.name} />}
      </section>}
    </div>
  )
}

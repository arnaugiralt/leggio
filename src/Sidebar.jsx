import { useEffect, useState } from 'preact/hooks'
import * as fs from './fs.js'
import { FileText, Folder, FolderOpen } from './icons.jsx'

function PinButton({ item, label = 'Pin', onTogglePin }) {
  if (item.handle.copy) return null // a pin reopens its file after a reload, and a copy cannot be reopened
  return (
    <button type="button" class="pin" aria-label={`${label} ${item.name}`} onClick={() => onTogglePin(item)}>
      {label}
    </button>
  )
}

function Tree({ node, root, path, collapsed, toggle, activePath, onOpenFile, onTogglePin }) {
  return (
    <ul class="tree">
      {node.children.map(child => {
        const childPath = [...path, child.name]
        const key = childPath.join('/')
        if (child.kind === 'directory') {
          const open = !collapsed.has(key)
          return (
            <li key={key} data-path={key}>
              <div class="row">
                <button type="button" class="row-main" title={child.name} aria-expanded={open} onClick={() => toggle(key)}>
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
          <li key={key}>
            <div class={`row${active ? ' active' : ''}`}>
              <button type="button" class="row-main" title={child.name} aria-current={active ? 'page' : undefined} onClick={() => onOpenFile(child.handle, path, root)}>
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

// Pinned items and the open folder's markdown tree. Folders start expanded; collapse state is keyed by path.
export function Sidebar({ reveal, folder, pinned, current, onOpenFile, onOpenPinned, onPickFolder, onTogglePin }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
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
    <div class="sidebar">
      {pinned.length > 0 && <section>
        <h2>Pinned</h2>
        <ul class="tree">
          {pinned.map(item => (
            <li key={item.id}>
              <div class={`row${item.missing ? ' missing' : ''}`}>
                <button type="button" class="row-main" title={item.name} onClick={() => onOpenPinned(item)}>
                  {item.kind === 'directory' ? <Folder size={14} class="kind" /> : <FileText size={14} class="kind" />}
                  <span class="row-name">{item.missing ? `${item.name} is gone` : item.name}</span>
                </button>
                <PinButton item={item} label="Unpin" onTogglePin={onTogglePin} />
              </div>
            </li>
          ))}
        </ul>
      </section>}
      <section>
        <h2>
          <span class="row-name">{folder ? folder.name : 'Folder'}</span>
          <button type="button" class="quiet small" onClick={onPickFolder}>
            {folder ? 'Change folder' : 'Open a folder'}
          </button>
        </h2>
        {folder && !folder.tree.children.length && <p class="side-hint">No markdown files in {folder.name}.</p>}
        {folder && <Tree node={folder.tree} root={folder.handle} path={[]} collapsed={collapsed} toggle={toggle} activePath={activePath} onOpenFile={onOpenFile} onTogglePin={onTogglePin} />}
      </section>
    </div>
  )
}

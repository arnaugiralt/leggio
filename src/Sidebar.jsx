import { useState } from 'preact/hooks'
import * as fs from './fs.js'
import { FileText, Folder, FolderOpen } from './icons.jsx'

function PinButton({ item, label = 'Pin', onTogglePin }) {
  return (
    <button type="button" class="pin" onClick={() => onTogglePin(item)}>
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
            <li key={key}>
              <div class="row">
                <button type="button" class="row-main" aria-expanded={open} onClick={() => toggle(key)}>
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
              <button type="button" class="row-main" aria-current={active ? 'page' : undefined} onClick={() => onOpenFile(child.handle, path, root)}>
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
export function Sidebar({ folder, pinned, current, onOpenFile, onOpenPinned, onPickFolder, onTogglePin }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const activePath = current?.dirPath ? [...current.dirPath, current.name].join('/') : null

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
          {pinned.map((item, i) => (
            <li key={i}>
              <div class={`row${item.missing ? ' missing' : ''}`}>
                <button type="button" class="row-main" onClick={() => onOpenPinned(item, i)}>
                  {item.kind === 'directory' ? <Folder size={14} class="kind" /> : <FileText size={14} class="kind" />}
                  <span class="row-name">{item.name}</span>
                  {item.missing && <span class="row-note">missing</span>}
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
          {fs.supported && (
            <button type="button" class="quiet small" onClick={onPickFolder}>
              {folder ? 'Change folder' : 'Open a folder'}
            </button>
          )}
        </h2>
        {folder ? <Tree node={folder.tree} root={folder.handle} path={[]} collapsed={collapsed} toggle={toggle} activePath={activePath} onOpenFile={onOpenFile} onTogglePin={onTogglePin} /> : !fs.supported && <p class="side-hint">Folders need Chrome or Edge.</p>}
      </section>
    </div>
  )
}

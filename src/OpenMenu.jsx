import { useEffect, useRef, useState } from 'preact/hooks'

// The address field for "Open a link…": inline in the empty state and inside the Open menu, so it reads and
// behaves the same in both. onOpen returns true when the text was a link it handled (or explained).
export function LinkForm({ onOpen, onClose }) {
  const input = useRef()
  useEffect(() => input.current.focus(), [])
  return (
    <form
      class="link-form"
      onSubmit={e => {
        e.preventDefault()
        if (onOpen(input.current.value)) onClose()
      }}
    >
      <input
        ref={input}
        name="link"
        type="url"
        required
        placeholder="https://…"
        aria-label="Address of a markdown document"
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          e.stopPropagation() // Esc leaves the field, not the whole menu or the settings
          onClose()
        }}
        onBlur={e => !e.currentTarget.value && !e.relatedTarget?.closest('.link-form') && onClose()}
      />
      <button type="submit" class="quiet notice-action">
        Open
      </button>
    </form>
  )
}

// Everything that opens something else, in one popover: a file, a folder where the browser can open one, a
// link, and what was read recently. The bar's "Open" button and the narrow More menu both show it.
// control.current opens it on just the address field or just Recent, for the narrow More menu, which already
// lists the other actions.
export function OpenMenu({ id, keys, canFolders, onFile, onFolder, onLink, recent, onRecent, onForget, control }) {
  const [mode, setMode] = useState('all') // 'all' | 'link' | 'recent'
  const pop = useRef()
  const close = () => pop.current?.hidePopover()
  const show = m => (setMode(m), pop.current.showPopover())
  if (control) control.current = { showLink: () => show('link'), showRecent: () => show('recent') }
  return (
    <div
      id={id}
      ref={pop}
      class="open-pop"
      popover="auto"
      onToggle={e => {
        if (e.newState === 'open') pop.current.querySelector('input, button')?.focus()
        else setMode('all')
      }}
    >
      {mode === 'link' && <LinkForm onOpen={onLink} onClose={close} />}
      {mode === 'all' && (
        <>
          <button type="button" class="quiet menu-item" onClick={() => (close(), onFile())}>
            <span>Open a file…</span>
            <kbd>{keys.file}</kbd>
          </button>
          {canFolders && (
            <button type="button" class="quiet menu-item" onClick={() => (close(), onFolder())}>
              <span>Open a folder…</span>
              <kbd>{keys.folder}</kbd>
            </button>
          )}
          <button type="button" class="quiet menu-item" onClick={() => setMode('link')}>
            <span>Open a link…</span>
          </button>
        </>
      )}
      {mode !== 'link' && recent.length > 0 && (
        <>
          <p class="menu-heading">Recent</p>
          {recent.map(entry => (
            <button key={entry.key ?? entry.when} type="button" class="quiet menu-item" onClick={() => (close(), onRecent(entry))}>
              <span class="menu-name">{entry.name}</span>
              <span class="menu-meta">{recentWhere(entry)}</span>
            </button>
          ))}
          <button type="button" class="quiet menu-item menu-forget" onClick={() => (close(), onForget())}>
            Forget recent
          </button>
        </>
      )}
    </div>
  )
}

// Where a recent document comes from, in the menu's one muted line: its folder, its host, or "Shared".
export function recentWhere(entry) {
  if (entry.kind === 'web') return new URL(entry.url).host
  if (entry.kind === 'shared') return 'Shared'
  return entry.dirPath?.join(' / ') ?? ''
}

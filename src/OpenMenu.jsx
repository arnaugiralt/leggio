import { useEffect, useRef, useState } from 'preact/hooks'

// The address field for "Open a link…": inline in the empty state and inside the Open menu, so it reads and
// behaves the same in both. onOpen(text, { say }) is openLink: false when the text isn't a link, else a promise of
// whether the document opened. Until it has, the field keeps what was typed; a failure is said under the field,
// with how to fix it, and focus stays there.
// onBusy tells the page the field is waiting, so the notice slot doesn't say "Opening…" a second time; notify
// carries a failure that arrives after the field was closed (the menu dismissed while it waited).
export function LinkForm({ onOpen, onClose, onCancel, onBusy, notify }) {
  const input = useRef()
  const mounted = useRef(true)
  const [error, setError] = useState('')
  const [busy, setBusyState] = useState(false)
  const setBusy = b => (setBusyState(b), onBusy?.(b))
  useEffect(() => {
    input.current.focus()
    return () => {
      mounted.current = false
      onBusy?.(false)
    }
  }, [])
  const say = text => (mounted.current ? setError(text) : notify?.(text))
  async function submit(e) {
    e.preventDefault()
    setError('')
    const result = onOpen(input.current.value, { say })
    if (result === false) return setError('Enter an https address, like https://example.com/notes.md.')
    setBusy(true)
    const ok = await result
    if (!mounted.current) return
    setBusy(false)
    if (ok) onClose()
    else input.current?.focus()
  }
  return (
    <form class="link-form" onSubmit={submit}>
      <label class="link-label" for="link-field">Address of a markdown file</label>
      <div class="link-row">
        <input
          ref={input}
          id="link-field"
          name="link"
          type="url"
          required
          placeholder="https://…"
          aria-describedby={error ? 'link-error' : undefined}
          aria-invalid={error ? 'true' : undefined}
          onKeyDown={e => {
            if (e.key !== 'Escape') return
            e.stopPropagation() // Esc leaves the field, not the whole menu or the settings
            if (busy) onCancel?.()
            onClose()
          }}
          onBlur={e => !busy && !e.currentTarget.value && !e.relatedTarget?.closest('.link-form') && onClose()}
        />
        {busy ? (
          <button type="button" class="quiet notice-action" onClick={() => (onCancel?.(), setBusy(false), input.current.focus())}>
            Cancel
          </button>
        ) : (
          <button type="submit" class="quiet notice-action">
            Open
          </button>
        )}
      </div>
      {busy && <p class="link-status" role="status">Opening…</p>}
      {error && (
        <p id="link-error" class="link-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

// ↑↓, Home and End between a menu's items, as in the Files tree. Not inside the address field.
export function menuKeys(e) {
  if (e.target.closest('input') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  const items = [...e.currentTarget.querySelectorAll('button')].filter(b => b.offsetParent)
  const i = items.indexOf(document.activeElement)
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key]
  e.preventDefault()
  items[(to + items.length) % items.length]?.focus()
}

// Everything that opens something new, in one popover: a file, a folder where the browser can open one, and a
// link. What was read before lives in the Files panel, under Recent. control.current opens the popover on just
// the address field, for the narrow More menu, which already lists the other actions.
export function OpenMenu({ id, keys, canFolders, onFile, onFolder, onLink, onCancelLink, onLinkBusy, notify, control }) {
  const [mode, setMode] = useState('all') // 'all' | 'link'
  const pop = useRef()
  const close = () => pop.current?.hidePopover()
  const show = m => (setMode(m), pop.current.showPopover())
  if (control) control.current = { showLink: () => show('link') }
  return (
    <div
      id={id}
      ref={pop}
      class="open-pop"
      popover="auto"
      onKeyDown={menuKeys}
      onToggle={e => {
        if (e.newState === 'open') pop.current.querySelector('input, button')?.focus()
        else setMode('all')
      }}
    >
      {mode === 'link' && <LinkForm onOpen={onLink} onClose={close} onCancel={onCancelLink} onBusy={onLinkBusy} notify={notify} />}
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
    </div>
  )
}

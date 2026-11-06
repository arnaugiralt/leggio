import { useEffect, useRef } from 'preact/hooks'
import { X } from './icons.jsx'

// The keyboard shortcuts, on ? or from Settings. Shortcuts were only listed on the empty screen, which readers
// rarely see once they use the app. <dialog> gives the top layer, focus containment and Esc.
export function Shortcuts({ keys, canFolders, onClose }) {
  const ref = useRef()
  useEffect(() => ref.current.showModal(), [])
  const rows = [
    [keys.file, 'Open a file'],
    ...(canFolders ? [[keys.folder, 'Open a folder']] : []),
    [keys.files, 'Show or hide the Files panel'],
    [`${keys.search}  or  /`, 'Search the open folder'],
    [keys.history, 'Back and Forward'],
    ['↑ ↓ ← →', 'Move through the Files panel; P pins'],
    ['Esc', 'Close a panel, or stop reading aloud'],
    ['?', 'This list'],
  ]
  return (
    <dialog ref={ref} class="shortcuts" aria-labelledby="shortcuts-title" onClose={onClose} onClick={e => e.target === ref.current && ref.current.close()}>
      <div class="shortcuts-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" class="quiet" aria-label="Close" onClick={() => ref.current.close()}>
          <X size="1.1em" />
        </button>
      </div>
      <dl>
        {rows.map(([keys, what]) => (
          <div key={what}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  )
}

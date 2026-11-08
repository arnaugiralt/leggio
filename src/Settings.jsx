import { useEffect, useRef, useState } from 'preact/hooks'
import { DEFAULTS, DIAGRAM_THEMES, PRESETS, DARK, LOOK, themeLabel, themeLook, fontName, fontOptions, matchesPreset, effective, exportSettings, readSettingsFile } from './settings.js'
import * as speech from './speech.js'

// Everything a theme keeps, under "Customize theme": what "Save this look" saves.
const CUSTOMIZE = [
  {
    title: 'Colors',
    fields: [
      { key: 'bg', label: 'Background', type: 'color' },
      { key: 'fg', label: 'Text', type: 'color' },
      { key: 'accent', label: 'Accent', type: 'color' },
      { key: 'codeBg', label: 'Code background', type: 'color' },
      { key: 'diagramTheme', label: 'Diagrams and code', type: 'select' },
    ],
  },
  {
    title: 'Fonts',
    fields: [
      { key: 'textFont', label: 'Text', type: 'font', role: 'text' },
      { key: 'codeFont', label: 'Code', type: 'font', role: 'code' },
      { key: 'uiFont', label: 'Interface', type: 'font', role: 'ui' },
      { key: 'fontWeight', label: 'Weight', type: 'number', step: 100, min: 100, max: 900 },
      { key: 'lineHeight', label: 'Line height', type: 'number', step: 0.05, min: 1, max: 2.5 },
      { key: 'codeFontSize', label: 'Code size', type: 'number', unit: 'px', step: 1, min: 8, max: 32 },
    ],
  },
  {
    title: 'Width',
    fields: [
      { key: 'contentWidth', label: 'Text', type: 'number', unit: 'px', step: 10, min: 400, max: 1400 },
      { key: 'wideWidth', label: 'Tables and diagrams', type: 'number', unit: 'px', step: 50, min: 400, max: 2400 },
    ],
  },
]

const READING = [
  { key: 'voice', label: 'Voice', type: 'select', hint: 'Online voices sound better. They send the text to the voice service and need a connection; without one, a local voice reads instead.' },
  { key: 'speechRate', label: 'Speed', type: 'number', unit: '×', step: 0.05, min: 0.5, max: 2 },
]

const TEXT_SIZE = { min: 10, max: 40 }

const FONT_URL = {
  key: 'fontUrl',
  label: 'Google Fonts link',
  type: 'url',
  placeholder: 'https://fonts.googleapis.com/css2?family=…',
  hint: 'Every family in the link is offered to the three fonts above. Ask for 400 and 600; bold text and headings use 600.',
}

const FONT_URL_PREFIX = 'https://fonts.googleapis.com/'
const FONT_URL_ERROR = 'Use a link that starts with https://fonts.googleapis.com/css2'

// Numbers commit on Enter, on blur and on the stepper arrows, so "18" never passes through 1px.
// The URL applies as it is typed, but only once it is valid. Until then the text is a draft
// here, and the settings keep the last good value.
function Field({ field, value, options, onInput }) {
  const { key, label, type, hint, role, unit, ...attrs } = field
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => setDraft(null), [value]) // an outside change (preset, reset, undo) wins over a stale draft
  const commit = input => {
    setDraft(null)
    onInput(key, type, input)
  }
  const onNumberInput = e => {
    // Typing is an InputEvent; the stepper arrows and ArrowUp/Down fire a plain Event.
    if (e instanceof InputEvent) setDraft(e.currentTarget.value)
    else commit(e.currentTarget)
  }
  const onUrlInput = e => {
    const input = e.currentTarget
    const ok = !input.value || input.value.startsWith(FONT_URL_PREFIX)
    setError(!ok)
    if (ok) onInput(key, type, input)
    else setDraft(input.value)
  }
  // options: [value, text] pairs, or [group label, [[value, text], …]] for an optgroup.
  const control =
    type === 'font' || type === 'select' ? (
      <select value={value} onChange={e => onInput(key, type, e.currentTarget)}>
        {options.map(([option, text]) =>
          Array.isArray(text) ? (
            <optgroup key={option} label={option}>
              {text.map(([o, t]) => <option key={o} value={o}>{t}</option>)}
            </optgroup>
          ) : (
            <option key={option} value={option}>{text}</option>
          ),
        )}
      </select>
    ) : type === 'number' ? (
      <span class="field-input">
        <input
          type={type}
          {...attrs}
          value={draft ?? value}
          onInput={onNumberInput}
          onBlur={e => commit(e.currentTarget)}
          onKeyDown={e => e.key === 'Enter' && commit(e.currentTarget)}
        />
        <span class="unit">{unit}</span>
      </span>
    ) : type === 'url' ? (
      <input type={type} {...attrs} value={draft ?? value} aria-invalid={error} onInput={onUrlInput} />
    ) : (
      <input type={type} {...attrs} value={value} onInput={e => onInput(key, type, e.currentTarget)} />
    )
  return (
    <label class={`field field-${type}`}>
      <span class="field-label">{label}</span>
      {control}
      {hint && <span class="field-hint">{hint}</span>}
      {error && <span class="field-hint field-error" role="alert">{FONT_URL_ERROR}</span>}
    </label>
  )
}

const THEME_OPTIONS = DIAGRAM_THEMES.map(name => [name, themeLabel(name)])

// A swatch is a miniature of the page it paints: its own background, "Aa" in its
// text color, a rule in its accent. The active one is derived by comparing values,
// so tweaking any control afterwards simply deselects — there is no stored theme.
const GOOGLE_PRESETS = PRESETS.filter(p => p.fontUrl).map(p => p.name)
const GOOGLE_NOTE = `${GOOGLE_PRESETS.slice(0, -1).join(', ')} and ${GOOGLE_PRESETS.at(-1)} load their fonts from Google Fonts.`

const lookNow = settings => Object.fromEntries(LOOK.map(k => [k, settings[k]]))

function Card({ name, look, pressed, onPick, note, saved }) {
  return (
    <button type="button" class="theme" data-saved={saved} aria-pressed={pressed} style={`background:${look.bg};color:${look.fg}`} onClick={onPick}>
      <span class="theme-sample">Aa</span>
      <span class="theme-accent" style={`background:${look.accent}`} />
      <span class="theme-name">{name}</span>
      {note}
    </button>
  )
}

// A name field for saving or renaming a theme; Enter keeps, Esc leaves it as it was.
function NameField({ value, onDone }) {
  const input = useRef()
  const done = useRef(false) // Esc removes the field, and the blur that follows must not save after all
  const finish = name => {
    if (done.current) return
    done.current = true
    onDone(name)
  }
  useEffect(() => input.current.select(), [])
  return (
    <span class="theme-name-field">
      <input
        ref={input}
        defaultValue={value}
        maxLength={60}
        aria-label="Theme name"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(e.currentTarget.value.trim() || value)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            finish(null)
          }
        }}
        onBlur={e => finish(e.currentTarget.value.trim() || value)}
      />
    </span>
  )
}

function Themes({ settings, onChange, dark, themes, onThemes, picked, matchesAny }) {
  const [naming, setNaming] = useState(null) // 'new' | index of the theme being renamed
  const [removed, setRemoved] = useState(null) // { theme, index }, for Undo
  const [focusNext, setFocusNext] = useState(null) // a saved theme's name, or 'undo': where focus goes after a change
  const box = useRef()
  // Saving, renaming, deleting and Undo each replace the control that had focus; focus goes to what it acted on.
  useEffect(() => {
    if (!focusNext) return
    const target = focusNext === 'undo' ? box.current?.querySelector('.theme-undo') : [...(box.current?.querySelectorAll('.theme[data-saved]') ?? [])].find(b => b.dataset.saved === focusNext)
    target?.focus()
    setFocusNext(null)
  }, [focusNext, themes, removed])
  // The offer to undo a delete lasts until the look changes: after that, putting it back would surprise.
  useEffect(() => setRemoved(null), [settings.bg, settings.fg, settings.accent, settings.codeBg, settings.textFont])
  const freeName = () => {
    for (let n = themes.length + 1; ; n++) if (!themes.some(t => t.name === `My theme ${n}`)) return `My theme ${n}`
  }
  function save(name) {
    setNaming(null)
    if (name) {
      onThemes([...themes, { name, ...lookNow(settings) }])
      setFocusNext(name)
    }
  }
  function rename(i, name) {
    setNaming(null)
    if (name) onThemes(themes.map((t, j) => (j === i ? { ...t, name } : t)))
    setFocusNext(name ?? themes[i].name)
  }
  function remove(i) {
    setRemoved({ theme: themes[i], index: i })
    onThemes(themes.filter((_, j) => j !== i))
    setFocusNext('undo')
  }
  function undoRemove() {
    const at = Math.min(removed.index, themes.length)
    onThemes([...themes.slice(0, at), removed.theme, ...themes.slice(at)])
    setFocusNext(removed.theme.name)
    setRemoved(null)
  }
  return (
    <fieldset ref={box}>
      <legend>Theme</legend>
      <div class="themes">
        {PRESETS.map(({ name, ...look }) => {
          const follows = name === 'Default' && settings.followSystem
          return <Card key={name} name={name} look={follows && dark ? { ...look, ...DARK } : look} pressed={name === 'Default' ? settings.followSystem : matchesPreset(settings, look)} onPick={() => onChange(look)} />
        })}
      </div>
      {/* Under the grid, not in the card: an extra line in one card made its row taller than the rest. */}
      {settings.followSystem && <p class="field-hint themes-note">Default follows your system's light or dark mode.</p>}
      {(themes.length > 0 || !matchesAny) && (
        <>
          <p class="themes-heading">Your themes</p>
          <div class="themes">
            {themes.map((t, i) =>
              naming === i ? (
                <div key={i} class="theme theme-editing" style={`background:${themeLook(t, settings).bg};color:${themeLook(t, settings).fg}`}>
                  <span class="theme-sample">Aa</span>
                  <NameField value={t.name} onDone={name => rename(i, name)} />
                </div>
              ) : (
                <Card key={i} name={t.name} saved={t.name} look={themeLook(t, settings)} pressed={i === picked} onPick={() => onChange(themeLook(t, settings))} />
              ),
            )}
            {/* Saving is offered only while the look on screen is one nobody has kept yet. */}
            {!matchesAny &&
              (naming === 'new' ? (
                <div class="theme theme-editing" style={`background:${settings.bg};color:${settings.fg}`}>
                  <span class="theme-sample">Aa</span>
                  <NameField value={freeName()} onDone={save} />
                </div>
              ) : (
                <button type="button" class="theme theme-save" onClick={() => setNaming('new')}>
                  <span class="theme-sample">+</span>
                  <span class="theme-name">Save this look</span>
                </button>
              ))}
          </div>
          {picked >= 0 && naming === null && (
            <p class="theme-actions">
              <span>{themes[picked].name}</span>
              <button type="button" class="quiet" onClick={() => setNaming(picked)}>Rename</button>
              <button type="button" class="quiet" onClick={() => remove(picked)}>Delete</button>
            </p>
          )}
          {removed && (
            <p class="reset-row" role="status">
              Deleted {removed.theme.name}.
              <button type="button" class="quiet theme-undo" onClick={undoRemove}>Undo</button>
            </p>
          )}
        </>
      )}
      <p class="field-hint themes-note">{GOOGLE_NOTE}</p>
    </fieldset>
  )
}

// Export as a file the browser saves; import from a file the reader picks. Both are the reader's own action.
function Backup({ settings, themes, onImport }) {
  const [said, setSaid] = useState('')
  const [undo, setUndo] = useState(null) // puts back what an import replaced
  const input = useRef()
  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSettings(settings, themes), null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'leggio-settings.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    setUndo(null)
    setSaid('Settings exported.')
  }
  async function importFile(file) {
    try {
      if (file.size > 1_000_000) throw new Error('This file is too large to be Leggio settings.') // before reading it
      const read = readSettingsFile(await file.text())
      const { added, undo } = onImport(read)
      setUndo(() => undo)
      setSaid(`Settings imported.${added ? ` ${added === 1 ? '1 new theme' : `${added} new themes`} in Your themes.` : ''}`)
    } catch (err) {
      setUndo(null)
      setSaid(err.message.startsWith('This file') ? err.message : "This file couldn't be read.")
    }
  }
  return (
    <>
      <div class="backup">
        <button type="button" class="quiet action" onClick={exportFile}>Export settings</button>
        <button type="button" class="quiet action" onClick={() => input.current.click()}>Import settings…</button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={e => {
            const file = e.currentTarget.files[0]
            e.currentTarget.value = ''
            if (file) importFile(file)
          }}
        />
      </div>
      {said && (
        <p class="reset-row" role="status">
          {said}
          {undo && (
            <button type="button" class="quiet" onClick={() => (undo(), setUndo(null), setSaid('Import undone.'))}>
              Undo
            </button>
          )}
        </p>
      )}
    </>
  )
}

// The one setting people change most, as two buttons: no field to click into first. aria-disabled, not
// disabled, at the ends: a disabled button would drop the focus it holds.
function TextSize({ value, onChange }) {
  const step = by => {
    const next = Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, value + by))
    if (next !== value) onChange({ fontSize: next })
  }
  return (
    <div class="field text-size" role="group" aria-labelledby="text-size-label">
      <span id="text-size-label" class="field-label">Text size</span>
      <span class="stepper">
        <button type="button" class="quiet action" aria-label="Smaller text" aria-disabled={value <= TEXT_SIZE.min} onClick={() => step(-1)}>−</button>
        <output aria-live="polite">{value} px</output>
        <button type="button" class="quiet action" aria-label="Larger text" aria-disabled={value >= TEXT_SIZE.max} onClick={() => step(1)}>+</button>
      </span>
    </div>
  )
}

export function Settings({ settings, onChange, open, dark, themes, onThemes, onImport, onShortcuts }) {
  const [undo, setUndo] = useState(null) // the settings a reset replaced
  // getVoices() is empty until the list loads, and Chrome refills it when the network voices arrive.
  const [voices, setVoices] = useState(speech.voices)
  useEffect(() => {
    if (!speech.supported) return
    const update = () => setVoices(speech.voices())
    update() // voiceschanged fires once, and often before this effect runs
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const { mine, other } = speech.pickerVoices(voices, navigator.language, settings.voice)
  const voiceItem = v => [v.name, v.localService ? v.name : `${v.name} (online)`]
  const voiceOptions = [...mine.map(voiceItem), ...(other.length ? [['Other languages', other.map(voiceItem)]] : [])]

  // The undo offer lives only while the settings still equal the defaults it produced and the sheet is open.
  const atDefaults = Object.entries(effective(DEFAULTS, dark)).every(([k, v]) => settings[k] === v)
  useEffect(() => {
    if (undo && (!open || !atDefaults)) setUndo(null)
  }, [undo, open, atDefaults])

  function reset() {
    setUndo(settings)
    onChange({ ...DEFAULTS })
  }

  const optionsFor = field =>
    field.type === 'font'
      ? fontOptions(settings, field.role)
      : field.key === 'voice'
        ? [['', 'Browser default'], ...voiceOptions]
        : THEME_OPTIONS

  function update(key, type, input) {
    if (type === 'number') {
      const value = input.valueAsNumber
      if (Number.isNaN(value)) return
      onChange({ [key]: Math.min(+input.max, Math.max(+input.min, value)) })
    } else {
      onChange({ [key]: input.value })
    }
  }

  // A theme is picked when the look on screen equals it; Default also while the look follows the system.
  const picked = themes.findIndex(t => matchesPreset(settings, themeLook(t, settings)))
  const matchesAny = PRESETS.some(({ name, ...look }) => (name === 'Default' ? settings.followSystem : matchesPreset(settings, look))) || picked >= 0
  // Closed while a theme is picked; open when the sheet opens on a look nobody has kept, which is a theme being made.
  const [customOpen, setCustomOpen] = useState(!matchesAny)
  useEffect(() => {
    if (open) setCustomOpen(!matchesAny)
  }, [open])

  const field = f => (
    <Field
      key={f.key}
      field={f}
      value={f.type === 'font' ? fontName(settings, f.role) : settings[f.key]}
      options={optionsFor(f)}
      onInput={update}
    />
  )

  return (
    <form class="settings" onSubmit={e => e.preventDefault()}>
      <TextSize value={settings.fontSize} onChange={onChange} />
      <Themes settings={settings} onChange={onChange} dark={dark} themes={themes} onThemes={onThemes} picked={picked} matchesAny={matchesAny} />
      <details class="customize" open={customOpen} onToggle={e => setCustomOpen(e.currentTarget.open)}>
        <summary>Customize theme</summary>
        {CUSTOMIZE.map(group => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.fields.map(field)}
            {group.title === 'Fonts' && (
              <details class="google-fonts" open={!!settings.fontUrl}>
                <summary>Google Fonts</summary>
                <Field field={FONT_URL} value={settings.fontUrl} onInput={update} />
              </details>
            )}
          </fieldset>
        ))}
      </details>
      <fieldset>
        <legend>Reading aloud</legend>
        {READING.map(field)}
      </fieldset>
      <div class="settings-foot">
        <Backup settings={settings} themes={themes} onImport={onImport} />
        <div class="foot-row">
          {onShortcuts && (
            <button type="button" class="quiet shortcuts-link" onClick={onShortcuts}>
              Keyboard shortcuts <kbd>?</kbd>
            </button>
          )}
          <button type="button" class="quiet reset" onClick={reset}>Reset to defaults</button>
        </div>
        {undo && atDefaults && (
          <p class="reset-row" role="status">
            Settings reset.
            <button type="button" class="quiet" onClick={() => { onChange(undo); setUndo(null) }}>Undo</button>
          </p>
        )}
      </div>
    </form>
  )
}

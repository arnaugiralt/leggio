import { useEffect, useState } from 'preact/hooks'
import { DEFAULTS, DIAGRAM_THEMES, PRESETS, themeLabel, fontName, fontOptions, matchesPreset } from './settings.js'
import * as speech from './speech.js'

const GROUPS = [
  {
    title: 'Type',
    fields: [
      { key: 'textFont', label: 'Text', type: 'font', role: 'text' },
      { key: 'codeFont', label: 'Code', type: 'font', role: 'code' },
      {
        key: 'uiFont',
        label: 'Interface',
        type: 'font',
        role: 'ui',
        hint: 'The sidebar, bar and this sheet. A system font needs no download and stays sharp at small sizes.',
      },
      { key: 'fontSize', label: 'Size', type: 'number', unit: 'px', step: 1, min: 10, max: 40 },
      { key: 'fontWeight', label: 'Weight', type: 'number', step: 100, min: 100, max: 900 },
      { key: 'lineHeight', label: 'Line height', type: 'number', step: 0.05, min: 1, max: 2.5 },
    ],
  },
  {
    title: 'Layout',
    fields: [
      { key: 'contentWidth', label: 'Text width', type: 'number', unit: 'px', step: 10, min: 400, max: 1400 },
      { key: 'wideWidth', label: 'Wide elements', type: 'number', unit: 'px', step: 50, min: 400, max: 2400, hint: 'Tables and diagrams may grow past the text column up to this width.' },
    ],
  },
  {
    title: 'Code',
    fields: [
      { key: 'codeFontSize', label: 'Size', type: 'number', unit: 'px', step: 1, min: 8, max: 32 },
      { key: 'codeBg', label: 'Background', type: 'color' },
    ],
  },
  {
    title: 'Colors',
    fields: [
      { key: 'bg', label: 'Page', type: 'color' },
      { key: 'fg', label: 'Text', type: 'color' },
      { key: 'accent', label: 'Accent', type: 'color' },
    ],
  },
  {
    title: 'Reading aloud',
    fields: [
      { key: 'voice', label: 'Voice', type: 'select', hint: 'Online voices sound better. They send the text to the voice service and need a connection; without one, a local voice reads instead.' },
      { key: 'speechRate', label: 'Rate', type: 'number', step: 0.05, min: 0.5, max: 2 },
    ],
  },
  {
    title: 'Diagram and code colors',
    fields: [{ key: 'diagramTheme', label: 'Palette', type: 'select', hint: 'Applies to both Mermaid diagrams and code blocks.' }],
  },
]

const FONT_URL = {
        key: 'fontUrl',
        label: 'Google Fonts URL',
        type: 'url',
        placeholder: 'https://fonts.googleapis.com/css2?family=…',
        hint: 'Every family in the URL is offered to the three roles below. Ask for 400 and 600; bold text and headings use 600.',
      }

function Field({ field, value, options, onInput }) {
  const { key, label, type, hint, role, unit, ...attrs } = field
  const control =
    type === 'font' ? (
      <select value={value} onChange={e => onInput(key, type, e.currentTarget)}>
        {options.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map(([option, text]) => (
              <option key={option} value={option}>{text}</option>
            ))}
          </optgroup>
        ))}
      </select>
    ) : type === 'select' ? (
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
        <input type={type} {...attrs} value={value} onInput={e => onInput(key, type, e.currentTarget)} />
        <span class="unit">{unit}</span>
      </span>
    ) : (
      <input type={type} {...attrs} value={value} onInput={e => onInput(key, type, e.currentTarget)} />
    )
  return (
    <label class={`field field-${type}`}>
      <span class="field-label">{label}</span>
      {control}
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  )
}

const THEME_OPTIONS = DIAGRAM_THEMES.map(name => [name, themeLabel(name)])

// A swatch is a miniature of the page it paints: its own background, "Aa" in its
// text color, a rule in its accent. The active one is derived by comparing values,
// so tweaking any control afterwards simply deselects — there is no stored theme.
function Themes({ settings, onChange }) {
  return (
    <fieldset>
      <legend>Theme</legend>
      <div class="themes">
        {PRESETS.map(({ name, ...look }) => (
          <button
            key={name}
            type="button"
            class="theme"
            aria-pressed={matchesPreset(settings, look)}
            style={`background:${look.bg};color:${look.fg}`}
            onClick={() => onChange(look)}
          >
            <span class="theme-sample">Aa</span>
            <span class="theme-accent" style={`background:${look.accent}`} />
            <span class="theme-name">{name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Settings({ settings, onChange, open }) {
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
  const atDefaults = Object.keys(DEFAULTS).every(k => settings[k] === DEFAULTS[k])
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
      onChange({ [key]: value })
    } else {
      onChange({ [key]: input.value })
    }
  }

  return (
    <form class="settings" onSubmit={e => e.preventDefault()}>
      <Themes settings={settings} onChange={onChange} />
      {GROUPS.map(group => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.fields.map(field => (
            <Field
              key={field.key}
              field={field}
              value={field.type === 'font' ? fontName(settings, field.role) : settings[field.key]}
              options={optionsFor(field)}
              onInput={update}
            />
          ))}
          {group.title === 'Type' && (
            <details open={!!settings.fontUrl}>
              <summary>Custom fonts</summary>
              <Field field={FONT_URL} value={settings.fontUrl} onInput={update} />
            </details>
          )}
        </fieldset>
      ))}
      <button type="button" class="quiet reset" onClick={reset}>Reset to defaults</button>
      {undo && atDefaults && (
        <p class="reset-row" role="status">
          Settings reset.
          <button type="button" class="quiet" onClick={() => { onChange(undo); setUndo(null) }}>Undo</button>
        </p>
      )}
    </form>
  )
}

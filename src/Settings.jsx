import { useEffect, useState } from 'preact/hooks'
import { DIAGRAM_THEMES, LOOK, PRESETS, fontName, fontOptions } from './settings.js'
import * as speech from './speech.js'

const GROUPS = [
  {
    title: 'Type',
    fields: [
      {
        key: 'fontUrl',
        label: 'Google Fonts URL',
        type: 'url',
        placeholder: 'https://fonts.googleapis.com/css2?family=…',
        hint: 'Every family in the URL is offered to the three roles below. Ask for 400 and 600; bold text and headings use 600.',
      },
      { key: 'textFont', label: 'Text', type: 'font', role: 'text' },
      { key: 'codeFont', label: 'Code', type: 'font', role: 'code' },
      {
        key: 'uiFont',
        label: 'Interface',
        type: 'font',
        role: 'ui',
        hint: 'The sidebar, bar and this sheet. Leave empty for the system font, which needs no download and stays sharp at small sizes.',
      },
      { key: 'fontSize', label: 'Size', type: 'number', step: 1, min: 10, max: 40 },
      { key: 'fontWeight', label: 'Weight', type: 'number', step: 100, min: 100, max: 900 },
      { key: 'lineHeight', label: 'Line height', type: 'number', step: 0.05, min: 1, max: 2.5 },
    ],
  },
  {
    title: 'Layout',
    fields: [
      { key: 'contentWidth', label: 'Text width', type: 'number', step: 10, min: 400, max: 1400 },
      { key: 'wideWidth', label: 'Wide elements', type: 'number', step: 50, min: 400, max: 2400, hint: 'Tables and diagrams may grow past the text column up to this width.' },
    ],
  },
  {
    title: 'Code',
    fields: [
      { key: 'codeFontSize', label: 'Size', type: 'number', step: 1, min: 8, max: 32 },
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
      { key: 'voice', label: 'Voice', type: 'select', hint: 'Online voices sound better and need a connection. Without one, the reader falls back to a local voice.' },
      { key: 'speechRate', label: 'Rate', type: 'number', step: 0.05, min: 0.5, max: 2 },
    ],
  },
  {
    title: 'Diagrams and code',
    fields: [{ key: 'diagramTheme', label: 'Theme', type: 'select', hint: 'Applies to both mermaid diagrams and code blocks.' }],
  },
]

function Field({ field, value, options, onInput }) {
  const { key, label, type, hint, role, ...attrs } = field
  const control =
    type === 'font' ? (
      // Free text with a datalist rather than a select: the url says what is available,
      // but a family installed on the machine is just as valid and can be typed in.
      <>
        <input type="text" list={`fonts-${key}`} placeholder="System" value={value} onInput={e => onInput(key, type, e.currentTarget)} />
        <datalist id={`fonts-${key}`}>
          {options.map(name => <option key={name} value={name} />)}
        </datalist>
      </>
    ) : type === 'select' ? (
      <select value={value} onChange={e => onInput(key, type, e.currentTarget)}>
        {options.map(([option, text]) => (
          <option key={option} value={option}>{text}</option>
        ))}
      </select>
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

const THEME_OPTIONS = DIAGRAM_THEMES.map(name => [name, name === 'page' ? 'Follow page colors' : name])

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
            aria-pressed={LOOK.every(key => settings[key] === look[key])}
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

export function Settings({ settings, onChange, onReset }) {
  // getVoices() is empty until the list loads, and Chrome refills it when the network voices arrive.
  const [voices, setVoices] = useState(speech.voices)
  useEffect(() => {
    if (!speech.supported) return
    const update = () => setVoices(speech.voices())
    update() // voiceschanged fires once, and often before this effect runs
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const optionsFor = field =>
    field.type === 'font'
      ? fontOptions(settings, field.role)
      : field.key === 'voice'
        ? [['', 'Browser default'], ...voices.map(v => [v.name, v.localService ? v.name : `${v.name} (online)`])]
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
        </fieldset>
      ))}
      <button type="button" class="quiet reset" onClick={onReset}>Reset to defaults</button>
    </form>
  )
}

import { DIAGRAM_THEMES } from './settings.js'

const GROUPS = [
  {
    title: 'Type',
    fields: [
      {
        key: 'fontUrl',
        label: 'Google Fonts URL',
        type: 'url',
        placeholder: 'https://fonts.googleapis.com/css2?family=…',
        hint: 'First family is used for text, second for code. Include the weights you want.',
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
    title: 'Diagrams and code',
    fields: [{ key: 'diagramTheme', label: 'Theme', type: 'select', hint: 'Applies to both mermaid diagrams and code blocks.' }],
  },
]

function Field({ field, value, onInput }) {
  const { key, label, type, hint, ...attrs } = field
  const control =
    type === 'select' ? (
      <select value={value} onChange={e => onInput(key, type, e.currentTarget)}>
        {DIAGRAM_THEMES.map(name => (
          <option key={name} value={name}>{name === 'page' ? 'Follow page colors' : name}</option>
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

export function Settings({ settings, onChange, onReset }) {
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
      {GROUPS.map(group => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.fields.map(field => (
            <Field key={field.key} field={field} value={settings[field.key]} onInput={update} />
          ))}
        </fieldset>
      ))}
      <button type="button" class="quiet reset" onClick={onReset}>Reset to defaults</button>
    </form>
  )
}

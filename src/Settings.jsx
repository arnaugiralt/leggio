// [key, label, input type, step, min, max]
const FIELDS = [
  ['fontUrl', 'Google Fonts URL (first family is text, second is code)', 'url'],
  ['fontSize', 'Font size (px)', 'number', 1],
  ['fontWeight', 'Font weight (must be included in the font URL)', 'number', 100, 100, 900],
  ['lineHeight', 'Line height', 'number', 0.05],
  ['contentWidth', 'Content width (px)', 'number', 10],
  ['codeFontSize', 'Code font size (px)', 'number', 1],
  ['bg', 'Background', 'color'],
  ['fg', 'Text', 'color'],
  ['accent', 'Accent', 'color'],
  ['codeBg', 'Code background', 'color'],
]

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
      {FIELDS.map(([key, label, type, step, min, max]) => (
        <label key={key}>
          <span>{label}</span>
          <input type={type} step={step} min={min} max={max} value={settings[key]} onInput={e => update(key, type, e.currentTarget)} />
        </label>
      ))}
      <button type="button" onClick={onReset}>Reset to defaults</button>
    </form>
  )
}

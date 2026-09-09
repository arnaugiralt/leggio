// [key, label, input type, step]
const FIELDS = [
  ['fontFamily', 'Font family', 'text'],
  ['fontUrl', 'Google Fonts stylesheet URL', 'url'],
  ['fontSize', 'Font size (px)', 'number', 1],
  ['lineHeight', 'Line height', 'number', 0.05],
  ['contentWidth', 'Content width (px)', 'number', 10],
  ['codeFontFamily', 'Code font family', 'text'],
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
      onChange({ ...settings, [key]: value })
    } else {
      onChange({ ...settings, [key]: input.value })
    }
  }

  return (
    <form class="settings" onSubmit={e => e.preventDefault()}>
      {FIELDS.map(([key, label, type, step]) => (
        <label key={key}>
          <span>{label}</span>
          <input type={type} step={step} value={settings[key]} onInput={e => update(key, type, e.currentTarget)} />
        </label>
      ))}
      <button type="button" onClick={onReset}>Reset to defaults</button>
    </form>
  )
}

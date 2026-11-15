// Runs inside the preview webview, on every render. Plain script, not bundled.
const isDark = () => {
  const c = document.body.classList
  return c.contains('vscode-dark') || (c.contains('vscode-high-contrast') && !c.contains('vscode-high-contrast-light'))
}

function apply() {
  const style = document.body.style
  // classList.add rewrites the attribute even when nothing changes, which would wake the observer below forever.
  for (const name of ['leggio', 'prose']) if (!document.body.classList.contains(name)) document.body.classList.add(name)
  const el = document.getElementById('leggio-look')
  if (!el) return
  const vars = JSON.parse(el.dataset[isDark() ? 'dark' : 'light'])
  // A look that leaves a variable unset (diagram line and muted under "page") must not keep the previous one.
  for (const name of [...style]) if (name.startsWith('--') && !(name in vars)) style.removeProperty(name)
  for (const [name, value] of Object.entries(vars)) style.setProperty(name, value)
  const bg = parseInt(vars['--color-bg'].slice(1), 16)
  const luma = 0.2126 * (bg >> 16) + 0.7152 * ((bg >> 8) & 255) + 0.0722 * (bg & 255)
  style.setProperty('color-scheme', luma < 128 ? 'dark' : 'light')
  let link = document.getElementById('leggio-font')
  const url = el.dataset.fontUrl
  if (!url) return link?.remove()
  if (!link) {
    link = document.createElement('link')
    link.id = 'leggio-font'
    link.rel = 'stylesheet'
    document.head.append(link)
  }
  if (link.getAttribute('href') !== url) link.href = url
}

apply()
window.addEventListener('vscode.markdown.updateContent', apply)
// childList: VS Code appends the first render to <body> on DOMContentLoaded with no updateContent event, and this async script
// can run before that. A settings change reloads the whole preview, so it is a first render too.
new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true })

import { render } from 'preact'
import { App } from './App.jsx'
import './styles.css'

render(<App />, document.getElementById('app'))

// Here, not inline in index.html: the content security policy allows no inline scripts. Relative path, so the
// scope follows wherever the app is served from.
navigator.serviceWorker?.register('sw.js')

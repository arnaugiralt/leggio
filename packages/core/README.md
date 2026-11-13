# @leggio/core

The markdown renderer and reading look from [Leggio](https://github.com/arnaugiralt/leggio), a read-only markdown reader. It turns markdown into safe HTML, and it has the styles and the theme helpers to make that HTML look the way Leggio does. It works as a markdown-it plugin, or on its own with `render`.

## Install

```sh
pnpm add @leggio/core
```

## Use

Render a string, add the styles, and apply a look to the element that holds the text:

```js
import { render, applyLook, LOOK_DEFAULTS } from '@leggio/core'
import '@leggio/core/prose.css'

const el = document.querySelector('.leggio')
applyLook(LOOK_DEFAULTS, el)
el.innerHTML = `<div class="prose">${render('# Hello')}</div>`
```

Add the plugin to your own markdown-it instance:

```js
import MarkdownIt from 'markdown-it'
import { leggio } from '@leggio/core'

const md = new MarkdownIt().use(leggio, { footnotes: false, webImages: 'defer' })
const html = md.render('# Hello', { localImages: 'keep' }) // the render env overrides the image options
```

Options: `headingIds`, `taskLists`, `footnotes` and `diagrams` (all on by default), `localImages` (`'defer'` or `'keep'`) and `webImages` (`'load'` or `'defer'`).

Get the look as CSS, for a host with no DOM:

```js
import { lookCss, LOOK_DEFAULTS } from '@leggio/core'

const css = lookCss(LOOK_DEFAULTS, '.leggio') // a stylesheet string
```

## Size container

`prose.css` does not set `container-type`, because only your page knows which element is wide enough. Tables and diagrams use `cqw` units to grow past the text column, up to `--wide-width`. Set `container-type: inline-size` on the `.leggio` element, or on a wider ancestor. Without a container, `cqw` falls back to the viewport width.

## Privacy

- The package fetches nothing by itself.
- Local images render as `data-src`, never `src`, so the browser does not ask your server for the reader's file names. Your code resolves them.
- With `webImages: 'defer'`, web images also render as `data-src`, and `url(...)` styles in diagrams are replaced with `none` (except `#id` references). Nothing loads until you decide. Use it for documents from someone else.
- `applyFontUrl` is the only helper that makes a network request. It adds a Google Fonts stylesheet link, and only when you call it.
- `lookCss` writes an `@import` for the font URL. The page that uses the CSS loads it.

## License

MIT

# Leggio for VS Code

Leggio restyles VS Code's built-in markdown preview. It uses the renderer and the reading look from [Leggio](https://github.com/arnaugiralt/leggio), a read-only markdown reader. You get a calm page, Mermaid diagrams, task lists, and your own fonts and colors. Open a preview as usual and it looks like Leggio.

## Settings

Every setting is under `leggio.` in VS Code's settings. Empty or null means "from the theme".

| Setting | What it does |
| --- | --- |
| `theme` | Default, Quiet, Cobalt, Teletype, Terminal or Ember. |
| `bg`, `fg`, `accent`, `codeBg` | Colors, as `#rrggbb`. They replace the theme's color. |
| `diagramTheme` | Color theme of Mermaid diagrams. |
| `fontUrl` | A Google Fonts stylesheet address. |
| `textFont`, `codeFont`, `uiFont` | Font families, as named in the Google Fonts address. |
| `fontSize`, `codeFontSize` | Sizes in px. |
| `lineHeight`, `fontWeight` | Line height and text weight. |
| `contentWidth`, `wideWidth` | Width of the text, and the largest width of tables and diagrams, in px. |

A value that is out of range or not valid is ignored, and the theme's value is used.

The Default theme follows VS Code's light or dark theme. The other themes, and any color you set, stay the same in both.

## Privacy

The extension makes no network request of its own. The only one is the Google Fonts stylesheet at the `fontUrl` you set. Images and links resolve as they do in VS Code.

## Turn it off

Open the Extensions view, choose Leggio, and select Disable or Disable (Workspace). The preview goes back to VS Code's own look.

## License

MIT

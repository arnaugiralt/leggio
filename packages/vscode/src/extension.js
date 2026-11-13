import * as vscode from 'vscode'
import { leggio } from '@leggio/core'
import { lookFromSettings, lookElement } from './look.js'

export function activate(context) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration('leggio') && vscode.commands.executeCommand('markdown.preview.refresh')),
  )
  return {
    extendMarkdownIt(md) {
      // VS Code has its own heading slugs for the outline and links, and it resolves relative images itself.
      md.use(leggio, { headingIds: false, localImages: 'keep' })
      md.core.ruler.push('leggio_look', state => {
        const token = new state.Token('html_block', '', 0)
        // Read per render, so a changed setting shows after a refresh.
        token.content = lookElement(lookFromSettings(key => vscode.workspace.getConfiguration('leggio').get(key)))
        token.meta = { ours: true }
        state.tokens.unshift(token)
      })
      return md
    },
  }
}

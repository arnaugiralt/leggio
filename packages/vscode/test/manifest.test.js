import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LOOK, PRESETS, DIAGRAM_THEMES } from '@leggio/core'
import { BOUNDS } from '../src/look.js'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const props = manifest.contributes.configuration.properties

test('the theme enum is the preset names, in order', () => {
  assert.deepEqual(props['leggio.theme'].enum, PRESETS.map(p => p.name))
})

test('the diagram theme enum is empty plus the core themes', () => {
  assert.deepEqual(props['leggio.diagramTheme'].enum, ['', ...DIAGRAM_THEMES])
})

test('every look key and fontSize is a setting', () => {
  for (const key of [...LOOK, 'fontSize']) assert.ok(props[`leggio.${key}`], key)
})

test('numeric settings carry the bounds the code validates with', () => {
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    assert.equal(props[`leggio.${key}`].minimum, min, key)
    assert.equal(props[`leggio.${key}`].maximum, max, key)
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LOOK, LOOK_BOUNDS, PRESETS, DIAGRAM_THEMES } from '@leggio/core'

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
  for (const [key, [min, max]] of Object.entries(LOOK_BOUNDS)) {
    assert.equal(props[`leggio.${key}`].minimum, min, key)
    assert.equal(props[`leggio.${key}`].maximum, max, key)
  }
})

test('a setting can be cleared in the Settings editor', () => {
  // format: color-hex rejects an empty string there, so clearing a color never reached settings.json.
  for (const [key, prop] of Object.entries(props)) {
    assert.equal(prop.format, undefined, key)
    if (prop.pattern) assert.match('', new RegExp(prop.pattern), key)
  }
})

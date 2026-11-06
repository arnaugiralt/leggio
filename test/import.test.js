import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, exportSettings, readSettingsFile, loadThemes } from '../src/settings.js'

const file = settings => JSON.stringify({ app: 'leggio', version: 1, settings })

test('an export reads back as the same settings', () => {
  const settings = { ...DEFAULTS, bg: '#101112', fontSize: 20 }
  const { settings: read, themes } = readSettingsFile(JSON.stringify(exportSettings(settings, [{ name: 'Night', bg: '#000000', fg: '#eeeeee' }])))
  assert.equal(read.bg, '#101112')
  assert.equal(read.fontSize, 20)
  assert.equal(themes.length, 1)
  assert.equal(themes[0].name, 'Night')
  assert.equal(themes[0].fg, '#eeeeee')
})

test('a file that is not Leggio settings is refused', () => {
  for (const text of ['not json', '[]', '{"settings":{}}', JSON.stringify({ app: 'other', settings: {} })]) {
    assert.throws(() => readSettingsFile(text), /isn't a Leggio settings file/)
  }
})

test('values that fail their check are left out, not applied', () => {
  const { settings } = readSettingsFile(file({ bg: 'red', fg: '#zzzzzz', fontSize: 9999, lineHeight: 'tall', diagramTheme: 'nope', followSystem: 'yes', accent: '#123456' }))
  assert.deepEqual(settings, { accent: '#123456' })
})

test('a font address must be a Google Fonts stylesheet', () => {
  assert.equal(readSettingsFile(file({ fontUrl: 'https://evil.test/x.css' })).settings.fontUrl, undefined)
  assert.equal(readSettingsFile(file({ fontUrl: 'javascript:alert(1)' })).settings.fontUrl, undefined)
  const ok = 'https://fonts.googleapis.com/css2?family=Literata&display=swap'
  assert.equal(readSettingsFile(file({ fontUrl: ok })).settings.fontUrl, ok)
})

test('font names are plain names', () => {
  assert.equal(readSettingsFile(file({ textFont: "x'; } body { display:none" })).settings.textFont, undefined)
  assert.equal(readSettingsFile(file({ textFont: 'IBM Plex Mono' })).settings.textFont, 'IBM Plex Mono')
})

test('unknown keys are ignored', () => {
  assert.deepEqual(readSettingsFile(file({ __proto__: { x: 1 }, evil: 1, fontSize: 18 })).settings, { fontSize: 18 })
})

test('themes keep only a name and valid look values', () => {
  const { themes } = readSettingsFile(file({ themes: [{ name: 'Ok', bg: '#ffffff', fontSize: 30 }, { bg: '#000000' }, 'junk', { name: 'x'.repeat(200) }] }))
  assert.equal(themes.length, 1)
  assert.deepEqual(Object.keys(themes[0]).sort(), ['bg', 'name'])
})

test('a file too large to be settings is refused before it is parsed', () => {
  assert.throws(() => readSettingsFile('x'.repeat(1_000_001)), /too large/)
})

test('saved themes load only when they are valid', () => {
  const storage = value => ({ getItem: () => value })
  assert.deepEqual(loadThemes(storage('not json')), [])
  assert.deepEqual(loadThemes(storage('{"a":1}')), [])
  assert.deepEqual(loadThemes(storage(JSON.stringify([{ name: 'Ok', bg: '#000000' }, { bg: '#ffffff' }, 'x']))), [{ name: 'Ok', bg: '#000000' }])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DARK, PRESETS, lookVars } from '@leggio/core'
import { lookFromSettings, lookElement } from '../src/look.js'

const from = settings => lookFromSettings(key => settings[key])
const nonNull = vars => Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== null))

test('Default follows the VS Code theme', () => {
  const { light, dark } = from({})
  assert.equal(light['--color-bg'], '#ffffff')
  assert.equal(dark['--color-bg'], DARK.bg)
})

test('a preset fixes the palette in both themes', () => {
  const ember = PRESETS.find(p => p.name === 'Ember')
  const { light, dark, fontUrl } = from({ theme: 'Ember' })
  assert.deepEqual(light, dark)
  assert.deepEqual(light, nonNull(lookVars(ember)))
  assert.equal(fontUrl, ember.fontUrl)
})

test('a color override fixes the palette in both themes', () => {
  const { light, dark } = from({ bg: '#112233' })
  assert.deepEqual(light, dark)
  assert.equal(light['--color-bg'], '#112233')
})

test('invalid values are ignored', () => {
  const base = from({})
  const bad = from({ bg: 'red; x', fontUrl: 'https://evil.example/x.css', lineHeight: 99, textFont: 'x"y' })
  assert.deepEqual(bad, base)
})

test('empty and null count as unset', () => {
  assert.deepEqual(from({ bg: '', lineHeight: null, fontUrl: '', fontSize: undefined }), from({}))
})

test('an unknown theme falls back to Default', () => {
  assert.deepEqual(from({ theme: 'Nope' }), from({}))
})

test('fontSize is in rem', () => {
  assert.equal(from({ fontSize: 20 }).light['--font-size'], '1.25rem')
})

test('lookElement escapes the attribute values', () => {
  const look = from({ textFont: "O'Brien Sans" })
  look.light['--x'] = `a"b'c<d>&`
  const html = lookElement(look)
  assert.match(html, /^<div id="leggio-look" hidden /)
  const attr = name => html.match(new RegExp(` ${name}="([^"']*)"`))[1]
  const unescape = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  assert.deepEqual(JSON.parse(unescape(attr('data-light'))), look.light)
  assert.deepEqual(JSON.parse(unescape(attr('data-dark'))), look.dark)
  assert.equal(unescape(attr('data-font-url')), look.fontUrl)
})

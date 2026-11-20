import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, STORAGE_KEY, load, save, isDefaultLook, withFamily, withoutFamily, fontSpecs } from '../src/settings.js'
import { LOOK_CHECKS } from '@leggio/core'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  }
}

function fakeRoot() {
  const vars = {}
  return { vars, style: { setProperty: (k, v) => { vars[k] = v }, removeProperty: k => { delete vars[k] } } }
}

test('load returns defaults when storage is empty', () => {
  assert.deepEqual(load(fakeStorage()), DEFAULTS)
})

test('load merges stored values over defaults', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ fontSize: 21, bg: '#000000' }) })
  const s = load(storage)
  assert.equal(s.fontSize, 21)
  assert.equal(s.bg, '#000000')
  assert.equal(s.fg, DEFAULTS.fg)
})

test('load ignores corrupt json', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{not json' })
  assert.deepEqual(load(storage), DEFAULTS)
})

test('load treats non-object stored json as empty', () => {
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: 'null' })), DEFAULTS)
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: '[1,2]' })), DEFAULTS)
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: '"text"' })), DEFAULTS)
})

test('blocked storage falls back to defaults and saving is a no-op', () => {
  const blocked = { getItem() { throw new DOMException('blocked', 'SecurityError') }, setItem() { throw new DOMException('blocked', 'SecurityError') } }
  assert.deepEqual(load(blocked), DEFAULTS)
  assert.doesNotThrow(() => save(DEFAULTS, blocked))
})

test('save round-trips through load', () => {
  const storage = fakeStorage()
  const s = { ...DEFAULTS, lineHeight: 1.8, fontUrl: 'https://fonts.googleapis.com/css2?family=Inter&display=swap' }
  save(s, storage)
  assert.deepEqual(load(storage), s)
})

test('load drops keys that are no longer settings', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ fontFamily: 'Georgia', fontSize: 20 }) })
  const s = load(storage)
  assert.equal(s.fontSize, 20)
  assert.equal('fontFamily' in s, false)
})

test('settings saved before followSystem follow only if the look is still Default', () => {
  const stored = s => load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(s) }))
  assert.equal(stored({ fontSize: 20 }).followSystem, true)
  assert.equal(stored({ bg: '#000000' }).followSystem, false)
  assert.equal(stored({ bg: '#000000', followSystem: true }).followSystem, true)
  assert.equal(isDefaultLook({ ...DEFAULTS, fontSize: 20 }), true)
  assert.equal(isDefaultLook({ ...DEFAULTS, accent: '#000000' }), false)
})

test('fonts are added and removed by name, keeping the other families as written', () => {
  const literata = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap'
  const both = withFamily(literata, 'Bricolage+Grotesque:wght@200..800')
  assert.equal(both, 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&family=Bricolage+Grotesque:wght@200..800&display=swap')
  assert.equal(withoutFamily(both, 'Bricolage Grotesque'), literata)
  assert.equal(withoutFamily(literata, 'Literata'), '')
  assert.equal(withFamily('', 'Lora'), 'https://fonts.googleapis.com/css2?family=Lora&display=swap')
})

test('a font name becomes Google Fonts specs, widest first, and nothing that could change the address', () => {
  const specs = fontSpecs('IBM Plex Mono')
  assert.equal(specs[0], 'IBM+Plex+Mono:ital,wght@0,100..900;1,100..900')
  assert.ok(specs.includes('IBM+Plex+Mono:ital,wght@0,400;0,600;1,400;1,600'))
  assert.equal(specs.at(-1), 'IBM+Plex+Mono')
  assert.ok(specs.every(s => LOOK_CHECKS.fontUrl(withFamily('', s))))
  for (const bad of ['', 'Lora&family=Evil', 'Lora:wght@400', 'x;y', 'a'.repeat(61)]) assert.deepEqual(fontSpecs(bad), [])
})

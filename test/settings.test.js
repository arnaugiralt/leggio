import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, STORAGE_KEY, load, save, applyToRoot } from '../src/settings.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  }
}

function fakeRoot() {
  const vars = {}
  return { vars, style: { setProperty: (k, v) => { vars[k] = v } } }
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

test('save round-trips through load', () => {
  const storage = fakeStorage()
  const s = { ...DEFAULTS, fontFamily: 'Georgia', lineHeight: 1.8 }
  save(s, storage)
  assert.deepEqual(load(storage), s)
})

test('applyToRoot writes every setting as a css variable with units', () => {
  const root = fakeRoot()
  applyToRoot({ ...DEFAULTS, fontSize: 18, contentWidth: 800, codeFontSize: 13, lineHeight: 1.7 }, root)
  assert.equal(root.vars['--font-size'], '18px')
  assert.equal(root.vars['--content-width'], '800px')
  assert.equal(root.vars['--code-font-size'], '13px')
  assert.equal(root.vars['--line-height'], '1.7')
  assert.equal(root.vars['--font-family'], DEFAULTS.fontFamily)
  assert.equal(root.vars['--code-font-family'], DEFAULTS.codeFontFamily)
  assert.equal(root.vars['--color-bg'], DEFAULTS.bg)
  assert.equal(root.vars['--color-fg'], DEFAULTS.fg)
  assert.equal(root.vars['--color-accent'], DEFAULTS.accent)
  assert.equal(root.vars['--color-code-bg'], DEFAULTS.codeBg)
  assert.equal(Object.keys(root.vars).length, 10)
})

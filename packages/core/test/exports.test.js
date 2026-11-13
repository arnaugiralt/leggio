import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as core from '../index.js'

test('index.d.ts declares exactly what index.js exports', () => {
  const dts = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8')
  const declared = new Set()
  for (const m of dts.matchAll(/^export (?:declare )?(function|const|let|class)\s+(\w+)/gm)) declared.add(m[2])
  for (const m of dts.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const name of m[1].split(',')) if (name.trim()) declared.add(name.trim().split(/\s+as\s+/).pop())
  }
  // interfaces and type aliases have no runtime value, so they are not collected above
  const exported = new Set(Object.keys(core))
  const missingTypes = [...exported].filter(n => !declared.has(n))
  const extraTypes = [...declared].filter(n => !exported.has(n))
  assert.deepEqual({ missingTypes, extraTypes }, { missingTypes: [], extraTypes: [] })
})

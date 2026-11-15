import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRelative, isMarkdownName, resolvePath, listMarkdown, fromFile, fromFileList, getFileByPath, getDirByPath, getFile, isSame, resolve, watch, exists, isDenied } from '../src/fs.js'

function file(name) {
  return { kind: 'file', name }
}
function dir(name, entries) {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const e of entries) yield [e.name, e]
    },
  }
}
const names = node => node.children.map(c => c.name)

test('isRelative', () => {
  for (const u of ['img.png', './a.md', '../b.md', 'sub/c.md', 'my%20file.md']) assert.equal(isRelative(u), true, u)
  for (const u of ['#x', '/abs.md', '//host/x', 'https://x', 'http://x', 'mailto:a@b', 'data:image/png;base64,AA']) assert.equal(isRelative(u), false, u)
})

test('isMarkdownName', () => {
  for (const n of ['a.md', 'B.MD', 'c.markdown', 'd.txt']) assert.equal(isMarkdownName(n), true, n)
  for (const n of ['e.png', 'f.json', 'md', 'g.md.bak']) assert.equal(isMarkdownName(n), false, n)
})

test('resolvePath starts from the root for a leading slash', () => {
  assert.deepEqual(resolvePath(['docs'], '/a/b.md'), ['a', 'b.md'])
})

test('resolvePath normalizes against the current directory', () => {
  assert.deepEqual(resolvePath(['docs'], './a.md'), ['docs', 'a.md'])
  assert.deepEqual(resolvePath(['docs', 'x'], '../b.md'), ['docs', 'b.md'])
  assert.deepEqual(resolvePath([], 'a/./b//c.md'), ['a', 'b', 'c.md'])
  assert.deepEqual(resolvePath(['docs'], 'my%20file.md'), ['docs', 'my file.md'])
  assert.equal(resolvePath(['docs'], '../../escape.md'), null)
  assert.equal(resolvePath([], '.'), null)
})

test('listMarkdown filters, prunes, and sorts', async () => {
  const root = dir('root', [
    file('b.md'),
    file('a.md'),
    file('x.png'),
    dir('.git', [file('c.md')]),
    dir('node_modules', [file('r.md')]),
    dir('empty', [file('i.png')]),
    dir('docs', [file('z.txt'), dir('deep', [file('d.markdown')])]),
  ])
  const tree = await listMarkdown(root)
  assert.equal(tree.kind, 'directory')
  assert.equal(tree.name, 'root')
  assert.deepEqual(names(tree), ['docs', 'a.md', 'b.md'])
  const docs = tree.children[0]
  assert.deepEqual(names(docs), ['deep', 'z.txt'])
  assert.deepEqual(names(docs.children[0]), ['d.markdown'])
  assert.equal(tree.children[1].handle.name, 'a.md')
})

test('opensInTab', async () => {
  const { opensInTab } = await import('../src/fs.js')
  for (const t of ['image/png', 'application/pdf', 'text/plain', 'audio/mpeg', 'video/mp4']) assert.equal(opensInTab(t), true, t)
  for (const t of ['text/csv', 'text/html', 'image/svg+xml', 'application/zip', '']) assert.equal(opensInTab(t), false, t)
})

// What <input webkitdirectory> returns: File objects whose webkitRelativePath starts with the folder name.
function picked(paths) {
  return paths.map(path => Object.assign(new File([path], path.split('/').pop(), { lastModified: 1000 }), { webkitRelativePath: path }))
}
const notes = () => fromFileList(picked(['notes/README.md', 'notes/img/a.png', 'notes/docs/b.md', 'notes/.git/c.md', 'notes/node_modules/x/r.md']))

test('a copied folder lists like a real one', async () => {
  const tree = await listMarkdown(notes())
  assert.equal(tree.name, 'notes')
  assert.deepEqual(names(tree), ['docs', 'README.md'])
  assert.deepEqual(names(tree.children[0]), ['b.md'])
})

test('a copied folder resolves paths with the same errors as a handle', async () => {
  const root = notes()
  const b = await getFileByPath(root, ['docs', 'b.md'])
  assert.equal(await (await getFile(b)).text(), 'notes/docs/b.md')
  assert.equal((await getDirByPath(root, ['img'])).name, 'img')
  await assert.rejects(getFileByPath(root, ['docs']), { name: 'TypeMismatchError' })
  await assert.rejects(getFileByPath(root, ['missing.md']), { name: 'NotFoundError' })
  await assert.rejects(getFileByPath(root, ['.git', 'c.md']), { name: 'NotFoundError' })
})

test('copies keep their identity through a structured clone, as history state does', async () => {
  const root = notes()
  const b = await getFileByPath(root, ['docs', 'b.md'])
  const [rootClone, bClone] = structuredClone([root, b])
  assert.equal(await isSame(rootClone, root), true)
  assert.equal(await isSame(bClone, b), true)
  assert.equal(await isSame(b, root), false)
  assert.equal(await isSame(notes(), root), false) // another pick is another copy
  assert.deepEqual(await resolve(rootClone, bClone), ['docs', 'b.md'])
  assert.deepEqual(await resolve(await getDirByPath(root, ['docs']), b), ['b.md'])
})

test('a copied file is found in a copied folder by name, size and date', async () => {
  const root = notes()
  const [readme] = picked(['notes/README.md'])
  assert.deepEqual(await resolve(root, fromFile(readme)), ['README.md'])
  const other = new File(['different'], 'README.md', { lastModified: 1000 })
  assert.equal(await resolve(root, fromFile(other)), null)
})

test('copies never change and always exist', async () => {
  let called = false
  const stop = watch(fromFile(new File(['x'], 'a.md')), () => (called = true))
  stop()
  assert.equal(called, false)
  assert.equal(await exists(notes()), true)
})

test('only a denied handle is ruled out; one that can still prompt is kept', async () => {
  const handle = state => ({ queryPermission: async () => state })
  assert.equal(await isDenied(handle('denied')), true)
  assert.equal(await isDenied(handle('prompt')), false)
  assert.equal(await isDenied(handle('granted')), false)
  assert.equal(await isDenied(fromFile(new File(['x'], 'a.md'))), false)
  assert.equal(await isDenied({ queryPermission: async () => { throw new Error('boom') } }), true)
})

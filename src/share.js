// A share link carries the document itself in the URL fragment, which browsers never send to a server.
// Format: '1.' + base64url(deflate-raw(utf8(name + '\n' + text))). The '1.' lets a later format say so.

// No length limit when sharing: Chrome takes URLs up to about 2 MB, and the apps a link is pasted into cut at
// sizes they don't document. A cut link decodes as 'damaged', so the reader sees a notice, never partial text.

// A link is a few KB, but deflate can expand it a thousandfold: stop reading well before memory suffers.
const MAX_BYTES = 5 * 1024 * 1024

const fail = reason => Object.assign(new Error(reason), { reason })

async function bytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64url(data) {
  let s = ''
  for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(code) {
  const s = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

export async function encode(name, text) {
  const data = new TextEncoder().encode(`${name.replace(/[\r\n]+/g, ' ')}\n${text}`)
  return '1.' + toBase64url(await bytes(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))))
}

// The whole stream, unless it passes MAX_BYTES: then 'too-large', without reading the rest. A web document's
// body goes through here too.
export async function readCapped(stream) {
  const reader = stream.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => {})
      throw fail('too-large')
    }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let at = 0
  for (const c of chunks) all.set(c, (at += c.length) - c.length)
  return all
}

export async function decode(code) {
  const dot = code.indexOf('.')
  if (dot < 0 || !/^\d+$/.test(code.slice(0, dot))) throw fail('damaged')
  if (code.slice(0, dot) !== '1') throw fail('version')
  let all
  try {
    all = await readCapped(new Blob([fromBase64url(code.slice(dot + 1))]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
  } catch (err) {
    throw err.reason ? err : fail('damaged')
  }
  let doc
  try {
    doc = new TextDecoder('utf-8', { fatal: true }).decode(all) // a cut through a multibyte character is damage, not text
  } catch {
    throw fail('damaged')
  }
  const nl = doc.indexOf('\n')
  if (nl < 0) throw fail('damaged')
  return { name: doc.slice(0, nl), text: doc.slice(nl + 1) }
}

// The copy id of a shared document. Derived from the link, so the same link reopened (a reload, Back) is the
// same document and replaces its history entry instead of adding one.
export async function shareId(code) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))
  return 'share-' + Array.from(hash.subarray(0, 8), b => b.toString(16).padStart(2, '0')).join('')
}

const parse = text => {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

// The address to fetch for a web document, as given: only https, since an http fetch from an https page is
// blocked anyway and would show who reads what. No rewriting of GitHub or gist pages for now; their Raw
// address works.
export function httpsUrl(text) {
  const url = parse(text)
  return url?.protocol === 'https:' ? url.href : null
}

// What a pasted text opens: a Leggio link from any origin (the dev server, a preview, the site), or a web
// address. Anything else is ordinary pasting, including text that only starts with an address. An http address
// counts, so the reader learns why it won't open.
export function readLink(text) {
  text = text.trim()
  const url = !/\s/.test(text) && parse(text)
  if (!url || !/^https?:$/.test(url.protocol)) return null
  if (url.hash.startsWith('#share=')) return { share: url.hash.slice(7) }
  if (url.hash.startsWith('#url=')) {
    let inner
    try {
      inner = parse(decodeURIComponent(url.hash.slice(5)))
    } catch {
      return null // a Leggio link damaged on the way
    }
    if (inner) return { url: inner.href }
  }
  return { url: url.href }
}

export function webName(text) {
  const last = parse(text)?.pathname.split('/').filter(Boolean).pop()
  try {
    return last ? decodeURIComponent(last) : 'Document'
  } catch {
    return last
  }
}

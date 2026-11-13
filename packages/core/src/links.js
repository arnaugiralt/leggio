// A leading "word:" reads as a scheme, as in a real href; write ./notes:draft.md to force a relative path.
// Relative means: no fragment, not root-relative, not protocol-relative, no scheme.
export const isRelative = url => !/^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(url)

// Followable from the reader: relative, or root-relative (/x), which resolves from the open folder's root.
export const isLocal = url => isRelative(url) || /^\/(?!\/)/.test(url)

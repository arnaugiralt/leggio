/*
 * Paths copied from Lucide (https://lucide.dev), ISC licence:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 *   All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Seven icons do not justify a dependency, so they live here as paths. Re-copy from the same
 * source if more are ever needed, rather than drawing new ones by hand beside these.
 */

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  stroke: 'currentColor',
  'aria-hidden': 'true',
  focusable: 'false',
}

// Transport shapes are filled: at 16px a 2px outline leaves too little counter for a triangle to
// read as one. The bar in skip-back and skip-forward has no area, so it stays a stroke regardless.
const Solid = ({ size = 16, children, ...rest }) => (
  <svg {...base} {...rest} width={size} height={size} fill="currentColor">
    {children}
  </svg>
)

const Line = ({ size = 16, children, ...rest }) => (
  <svg {...base} {...rest} width={size} height={size} fill="none">
    {children}
  </svg>
)

export const SkipBack = props => (
  <Solid {...props}>
    <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
    <path d="M3 20V4" />
  </Solid>
)

export const SkipForward = props => (
  <Solid {...props}>
    <path d="M21 4v16" />
    <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
  </Solid>
)

export const Play = props => (
  <Solid {...props}>
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </Solid>
)

export const Pause = props => (
  <Solid {...props}>
    <rect x="14" y="3" width="5" height="18" rx="1" />
    <rect x="5" y="3" width="5" height="18" rx="1" />
  </Solid>
)

export const Folder = props => (
  <Line {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Line>
)

export const FileText = props => (
  <Line {...props}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </Line>
)

export const ChevronRight = props => (
  <Line {...props}>
    <path d="m9 18 6-6-6-6" />
  </Line>
)

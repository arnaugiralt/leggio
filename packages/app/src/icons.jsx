/*
 * Paths copied from Lucide (https://lucide.dev), ISC licence:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 *   All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * A handful of icons do not justify a dependency, so they live here as paths. Re-copy from the same
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

// Everything is stroked. Filled transport shapes read as blobs beside this app's hairlines; the
// cost is that a triangle needs room for its counter, so the player draws these at 18px.
const Icon = ({ size = 16, children, ...rest }) => (
  <svg {...base} {...rest} width={size} height={size} fill="none">
    {children}
  </svg>
)

export const SkipBack = props => (
  <Icon {...props}>
    <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
    <path d="M3 20V4" />
  </Icon>
)

export const SkipForward = props => (
  <Icon {...props}>
    <path d="M21 4v16" />
    <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
  </Icon>
)

export const Play = props => (
  <Icon {...props}>
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </Icon>
)

export const Pause = props => (
  <Icon {...props}>
    <rect x="14" y="3" width="5" height="18" rx="1" />
    <rect x="5" y="3" width="5" height="18" rx="1" />
  </Icon>
)

export const Folder = props => (
  <Icon {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Icon>
)

export const FileText = props => (
  <Icon {...props}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </Icon>
)

export const FolderOpen = props => (
  <Icon {...props}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </Icon>
)

export const ChevronLeft = props => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)

export const ChevronDown = props => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const ChevronRight = props => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)

export const Menu = props => (
  <Icon {...props}>
    <path d="M4 12h16M4 6h16M4 18h16" />
  </Icon>
)

export const Ellipsis = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Icon>
)

export const List = props => (
  <Icon {...props}>
    <path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13" />
  </Icon>
)

export const X = props => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)

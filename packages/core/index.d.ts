import type { MarkdownIt } from 'markdown-it'

export type LocalImages = 'defer' | 'keep'
export type WebImages = 'load' | 'defer'
export type FontRole = 'text' | 'code' | 'ui'

export interface ImageOptions {
  /** 'defer' (default) renders local images as data-src, for the host to resolve. 'keep' leaves them as src. */
  localImages?: LocalImages
  /** 'load' (default) renders web images as src. 'defer' renders them as data-src and holds diagram url(...) styles. */
  webImages?: WebImages
}

export interface LeggioOptions extends ImageOptions {
  /** Default true. */
  headingIds?: boolean
  /** Default true. */
  taskLists?: boolean
  /** Default true. */
  footnotes?: boolean
  /** Default true. Turns mermaid fences into inline SVG. */
  diagrams?: boolean
}

export const leggio: (md: MarkdownIt, options?: LeggioOptions) => void

/** Markdown in, HTML out. Front matter is hidden. */
export function render(text: string, options?: ImageOptions): string
export function withoutFrontMatter(text: string): string

/** True for relative and root-relative (/x) links. */
export function isLocal(url: string): boolean
/** True for relative links only. */
export function isRelative(url: string): boolean

export interface Look {
  bg: string
  fg: string
  accent: string
  codeBg: string
  diagramTheme: string
  fontUrl: string
  textFont: string
  codeFont: string
  uiFont: string
  lineHeight: number
  fontWeight: number
  codeFontSize: number
  contentWidth: number
  wideWidth: number
  /** Text size in px. Not part of a theme. */
  fontSize?: number
  /** Default look follows the system light or dark setting. */
  followSystem?: boolean
}

export type LookKey =
  | 'bg' | 'fg' | 'accent' | 'codeBg' | 'diagramTheme' | 'fontUrl' | 'textFont' | 'codeFont' | 'uiFont'
  | 'lineHeight' | 'fontWeight' | 'codeFontSize' | 'contentWidth' | 'wideWidth'

export type Theme = Pick<Look, LookKey>
export interface Preset extends Theme {
  name: string
}

export const LOOK: LookKey[]
export const LOOK_DEFAULTS: Theme
export const DARK: Pick<Look, 'bg' | 'fg' | 'accent' | 'codeBg'>
export const PRESETS: Preset[]
export const DIAGRAM_THEMES: string[]

export function themeLabel(id: string): string
export function effective<T extends Look>(settings: T, dark: boolean): T
export function isDefaultLook(settings: Partial<Look>): boolean
export function isDark(hex: string): boolean
export function completeTheme(theme: Partial<Theme>, current: Partial<Theme>): Theme

export function families(url: string): string[]
export function fontName(settings: Partial<Look>, role: FontRole): string
export function fontStack(settings: Partial<Look>, role: FontRole): string
export function fontOptions(settings: Partial<Look>, role: FontRole): [label: string, items: [value: string, text: string][]][]
export function matchesPreset(settings: Partial<Look>, preset: Theme): boolean
export function withSwap(url: string): string

/** CSS custom properties for a look. null means the property must not exist. */
export function lookVars(look: Look): Record<string, string | null>
/** Sets the look's properties on an element (default: document.documentElement). Needs a DOM. */
export function applyLook(look: Look, el?: HTMLElement): void
/** A stylesheet for hosts with no DOM. Starts with an @import when the look has an https font URL. */
export function lookCss(look: Look, selector?: string): string
/** Adds or removes a Google Fonts stylesheet link. The only helper that makes a network request. */
export function applyFontUrl(url: string, doc?: Document): void

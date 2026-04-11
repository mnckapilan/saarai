export interface FontOption {
  label: string
  /** Full CSS font-family value passed to Monaco and the output panel */
  value: string
  /** Google Fonts `family` param — omit for system fonts */
  googleFont?: string
  /** Whether this font supports programming ligatures */
  ligatures: boolean
}

export const MONO_FONTS: FontOption[] = [
  {
    label: 'JetBrains Mono',
    value: "'JetBrains Mono', monospace",
    googleFont: 'JetBrains+Mono',
    ligatures: true,
  },
  {
    label: 'Fira Code',
    value: "'Fira Code', monospace",
    googleFont: 'Fira+Code',
    ligatures: true,
  },
  {
    label: 'Source Code Pro',
    value: "'Source Code Pro', monospace",
    googleFont: 'Source+Code+Pro',
    ligatures: false,
  },
  {
    label: 'IBM Plex Mono',
    value: "'IBM Plex Mono', monospace",
    googleFont: 'IBM+Plex+Mono',
    ligatures: false,
  },
  {
    label: 'Inconsolata',
    value: "'Inconsolata', monospace",
    googleFont: 'Inconsolata',
    ligatures: false,
  },
  {
    label: 'Roboto Mono',
    value: "'Roboto Mono', monospace",
    googleFont: 'Roboto+Mono',
    ligatures: false,
  },
  {
    label: 'Space Mono',
    value: "'Space Mono', monospace",
    googleFont: 'Space+Mono',
    ligatures: false,
  },
  {
    label: 'Ubuntu Mono',
    value: "'Ubuntu Mono', monospace",
    googleFont: 'Ubuntu+Mono',
    ligatures: false,
  },
  {
    label: 'Cousine',
    value: "'Cousine', monospace",
    googleFont: 'Cousine',
    ligatures: false,
  },
  // System fonts — no download needed
  {
    label: 'Consolas',
    value: 'Consolas, monospace',
    ligatures: false,
  },
  {
    label: 'Menlo',
    value: 'Menlo, monospace',
    ligatures: false,
  },
  {
    label: 'Courier New',
    value: "'Courier New', monospace",
    ligatures: false,
  },
]

export const DEFAULT_FONT = MONO_FONTS[0] // JetBrains Mono

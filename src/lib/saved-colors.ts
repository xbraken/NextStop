// Pastel palette used to tint saved items. Kept as inline styles so Tailwind
// JIT doesn't need to know about them. `bg` = icon tile background,
// `fg` = icon colour, `tag` = optional dot colour for small accents.

export interface SavedColor {
  key: string
  label: string
  bg: string
  fg: string
}

export const SAVED_COLORS: SavedColor[] = [
  { key: 'default', label: 'Teal',     bg: 'rgba(0, 101, 101, 0.10)', fg: '#006565' },
  { key: 'rose',    label: 'Rose',     bg: '#FFD6E0',                 fg: '#9C2E4F' },
  { key: 'peach',   label: 'Peach',    bg: '#FFE1C6',                 fg: '#9A4E14' },
  { key: 'lemon',   label: 'Lemon',    bg: '#FFF4B8',                 fg: '#7A5A10' },
  { key: 'mint',    label: 'Mint',     bg: '#CDEFD6',                 fg: '#1F6A3A' },
  { key: 'sky',     label: 'Sky',      bg: '#CDE4F9',                 fg: '#1E4C82' },
  { key: 'lilac',   label: 'Lilac',    bg: '#E0D5F7',                 fg: '#4E2E91' },
  { key: 'blush',   label: 'Blush',    bg: '#F4D9DE',                 fg: '#8A2A3A' },
  { key: 'sand',    label: 'Sand',     bg: '#F0E4CF',                 fg: '#6B5320' },
]

export const DEFAULT_COLOR_KEY = 'default'

const BY_KEY = new Map(SAVED_COLORS.map((c) => [c.key, c]))

export function getSavedColor(key: string | null | undefined): SavedColor {
  if (key && BY_KEY.has(key)) return BY_KEY.get(key)!
  return BY_KEY.get(DEFAULT_COLOR_KEY)!
}

export function isValidColorKey(key: unknown): key is string {
  return typeof key === 'string' && BY_KEY.has(key)
}

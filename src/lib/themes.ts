export interface ThemeDefinition {
  id: string
  name: string
  description: string
  font: string
  preview: {
    bg: string
    surface: string
    accent: string
    text: string
    border: string
    sketchLine: string
  }
  cssVars: Record<string, string>
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'solid-vintage',
    name: 'Solid Vintage',
    description: 'Warm parchment tones, pencil-sketch borders, keyboard-key buttons, Departure Mono typeface.',
    font: 'Departure Mono',
    preview: {
      bg: '#f4f0e8',
      surface: '#faf8f4',
      accent: '#8b6e4e',
      text: '#2c2520',
      border: '#d8d0c4',
      sketchLine: '#b0a498',
    },
    cssVars: {
      '--ms-bg': '#f4f0e8',
      '--ms-bg-warm': '#ede8dd',
      '--ms-surface': '#faf8f4',
      '--ms-surface-dim': '#f0ece3',
      '--ms-border': '#d8d0c4',
      '--ms-border-light': '#e6e0d5',
      '--ms-text': '#2c2520',
      '--ms-text-secondary': '#6b6058',
      '--ms-text-muted': '#9a9088',
      '--ms-sketch-line': '#b0a498',
      '--ms-accent': '#8b6e4e',
      '--ms-accent-hover': '#74593c',
      '--ms-accent-light': '#c4a882',
      '--ms-accent-bg': 'rgba(139, 110, 78, 0.08)',
      '--ms-success': '#5a7a5a',
      '--ms-success-bg': 'rgba(90, 122, 90, 0.08)',
      '--ms-danger': '#9e4a4a',
      '--ms-danger-bg': 'rgba(158, 74, 74, 0.08)',
      '--ms-info': '#5a6e8a',
      '--ms-info-bg': 'rgba(90, 110, 138, 0.08)',
    },
  },
  {
    id: 'calling-of-dungeons',
    name: 'Calling of Dungeons',
    description: 'Silver-gray palette, teal accent, solid rounded borders, Inter + DM Sans typefaces, dark outer frame.',
    font: 'Inter / DM Sans',
    preview: {
      bg: '#ddd',
      surface: '#e5e5e5',
      accent: '#3a8a9a',
      text: '#444',
      border: '#c5c5c5',
      sketchLine: '#b5b5b5',
    },
    cssVars: {
      '--ms-bg': '#ddd',
      '--ms-bg-warm': '#d5d5d5',
      '--ms-surface': '#e5e5e5',
      '--ms-surface-dim': '#d5d5d5',
      '--ms-border': '#c5c5c5',
      '--ms-border-light': '#d0d0d0',
      '--ms-text': '#444',
      '--ms-text-secondary': '#666',
      '--ms-text-muted': '#999',
      '--ms-sketch-line': '#b5b5b5',
      '--ms-accent': '#3a8a9a',
      '--ms-accent-hover': '#2e7a8a',
      '--ms-accent-light': '#6aabb6',
      '--ms-accent-bg': 'rgba(58, 138, 154, 0.08)',
      '--ms-success': '#5a8a62',
      '--ms-success-bg': 'rgba(90, 138, 98, 0.07)',
      '--ms-danger': '#a05050',
      '--ms-danger-bg': 'rgba(160, 80, 80, 0.07)',
      '--ms-info': '#3a8a9a',
      '--ms-info-bg': 'rgba(58, 138, 154, 0.08)',
    },
  },
]

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}

export const DEFAULT_THEME_ID = 'solid-vintage'

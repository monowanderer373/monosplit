/**
 * Palette registry.
 *
 * There is intentionally one entry. The app ships a single opinionated look so
 * it has a recognisable identity; this file exists so trying another palette
 * means adding an entry here plus a matching `[data-theme="…"]` block in
 * `index.css`, rather than editing colours across components.
 */
export interface ThemeDefinition {
  id: string
  name: string
  description: string
  font: string
  wip?: boolean
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
    name: 'Denim & Paper',
    description: 'Warm paper, washed denim blue, and restrained apricot accents.',
    font: 'Inter',
    preview: {
      bg: '#F7F5EF',
      surface: '#FFFCF7',
      accent: '#35678B',
      text: '#24374A',
      border: '#D7DEDF',
      sketchLine: '#576779',
    },
    cssVars: {
      '--ms-bg': '#F7F5EF',
      '--ms-bg-warm': '#E1EDF3',
      '--ms-surface': '#FFFCF7',
      '--ms-surface-dim': '#E1EDF3',
      '--ms-border': '#D7DEDF',
      '--ms-border-light': '#E1EDF3',
      '--ms-text': '#24374A',
      '--ms-text-secondary': '#576779',
      '--ms-text-muted': '#576779',
      '--ms-sketch-line': '#D7DEDF',
      '--ms-accent': '#35678B',
      '--ms-accent-hover': '#2E5C7E',
      '--ms-accent-light': '#35678B',
      '--ms-accent-bg': '#DDEAF1',
      '--ms-success': '#236C62',
      '--ms-success-bg': '#E9F0F3',
      '--ms-danger': '#AD412E',
      '--ms-danger-bg': '#FBEADB',
      '--ms-info': '#35678B',
      '--ms-info-bg': '#E9F0F3',
    },
  },
]

export const DEFAULT_THEME_ID = 'solid-vintage'

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}

/** Maps any persisted value — including retired theme ids — onto a real palette. */
export function resolveThemeId(id: string | null | undefined): string {
  return id && THEMES.some((theme) => theme.id === id) ? id : DEFAULT_THEME_ID
}

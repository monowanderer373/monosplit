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
    name: 'Warm Ledger',
    description: 'Warm off-white paper, tabby-orange reserved for actions, near-black amounts, and depth only where it earns attention.',
    font: 'Plus Jakarta Sans',
    preview: {
      bg: '#fdfbf7',
      surface: '#ffffff',
      accent: '#c2571a',
      text: '#1f1b18',
      border: '#efe7dc',
      sketchLine: '#a79684',
    },
    cssVars: {
      '--ms-bg': '#fdfbf7',
      '--ms-bg-warm': '#f6f1e9',
      '--ms-surface': '#ffffff',
      '--ms-surface-dim': '#f6f1e9',
      '--ms-border': '#efe7dc',
      '--ms-border-light': '#f6f0e7',
      '--ms-text': '#1f1b18',
      '--ms-text-secondary': '#7a6a5c',
      '--ms-text-muted': '#a79684',
      '--ms-sketch-line': '#efe7dc',
      '--ms-accent': '#c2571a',
      '--ms-accent-hover': '#a6470f',
      '--ms-accent-light': '#e9a276',
      '--ms-accent-bg': '#fbede2',
      '--ms-success': '#3f6b4a',
      '--ms-success-bg': '#eaf1eb',
      '--ms-danger': '#a63d2e',
      '--ms-danger-bg': '#f8ece9',
      '--ms-info': '#4a6e86',
      '--ms-info-bg': '#ebf0f3',
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

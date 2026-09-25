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
    description: 'Thermal paper, stamp red for actions, carbon blue for money coming in.',
    font: 'IBM Plex Mono',
    preview: {
      bg: '#f4efe4',
      surface: '#faf6ee',
      accent: '#d7263d',
      text: '#1a120c',
      border: '#d9cbb8',
      sketchLine: '#6d5c4e',
    },
    cssVars: {
      '--ms-bg': '#f4efe4',
      '--ms-bg-warm': '#efe4d4',
      '--ms-surface': '#faf6ee',
      '--ms-surface-dim': '#efe4d4',
      '--ms-border': '#d9cbb8',
      '--ms-border-light': '#efe4d4',
      '--ms-text': '#1a120c',
      '--ms-text-secondary': '#6d5c4e',
      '--ms-text-muted': '#6d5c4e',
      '--ms-sketch-line': '#d9cbb8',
      '--ms-accent': '#d7263d',
      '--ms-accent-hover': '#b61e32',
      '--ms-accent-light': '#e2b143',
      '--ms-accent-bg': '#f8e4e1',
      '--ms-success': '#1d4e89',
      '--ms-success-bg': '#e7eef6',
      '--ms-danger': '#d7263d',
      '--ms-danger-bg': '#f8e4e1',
      '--ms-info': '#1d4e89',
      '--ms-info-bg': '#e7eef6',
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

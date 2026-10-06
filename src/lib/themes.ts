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
    name: 'Matte Paper',
    description: 'Solid ivory paper, brick red actions, and deep green incoming amounts.',
    font: 'Inter',
    preview: {
      bg: '#f4efe6',
      surface: '#fff9ef',
      accent: '#ad3e35',
      text: '#38281c',
      border: '#d9c9b4',
      sketchLine: '#76624f',
    },
    cssVars: {
      '--ms-bg': '#f4efe6',
      '--ms-bg-warm': '#eee3d2',
      '--ms-surface': '#fff9ef',
      '--ms-surface-dim': '#eee3d2',
      '--ms-border': '#d9c9b4',
      '--ms-border-light': '#eee3d2',
      '--ms-text': '#38281c',
      '--ms-text-secondary': '#76624f',
      '--ms-text-muted': '#76624f',
      '--ms-sketch-line': '#d9c9b4',
      '--ms-accent': '#ad3e35',
      '--ms-accent-hover': '#94352e',
      '--ms-accent-light': '#e2b143',
      '--ms-accent-bg': '#f6e5df',
      '--ms-success': '#35685b',
      '--ms-success-bg': '#e9efea',
      '--ms-danger': '#ad3e35',
      '--ms-danger-bg': '#f6e5df',
      '--ms-info': '#35685b',
      '--ms-info-bg': '#e9efea',
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

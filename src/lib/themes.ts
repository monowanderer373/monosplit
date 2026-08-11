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
    id: 'glacial',
    name: 'Glacial',
    description: 'Deep Arctic palette · Neumorphic soft shadows · Solid Snow Texture base · Login with arctic aerial photo.',
    font: 'Inter',
    wip: true,
    preview: {
      bg: '#E8EDF2',
      surface: '#E8EDF2',
      accent: '#1A426E',
      text: '#2D3A4B',
      border: 'rgba(255,255,255,0.82)',
      sketchLine: 'rgba(26,66,110,0.18)',
    },
    cssVars: {
      '--ms-bg': '#E8EDF2',
      '--ms-bg-warm': '#DDE4EC',
      '--ms-surface': '#E8EDF2',
      '--ms-surface-dim': '#DDE4EC',
      '--ms-border': 'rgba(26, 66, 110, 0.12)',
      '--ms-border-light': 'rgba(26, 66, 110, 0.07)',
      '--ms-text': '#2D3A4B',
      '--ms-text-secondary': 'rgba(45, 58, 75, 0.72)',
      '--ms-text-muted': 'rgba(45, 58, 75, 0.45)',
      '--ms-sketch-line': 'transparent',
      '--ms-accent': '#1A426E',
      '--ms-accent-hover': '#112C4B',
      '--ms-accent-light': '#7699C2',
      '--ms-accent-bg': 'rgba(26, 66, 110, 0.08)',
      '--ms-success': '#4A8B8B',
      '--ms-success-bg': 'rgba(74, 139, 139, 0.10)',
      '--ms-danger': '#C28B8B',
      '--ms-danger-bg': 'rgba(194, 139, 139, 0.10)',
      '--ms-info': '#7699C2',
      '--ms-info-bg': 'rgba(118, 153, 194, 0.10)',
    },
  },
  {
    id: 'solid-vintage',
    name: 'Soft Travel Journal',
    description: 'Warm cream paper, tabby orange accents, soft rounded cards, and a friendly travel-journal feel.',
    font: 'DM Sans / Inter',
    preview: {
      bg: '#fff7ed',
      surface: '#fffaf3',
      accent: '#d9782d',
      text: '#32241c',
      border: '#ead8c0',
      sketchLine: '#d9b98f',
    },
    cssVars: {
      '--ms-bg': '#fff7ed',
      '--ms-bg-warm': '#f8ead8',
      '--ms-surface': '#fffaf3',
      '--ms-surface-dim': '#f6eadb',
      '--ms-border': '#ead8c0',
      '--ms-border-light': '#f3e5d2',
      '--ms-text': '#32241c',
      '--ms-text-secondary': '#765a45',
      '--ms-text-muted': '#a9876a',
      '--ms-sketch-line': '#d9b98f',
      '--ms-accent': '#d9782d',
      '--ms-accent-hover': '#bd6120',
      '--ms-accent-light': '#f1b06f',
      '--ms-accent-bg': 'rgba(217, 120, 45, 0.12)',
      '--ms-success': '#5f8a64',
      '--ms-success-bg': 'rgba(95, 138, 100, 0.10)',
      '--ms-danger': '#b65a45',
      '--ms-danger-bg': 'rgba(182, 90, 69, 0.10)',
      '--ms-info': '#5d7f9f',
      '--ms-info-bg': 'rgba(93, 127, 159, 0.10)',
    },
  },
  {
    id: 'calling-of-dungeons',
    name: 'Calling of Dungeons',
    description: 'Silver-gray palette, teal accent, solid rounded borders, Inter + DM Sans typefaces, dark outer frame.',
    font: 'Inter / DM Sans',
    wip: true,
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

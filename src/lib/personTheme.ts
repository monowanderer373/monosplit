import type { CSSProperties } from 'react'

export const PERSON_COLOR_PALETTE = [
  '#EB6662',
  '#DE6FA3',
  '#DAA2CC',
  '#F1CB71',
  '#E8E88D',
  '#A3D47E',
  '#67C9BE',
  '#57B8B4',
  '#74C1E5',
  '#9088E2',
  '#8E4068',
  '#CD5F85',
  '#E28469',
  '#EEB06D',
  '#ECD480',
  '#AFC48F',
  '#85BFAA',
  '#8BCAC3',
  '#86AFCB',
  '#756CB0',
  '#951619',
  '#B12E1E',
  '#CF6034',
  '#E09F37',
  '#878A36',
  '#95AE72',
  '#8FB7A7',
  '#588EA0',
  '#2E677D',
  '#0E2C59',
]

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim()
  if (!/^[\da-fA-F]{6}$/.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function relativeLuminance(r: number, g: number, b: number): number {
  const conv = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * conv(r) + 0.7152 * conv(g) + 0.0722 * conv(b)
}

export function isLightNameColor(color: string | null | undefined): boolean {
  if (!color) return false
  const rgb = hexToRgb(color)
  if (!rgb) return false
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.62
}

export function getPersonNameStyle(person: { nameColor?: string | null } | null | undefined): CSSProperties {
  const color = person?.nameColor || undefined
  if (!color) return {}
  if (!isLightNameColor(color)) return { color }
  return {
    color,
    textShadow: '-0.5px 0 rgba(30,41,59,0.5), 0.5px 0 rgba(30,41,59,0.5), 0 -0.5px rgba(30,41,59,0.5), 0 0.5px rgba(30,41,59,0.5)',
  }
}


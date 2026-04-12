import type { CSSProperties } from 'react'

// Name color is fixed to the theme text color — always returns empty style
export function getPersonNameStyle(_person?: { nameColor?: string | null } | null): CSSProperties {
  return {}
}


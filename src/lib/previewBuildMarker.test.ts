import { describe, expect, it } from 'vitest'
import { previewBuildMarker } from './previewBuildMarker'

describe('previewBuildMarker', () => {
  it('stays off production builds', () => {
    expect(previewBuildMarker('production')).toBeNull()
  })

  it('marks preview and local builds with the investigated commit', () => {
    expect(previewBuildMarker('preview')).toBe('83d159b')
    expect(previewBuildMarker('development')).toBe('83d159b')
    expect(previewBuildMarker(undefined)).toBe('83d159b')
  })
})

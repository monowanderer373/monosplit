export const PREVIEW_BUILD_MARKER = '83d159b'

export function previewBuildMarker(environment: string | undefined): string | null {
  if (environment === 'production') return null
  return PREVIEW_BUILD_MARKER
}

export function applyPreviewBuildMarker(environment: string | undefined): void {
  const marker = previewBuildMarker(environment)
  if (!marker || typeof document === 'undefined') return
  document.documentElement.dataset.tabbyBuild = marker
  console.info('tabby-build', marker)
}

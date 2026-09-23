import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPreviewBuildMarker } from './lib/previewBuildMarker'
import { initializeObservability } from './lib/telemetry'

applyPreviewBuildMarker(
  typeof __TABBY_TALLY_DEPLOYMENT_ENVIRONMENT__ === 'string'
    ? __TABBY_TALLY_DEPLOYMENT_ENVIRONMENT__
    : undefined,
)
initializeObservability()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

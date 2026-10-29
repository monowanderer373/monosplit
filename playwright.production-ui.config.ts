import {defineConfig} from '@playwright/test'
import base from './playwright.config'

// The visual harness changes the lazy chunk graph and CSS insertion order.
// Exercise the actual production graph as well as the harness-enabled suite.
if (!base.webServer || Array.isArray(base.webServer)) throw new Error('Inspect web server configuration')
export default defineConfig({
 ...base,
 testMatch: ['home-notifications.spec.ts','notifications-a.spec.ts','notification-row-layout.spec.ts','multicurrency-ui.spec.ts','home-account-actions.spec.ts','startup-performance.spec.ts','quick-add-compact.spec.ts','quick-add-v3.spec.ts','me-v2-ui.spec.ts','shared-restart-ui.spec.ts','trip-members-ui.spec.ts','trip-split-ui.spec.ts','trip-dates-ui.spec.ts', 'trip-ledger-ui.spec.ts'],
 webServer: {...base.webServer,env:{...base.webServer.env,VITE_HOME_VISUAL:'0'},reuseExistingServer:false},
})

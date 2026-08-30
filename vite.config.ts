import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'TabbyTally',
        short_name: 'TabbyTally',
        description: 'Split travel costs with friends, then settle everything in one clear statement.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff7ed',
        theme_color: '#d9782d',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Quick tally',
            short_name: 'Add expense',
            description: 'Open amount-first personal expense capture.',
            url: '/quick-add?source=pwa-shortcut',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,woff,woff2}', 'icon-*.png'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase') || id.includes('/ws/')) return 'vendor-supabase'
          if (id.includes('@sentry')) return 'vendor-observability'
          if (id.includes('tesseract.js')) return 'vendor-ocr'
          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('react-router')
            || id.includes('/zustand/')
          ) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})

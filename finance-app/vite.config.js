import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'AlCash - Finanzas Inteligentes',
        short_name: 'AlCash',
        description: 'Gestión de finanzas personales',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        scope: '/AlCash/',
        start_url: '/AlCash/',
        icons: [
          {
            src: '/AlCash/alcash-favicon-v3.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base: '/AlCash/',
})

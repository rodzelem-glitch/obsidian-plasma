
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        manifest: {
          name: 'TekTrakker Technician App',
          short_name: 'TekTrakker',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
             {
                urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'firebase-firestore-cache',
                  expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] }
                }
             }
          ]
        }
      })
    ],
    optimizeDeps: {
      include: ['react-signature-canvas'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'components': path.resolve(__dirname, './src/components'),
        'context': path.resolve(__dirname, './src/context'),
        'pages': path.resolve(__dirname, './src/pages'),
        'lib': path.resolve(__dirname, './src/lib'),
        'hooks': path.resolve(__dirname, './src/hooks'),
        '@constants': path.resolve(__dirname, './src/constants/constants.ts'),
        'pricebooks': path.resolve(__dirname, './src/lib/pricebooks/index.ts'),
        'types': path.resolve(__dirname, './src/types/types.ts'),
        '@types': path.resolve(__dirname, './src/types/types.ts'),
      }
    },
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/compat/app', 'firebase/compat/auth', 'firebase/compat/firestore', 'firebase/compat/functions', 'firebase/compat/storage']
          }
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 9000
    },
    preview: {
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: true
    }
  }
})

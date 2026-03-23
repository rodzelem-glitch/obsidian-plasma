
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  return {
    plugins: [react()],
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
      emptyOutDir: true
    },
    server: {
      host: '0.0.0.0',
      port: 9000,
      hmr: {
        protocol: 'wss',
        host: '9000-firebase-tektrakker-v2git-1765277578559.cluster-44kx2eiocbhe2tyk3zoyo3ryuo.cloudworkstations.dev',
        clientPort: 443
      }
    },
    preview: {
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: true
    }
  }
})

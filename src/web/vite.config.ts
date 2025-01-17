import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    tsconfigPaths({
      loose: false,
      extensions: ['.ts', '.tsx']
    })
  ],

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'Connection': 'keep-alive'
        }
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        secure: false,
        headers: {
          'Upgrade': 'websocket'
        }
      }
    },
    cors: {
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          utils: ['lodash', 'date-fns', 'uuid']
        }
      }
    }
  },

  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@hooks': '/src/hooks', 
      '@services': '/src/services',
      '@store': '/src/store',
      '@utils': '/src/utils',
      '@styles': '/src/styles',
      '@assets': '/src/assets',
      '@config': '/src/config',
      '@interfaces': '/src/interfaces'
    }
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      'lodash',
      'date-fns'
    ],
    exclude: ['@fsouza/prettierd'],
    esbuildOptions: {
      target: 'esnext',
      supported: {
        bigint: true
      }
    }
  }
});
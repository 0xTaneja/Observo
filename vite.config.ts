import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dotenv from 'dotenv'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

// Load environment variables
dotenv.config()

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
      jsxImportSource: 'react'
    }),
    // Plugin to copy manifest and public files
    {
      name: 'copy-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync('public/manifest.json', 'dist/manifest.json')
        
        // Copy icon.svg
        copyFileSync('public/icon.svg', 'dist/icon.svg')
        
        // Copy popup HTML and CSS
        if (!existsSync('dist/popup')) {
          mkdirSync('dist/popup')
        }
        copyFileSync('src/popup/index.html', 'dist/popup/index.html')
        copyFileSync('src/popup/popup.css', 'dist/popup/popup.css')
        
        // Copy details page files
        copyFileSync('src/popup/details.html', 'dist/popup/details.html')
        copyFileSync('src/popup/details.css', 'dist/popup/details.css')
        copyFileSync('src/details.js', 'dist/details.js')
        
        // Copy icons and images directories if they exist
        if (existsSync('public/icons')) {
          if (!existsSync('dist/icons')) {
            mkdirSync('dist/icons', { recursive: true })
          }
          // Copy icons if they exist
        }
        
        if (existsSync('public/images')) {
          if (!existsSync('dist/images')) {
            mkdirSync('dist/images', { recursive: true })
          }
          // Copy images if they exist
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.tsx'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    outDir: 'dist',
    sourcemap: false,
    minify: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY),
    'process.env.OKX_API_KEY': JSON.stringify(process.env.OKX_API_KEY),
    'process.env.OKX_SECRET_KEY': JSON.stringify(process.env.OKX_SECRET_KEY),
    'process.env.OKX_PASSPHRASE': JSON.stringify(process.env.OKX_PASSPHRASE),
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
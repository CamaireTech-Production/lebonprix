import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'public/',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      // Configuration pour éviter l'erreur de remapping
      all: false,
      include: ['src/**/*.{ts,tsx}'],
      // Désactiver le remapping après exclusion pour éviter l'erreur
      excludeAfterRemap: false,
      clean: true,
      cleanOnRerun: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})


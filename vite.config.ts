import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Sajten ligger på https://freddefraggel.github.io/julmingel/ (specen säger /glogg/, men /julmingel/ gäller).
export default defineConfig({
  base: '/julmingel/',
  plugins: [react()],
  server: {
    // Spotify redirect-URI för utveckling är http://127.0.0.1:5173/julmingel/ (måste matcha exakt).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})

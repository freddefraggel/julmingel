import { defineConfig } from 'vitest/config'

// Regeltester mot Firebase Emulator Suite. Körs med npm run test:rules,
// som startar databasemulatorn och kör testerna i den.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
  },
})

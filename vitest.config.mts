import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    env: { DATA_SOURCE: 'memory', UAU_MODE: 'mock' },
  },
})

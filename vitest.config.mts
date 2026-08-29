import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Everything under test is plain TypeScript: the native module is mocked, so no react-native
    // or expo resolution is involved.
    environment: 'node',
    include: ['src/**/*.test.ts', 'plugin/src/**/*.test.ts'],
  },
})

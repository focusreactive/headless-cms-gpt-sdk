import { defineConfig } from 'vitest/config'

export default defineConfig({
  // `tsconfig.json` says `"jsx": "preserve"` because Next transforms it at build time with
  // the automatic runtime. Without this the test run falls back to the classic transform
  // and every component that does not import React by name fails to render.
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})

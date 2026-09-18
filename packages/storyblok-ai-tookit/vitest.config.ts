import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  // `tsconfig.json` says `"jsx": "preserve"` because Next transforms it at build time with
  // the automatic runtime. Without this the test run falls back to the classic transform
  // and every component that does not import React by name fails to render.
  esbuild: { jsx: 'automatic' },
  // The same alias `tsconfig.json` gives the compiler. Next reads it from there; Vite does
  // not, so a file importing `@src/...` fails to resolve under test and nowhere else.
  resolve: {
    alias: { '@src': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})

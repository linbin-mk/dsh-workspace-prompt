import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const stub = (name: string): string =>
  fileURLToPath(new URL(`./tests/stubs/${name}.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-llm': stub('dsh-llm'),
      // Exact match only: the icons the chip renders come from this package's
      // root entry, never from a subpath.
      '@deepseek-ai/dsh-client-ui-primitives': stub('dsh-client-ui-primitives'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
})

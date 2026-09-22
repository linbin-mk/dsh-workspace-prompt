import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const stub = (name: string): string =>
  fileURLToPath(new URL(`./tests/stubs/${name}.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-llm': stub('dsh-llm'),
      '@deepseek-ai/dsh-settings': stub('dsh-settings'),
      '@deepseek-ai/schemastery': stub('dsh-schemastery'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
})

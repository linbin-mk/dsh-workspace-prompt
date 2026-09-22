/**
 * Test-time stubs for the harness packages the host half imports as values.
 *
 * The plugin resolves the real `@deepseek-ai/*` packages from the running
 * `dsh web` profile; the unit suite must not depend on that resolution, so the
 * vitest config aliases each value-importing package here. Types are erased by
 * the transpiler, so only the runtime symbols `apply` and `buildMessage`
 * actually touch need stand-ins.
 */

/** Freeze a value and everything reachable from it, as the harness constructor does. */
function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export function createUserMessage(input: {
  content: readonly unknown[]
  source: unknown
}): { id: string; role: 'user'; content: readonly unknown[]; source: unknown } {
  return deepFreeze(structuredClone({
    ...input,
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user' as const,
  }))
}

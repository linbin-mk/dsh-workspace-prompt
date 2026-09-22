/**
 * Test-time stand-in for `@deepseek-ai/schemastery`.
 *
 * Only the schema builders the host half calls while defining its Config need
 * to exist: the unit suite reads the live `Volatile` references it constructs
 * itself, so the schema object never validates anything. Every modifier stays
 * chainable, so a new `.default(...)` / `.volatile()` in the Config schema
 * cannot turn the suite red for reasons the suite does not test.
 */

/** One chainable field schema: every modifier returns the same schema. */
function field(): Record<string, unknown> {
  const schema: Record<string, unknown> = {}
  schema.default = () => schema
  schema.volatile = () => schema
  return schema
}

export default {
  object: (_schema: unknown): Record<string, unknown> => field(),
  dict: (_inner: unknown): Record<string, unknown> => field(),
  string: (): Record<string, unknown> => field(),
}

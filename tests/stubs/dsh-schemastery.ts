const chainable = (): { default: (value: unknown) => Record<string, unknown> } => ({
  default: () => ({}),
})

export default {
  object: (_schema: unknown): Record<string, unknown> => ({}),
  dict: chainable,
  string: chainable,
  default: <T>(value: T): T => value,
}

/**
 * Which language a host-originated question speaks (host half).
 *
 * A question asked through `ctx.userQuestions` carries literal copy — the
 * protocol has no dictionary channel — so the Host must choose one language
 * before it asks. That language is the web UI's: an explicit
 * `locale.preference` in the settings document wins, and a browser that never
 * selected one is followed through the Host's system locale, which is what the
 * browser's own default resolves from in the local `dsh web` deployment.
 *
 * Pure by construction: the tag mapping, the preference read, and the system
 * probe carry no Cordis runtime, so the choice is unit-testable without
 * booting an app.
 */

/** A language this plugin ships question copy for. */
export type UiLanguage = 'zh' | 'en'

/** Profile entry id owning the web locale preference. */
export const LOCALE_ENTRY_ID = 'locale'

/** Config field carrying the explicit locale selection. */
export const LOCALE_PREFERENCE_FIELD = 'preference'

/**
 * Map one BCP 47-style tag to a language this plugin ships copy for.
 *
 * Only Chinese is recognized as itself: every other tag — including a
 * language-pack id such as `ja` — falls back to English, the copy's base
 * language.
 * @param tag - a locale tag such as `zh`, `zh-CN`, `en-US`; may be empty.
 * @returns the language to render question copy in.
 */
export function languageOf(tag: string | undefined): UiLanguage {
  if (tag === undefined) return 'en'
  return /^zh(?:[-_]|$)/iu.test(tag.trim()) ? 'zh' : 'en'
}

/**
 * Choose the copy language: the explicit UI preference first, then the Host
 * system locale, then English.
 * @param preference - the stored `locale.preference`, if any.
 * @param systemTags - Host system language tags, most preferred first.
 * @returns the language to render question copy in.
 */
export function resolveLanguage(
  preference: string | undefined,
  systemTags: readonly (string | undefined)[],
): UiLanguage {
  const explicit = preference?.trim() ?? ''
  if (explicit !== '') return languageOf(explicit)
  for (const tag of systemTags) {
    const candidate = tag?.trim() ?? ''
    if (candidate !== '') return languageOf(candidate)
  }
  return 'en'
}

/** The parts of one settings descriptor this module reads. */
export interface SettingsSection {
  /** Profile entry id (the settings namespace). */
  ns: string
  /** Resolved live configuration of that entry. */
  value?: unknown
}

/**
 * Read the explicit locale preference out of the Host settings descriptors.
 *
 * The document is user-editable, so the section is narrowed rather than
 * trusted: a missing entry, a non-object value, or a non-string preference
 * yields no explicit choice and the system locale decides.
 * @param descriptors - the Host settings descriptors.
 * @returns the stored preference, or undefined when the browser derives one.
 */
export function languagePreference(descriptors: readonly SettingsSection[]): string | undefined {
  const value = descriptors.find(entry => entry.ns === LOCALE_ENTRY_ID)?.value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const preference = (value as Record<string, unknown>)[LOCALE_PREFERENCE_FIELD]
  return typeof preference === 'string' ? preference : undefined
}

/**
 * The Host system's language tags, most preferred first.
 *
 * `Intl` is the platform's own locale (the system language on desktop, the
 * `LC_*` environment on a terminal launch). The environment is only consulted
 * when `Intl` is unavailable, so a shell override cannot outrank the platform.
 * @returns candidate tags; empty when neither source reports one.
 */
export function systemLanguageTags(): string[] {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    if (locale.trim() !== '') return [locale]
  } catch {
    // A runtime without a usable Intl still has the environment.
  }
  const environment = (globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }).process?.env
  for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const value = environment?.[name]?.replace(/\..*$/u, '').replace('_', '-')
    if (value !== undefined && value !== '') return [value]
  }
  return []
}

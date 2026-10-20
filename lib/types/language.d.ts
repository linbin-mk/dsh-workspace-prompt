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
export type UiLanguage = 'zh' | 'en';
/** Profile entry id owning the web locale preference. */
export declare const LOCALE_ENTRY_ID = "locale";
/** Config field carrying the explicit locale selection. */
export declare const LOCALE_PREFERENCE_FIELD = "preference";
/**
 * Map one BCP 47-style tag to a language this plugin ships copy for.
 *
 * Only Chinese is recognized as itself: every other tag — including a
 * language-pack id such as `ja` — falls back to English, the copy's base
 * language.
 * @param tag - a locale tag such as `zh`, `zh-CN`, `en-US`; may be empty.
 * @returns the language to render question copy in.
 */
export declare function languageOf(tag: string | undefined): UiLanguage;
/**
 * Choose the copy language: the explicit UI preference first, then the Host
 * system locale, then English.
 * @param preference - the stored `locale.preference`, if any.
 * @param systemTags - Host system language tags, most preferred first.
 * @returns the language to render question copy in.
 */
export declare function resolveLanguage(preference: string | undefined, systemTags: readonly (string | undefined)[]): UiLanguage;
/** The parts of one settings descriptor this module reads. */
export interface SettingsSection {
    /** Profile entry id (the settings namespace). */
    ns: string;
    /** Resolved live configuration of that entry. */
    value?: unknown;
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
export declare function languagePreference(descriptors: readonly SettingsSection[]): string | undefined;
/**
 * The Host system's language tags, most preferred first.
 *
 * `Intl` is the platform's own locale (the system language on desktop, the
 * `LC_*` environment on a terminal launch). The environment is only consulted
 * when `Intl` is unavailable, so a shell override cannot outrank the platform.
 * @returns candidate tags; empty when neither source reports one.
 */
export declare function systemLanguageTags(): string[];

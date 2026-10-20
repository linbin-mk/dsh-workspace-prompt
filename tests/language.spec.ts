/** Copy-language selection: tag mapping, preference read, and the system fallback. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { languageOf, languagePreference, resolveLanguage, systemLanguageTags } from '../src/language.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('languageOf', () => {
  it('recognizes every Chinese tag', () => {
    expect(languageOf('zh')).toBe('zh')
    expect(languageOf('zh-CN')).toBe('zh')
    expect(languageOf('zh-Hans-CN')).toBe('zh')
    expect(languageOf(' zh_TW ')).toBe('zh')
  })

  it('treats every other tag as English, the copy base language', () => {
    expect(languageOf('en')).toBe('en')
    expect(languageOf('en-US')).toBe('en')
    expect(languageOf('ja')).toBe('en')
    expect(languageOf('')).toBe('en')
    expect(languageOf(undefined)).toBe('en')
  })
})

describe('resolveLanguage', () => {
  it('lets an explicit preference outrank the system locale', () => {
    expect(resolveLanguage('zh-CN', ['en-US'])).toBe('zh')
    expect(resolveLanguage('en', ['zh-CN'])).toBe('en')
    expect(resolveLanguage('ja', ['zh-CN'])).toBe('en')
  })

  it('follows the first reported system tag when no preference is stored', () => {
    expect(resolveLanguage(undefined, ['zh-CN'])).toBe('zh')
    expect(resolveLanguage(undefined, ['en-US', 'zh-CN'])).toBe('en')
    expect(resolveLanguage('   ', ['zh-CN'])).toBe('zh')
    expect(resolveLanguage(undefined, ['', 'zh-CN'])).toBe('zh')
  })

  it('falls back to English when nothing reports a language', () => {
    expect(resolveLanguage(undefined, [])).toBe('en')
    expect(resolveLanguage(undefined, [undefined, ''])).toBe('en')
  })
})

describe('languagePreference', () => {
  it('reads the locale section out of the settings descriptors', () => {
    expect(languagePreference([{ ns: 'locale', value: { preference: 'zh' } }])).toBe('zh')
    expect(languagePreference([
      { ns: 'ui-settings', value: { enabled: true } },
      { ns: 'locale', value: { preference: 'en-US' } },
    ])).toBe('en-US')
  })

  it('reports no explicit choice for a missing or malformed section', () => {
    expect(languagePreference([])).toBeUndefined()
    expect(languagePreference([{ ns: 'locale' }])).toBeUndefined()
    expect(languagePreference([{ ns: 'locale', value: null }])).toBeUndefined()
    expect(languagePreference([{ ns: 'locale', value: ['zh'] }])).toBeUndefined()
    expect(languagePreference([{ ns: 'locale', value: { preference: 1 } }])).toBeUndefined()
  })
})

describe('systemLanguageTags', () => {
  it('reports the platform locale', () => {
    expect(systemLanguageTags()[0]).toEqual(expect.any(String))
    expect(systemLanguageTags()[0]).not.toBe('')
  })

  it('falls back to the shell locale when Intl is unusable', () => {
    vi.stubGlobal('Intl', {
      DateTimeFormat: () => { throw new Error('no ICU') },
    })
    vi.stubEnv('LC_ALL', 'zh_CN.UTF-8')
    vi.stubEnv('LANG', 'en_US.UTF-8')
    expect(systemLanguageTags()).toEqual(['zh-CN'])
  })

  it('prefers LC_ALL over LC_MESSAGES and LANG', () => {
    vi.stubGlobal('Intl', {
      DateTimeFormat: () => { throw new Error('no ICU') },
    })
    vi.stubEnv('LC_ALL', '')
    vi.stubEnv('LC_MESSAGES', 'zh_TW.UTF-8')
    vi.stubEnv('LANG', 'en_US.UTF-8')
    expect(systemLanguageTags()).toEqual(['zh-TW'])
  })
})

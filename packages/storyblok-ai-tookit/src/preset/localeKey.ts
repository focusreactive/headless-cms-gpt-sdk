/**
 * The key `byLocale` uses. The translation flow builds `__i18n__<code>` with the first
 * hyphen replaced, so `pt-br` is stored as `pt_br`; only the first hyphen, to match that
 * flow.
 */
export type LocaleKey = (code: string) => string

export const localeKey: LocaleKey = (code) => code.replace('-', '_')

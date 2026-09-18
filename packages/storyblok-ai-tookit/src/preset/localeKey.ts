/**
 * The key a preset's `byLocale` uses for one of the space's languages.
 *
 * The translation flow replaces a hyphen with an underscore before building the
 * `__i18n__<code>` field name, and §3b keys `byLocale` by that same code — so a space whose
 * language is `pt-br` keeps its style under `pt_br`. A screen listing the space's languages
 * has to normalise before looking one up, or every hyphenated language reads as not
 * configured.
 *
 * It replaces the first hyphen and no more, because that is what the reducer does and
 * matching it matters more here than being thorough.
 */
export type LocaleKey = (code: string) => string

export const localeKey: LocaleKey = (code) => code.replace('-', '_')

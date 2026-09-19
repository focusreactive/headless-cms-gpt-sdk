import { localeKey } from './localeKey'
import type { LanguageCode, LocaleStyle, PresetId, StyleSettings } from './preset.types'
import { resolveStyle } from './presetSet'

/**
 * What the editor has said about which preset to use.
 *
 * Three states and not two. "Nothing said yet, so the space's default applies" is a
 * different thing from "no preset at all", and a nullable id cannot tell them apart —
 * which would make choosing "No preset" unobservable, because the screen would remember
 * nothing and go on showing the default.
 */
export type PresetChoice = { said: false } | { said: true; preset: PresetId | null }

/** Which preset the editor has asked for: what they said, or the space's default. */
export type AskedFor = (
  choice: PresetChoice,
  settings: StyleSettings | null,
) => PresetId | null

/**
 * The style a translation into `locale` should use, or `null` for none.
 *
 * One place, because two ask: the picker, to warn that the chosen preset says nothing for
 * this language, and the translation itself, to say what it says. Those two disagreeing
 * would mean a panel promising a voice the translation never used.
 *
 * `locale` is the space's own code; normalising it to the key `byLocale` uses happens
 * here.
 */
export type StyleFor = (
  settings: StyleSettings | null,
  choice: PresetChoice,
  locale: LanguageCode,
) => LocaleStyle | null

export const askedFor: AskedFor = (choice, settings) =>
  choice.said ? choice.preset : settings?.defaultId ?? null

export const styleFor: StyleFor = (settings, choice, locale) => {
  const wanted = askedFor(choice, settings)

  if (settings === null || wanted === null) {
    return null
  }

  return resolveStyle(settings, wanted, localeKey(locale))
}

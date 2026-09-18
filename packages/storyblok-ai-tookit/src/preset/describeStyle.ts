import type { Formality, LocaleStyle } from './preset.types'

/**
 * The style, said in the words the model will be given.
 *
 * The form's Preview shows exactly this, which is the point: an editor should be able to
 * read what their settings will ask for before a translation runs. **Nothing sends it
 * yet** — prompt composition is a later step by the owner's decision — and when that step
 * comes it should call this rather than grow a second wording, because two wordings mean
 * the preview eventually lies.
 *
 * Each part is a sentence and an empty part contributes none, so a style saying nothing
 * gives just `Translate into <language>.`
 */
export type DescribeStyle = (language: string, style: LocaleStyle) => string

const ADDRESS: Record<Formality, string> = {
  neutral: '',
  formal: ' using formal address',
  informal: ' using informal address',
}

export const describeStyle: DescribeStyle = (language, style) => {
  const words = (style.voice ?? [])
    .map((entry) => entry.word.trim())
    .filter((word) => word !== '')
  const instructions = (style.instructions ?? '').trim()

  return [
    `Translate into ${language}${ADDRESS[style.formality ?? 'neutral']}.`,
    words.length > 0 ? `Voice: ${words.join(', ')}.` : '',
    instructions,
  ]
    .filter((part) => part !== '')
    .join(' ')
}

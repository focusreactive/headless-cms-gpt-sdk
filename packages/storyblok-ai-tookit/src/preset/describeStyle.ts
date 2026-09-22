import type { Formality, LocaleStyle } from './preset.types'

/**
 * The style as the sentence the model is given. Empty parts are dropped, so a style saying
 * nothing gives just `Translate into <language>.`
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

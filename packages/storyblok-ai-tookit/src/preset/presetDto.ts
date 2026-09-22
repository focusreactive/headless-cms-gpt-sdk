import type {
  Formality,
  LocaleStyle,
  StylePreset,
  StyleSettings,
  ToSettings,
  ToStored,
  VoiceWord,
} from './preset.types'

const FORMALITIES: readonly unknown[] = ['neutral', 'formal', 'informal']

// `typeof null` is 'object' and so is an array: both have to be ruled out by hand for
// "not a plain object" to mean what the contract says it means.
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readVoice = (value: unknown): VoiceWord[] =>
  Array.isArray(value)
    ? value.flatMap((element) =>
        isPlainObject(element) && typeof element.word === 'string'
          ? [{ word: element.word }]
          : [],
      )
    : []

const readLocaleStyle = (entry: Record<string, unknown>): LocaleStyle => {
  const style: LocaleStyle = {}

  if (FORMALITIES.includes(entry.formality)) {
    style.formality = entry.formality as Formality
  }

  if ('voice' in entry) {
    style.voice = readVoice(entry.voice)
  }

  if ('instructions' in entry) {
    style.instructions =
      typeof entry.instructions === 'string' ? entry.instructions : ''
  }

  return style
}

const readByLocale = (value: unknown): Record<string, LocaleStyle> => {
  if (!isPlainObject(value)) {
    return {}
  }

  const byLocale: Record<string, LocaleStyle> = {}

  for (const [code, entry] of Object.entries(value)) {
    if (isPlainObject(entry)) {
      byLocale[code] = readLocaleStyle(entry)
    }
  }

  return byLocale
}

export const toSettings: ToSettings = (stored) => {
  if (!isPlainObject(stored) || !Array.isArray(stored.items)) {
    return { items: [] }
  }

  const items: StylePreset[] = []
  const taken = new Set<string>()

  for (const element of stored.items) {
    if (!isPlainObject(element)) {
      continue
    }

    const id = element.id

    if (typeof id !== 'string' || id.trim() === '' || taken.has(id)) {
      continue
    }

    taken.add(id)
    items.push({
      id,
      name: typeof element.name === 'string' ? element.name : '',
      byLocale: readByLocale(element.byLocale),
    })
  }

  return typeof stored.defaultId === 'string'
    ? { defaultId: stored.defaultId, items }
    : { items }
}

const copyLocaleStyle = (style: LocaleStyle): LocaleStyle => {
  const copy: LocaleStyle = {}

  if (style.formality !== undefined) {
    copy.formality = style.formality
  }

  if (style.voice !== undefined) {
    copy.voice = style.voice.map((entry) => ({ word: entry.word }))
  }

  if (style.instructions !== undefined) {
    copy.instructions = style.instructions
  }

  return copy
}

export const toStored: ToStored = (settings) => {
  const items = settings.items.map((preset) => ({
    id: preset.id,
    name: preset.name,
    byLocale: Object.fromEntries(
      Object.entries(preset.byLocale).map(([code, style]) => [
        code,
        copyLocaleStyle(style),
      ]),
    ),
  }))

  return settings.defaultId === undefined
    ? { items }
    : { defaultId: settings.defaultId, items }
}

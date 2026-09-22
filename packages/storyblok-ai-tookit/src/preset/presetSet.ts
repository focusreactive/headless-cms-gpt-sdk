import type {
  LocaleStyle,
  PresetDraft,
  RemovePreset,
  ResolveStyle,
  SavePreset,
  SaysNothing,
  SetDefaultPreset,
  StylePreset,
  StyleSettings,
} from './preset.types'

const withItems = (settings: StyleSettings, items: StylePreset[]): StyleSettings =>
  settings.defaultId === undefined
    ? { items }
    : { defaultId: settings.defaultId, items }

export const saysNothing: SaysNothing = (style) =>
  (style.instructions ?? '').trim() === '' &&
  (style.voice ?? []).every((entry) => entry.word.trim() === '') &&
  (style.formality === undefined || style.formality === 'neutral')

/** `null` for a draft that says nothing — the caller removes the language rather than writing it. */
const entryOf = (draft: PresetDraft): LocaleStyle | null => {
  const voice = (draft.voice ?? [])
    .map((entry) => ({ word: entry.word.trim() }))
    .filter((entry) => entry.word !== '')
  const instructions = (draft.instructions ?? '').trim()

  const style: LocaleStyle = {}

  if (draft.formality !== undefined) {
    style.formality = draft.formality
  }

  if (voice.length > 0) {
    style.voice = voice
  }

  if (instructions !== '') {
    style.instructions = instructions
  }

  return saysNothing(style) ? null : style
}

export const savePreset: SavePreset = (settings, draft) => {
  const entry = entryOf(draft)
  const name = draft.name.trim()

  const byLocaleFrom = (existing: Record<string, LocaleStyle>) => {
    const byLocale = { ...existing }

    if (entry === null) {
      delete byLocale[draft.locale]
    } else {
      byLocale[draft.locale] = entry
    }

    return byLocale
  }

  const held = settings.items.some((preset) => preset.id === draft.id)

  return withItems(
    settings,
    held
      ? settings.items.map((preset) =>
          preset.id === draft.id
            ? { id: preset.id, name, byLocale: byLocaleFrom(preset.byLocale) }
            : preset,
        )
      : [...settings.items, { id: draft.id, name, byLocale: byLocaleFrom({}) }],
  )
}

export const removePreset: RemovePreset = (settings, id) => {
  const items = settings.items.filter((preset) => preset.id !== id)

  return items.length === settings.items.length ? settings : withItems(settings, items)
}

export const setDefaultPreset: SetDefaultPreset = (settings, id) => {
  if (settings.defaultId === id || !settings.items.some((preset) => preset.id === id)) {
    return settings
  }

  return { defaultId: id, items: settings.items }
}

export const resolveStyle: ResolveStyle = (settings, preset, locale) => {
  const style = settings.items.find((item) => item.id === preset)?.byLocale[locale]

  return style === undefined || saysNothing(style) ? null : style
}

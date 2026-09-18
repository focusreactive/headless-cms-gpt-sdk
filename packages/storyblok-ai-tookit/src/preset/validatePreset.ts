import {
  INSTRUCTIONS_MAX,
  VOICE_MAX,
  type PresetErrors,
  type ValidatePreset,
} from './preset.types'

export const validatePreset: ValidatePreset = (draft, siblings) => {
  const errors: PresetErrors = {}

  const name = draft.name.trim()

  if (name === '') {
    errors.name = { type: 'required' }
  } else if (
    siblings.some(
      (preset) =>
        preset.id !== draft.id &&
        preset.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    errors.name = { type: 'taken' }
  }

  // Code units, not characters: `length` is what the field's counter shows the person.
  if ((draft.instructions ?? '').length > INSTRUCTIONS_MAX) {
    errors.instructions = { type: 'tooLong' }
  }

  const words = (draft.voice ?? [])
    .map((entry) => entry.word.trim())
    .filter((word) => word !== '')

  if (words.length > VOICE_MAX) {
    errors.voice = { type: 'tooMany' }
  } else {
    const seen = new Set<string>()

    for (const word of words) {
      const key = word.toLowerCase()

      if (seen.has(key)) {
        errors.voice = { type: 'duplicate' }
        break
      }

      seen.add(key)
    }
  }

  return errors
}

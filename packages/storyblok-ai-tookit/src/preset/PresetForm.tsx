import type { language } from '@src/context/AppDataContext'

import type { LanguageCode, PresetId } from './preset.types'

/**
 * Which preset the form is for. A union rather than a nullable id beside a flag, so
 * "creating" and "editing this one" cannot both be claimed at once. The form mints the id
 * for a new preset itself, which is what makes saving it one operation.
 */
export type PresetFormTarget = { kind: 'new' } | { kind: 'existing'; preset: PresetId }

export type PresetFormProps = {
  languages: language[]
  /** The space's own code for the language being edited; for a new preset, where the select opens. */
  locale: LanguageCode
  target: PresetFormTarget
  /** Called when the form is finished with — saved, cancelled, or deleted. */
  onDone: () => void
}

export const PresetForm = (_props: PresetFormProps) => {
  throw new Error('not implemented — red run')
}

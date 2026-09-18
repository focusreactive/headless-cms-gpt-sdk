import { useState } from 'react'

import type { language } from '@src/context/AppDataContext'

import type { LanguageCode, PresetId } from './preset.types'
import { PresetForm, type PresetFormTarget } from './PresetForm'
import { PresetList } from './PresetList'

export type PresetsPanelProps = {
  languages: language[]
  /** The language being translated into: where the list opens and what the form edits. */
  locale: LanguageCode
  onClose: () => void
}

/**
 * Which of the two preset screens is showing, and for what. A union rather than a set of
 * flags, so "the form, for no preset and no language" cannot be expressed.
 */
type Showing =
  | { screen: 'list' }
  | { screen: 'form'; target: PresetFormTarget; locale: LanguageCode }

export const PresetsPanel = ({ languages, locale, onClose }: PresetsPanelProps) => {
  const [showing, setShowing] = useState<Showing>({ screen: 'list' })

  if (showing.screen === 'form') {
    return (
      <PresetForm
        languages={languages}
        locale={showing.locale}
        target={showing.target}
        onDone={() => setShowing({ screen: 'list' })}
      />
    )
  }

  return (
    <PresetList
      languages={languages}
      onClose={onClose}
      onCreate={() => setShowing({ screen: 'form', target: { kind: 'new' }, locale })}
      onOpen={(preset: PresetId, opened: LanguageCode) =>
        setShowing({ screen: 'form', target: { kind: 'existing', preset }, locale: opened })
      }
    />
  )
}

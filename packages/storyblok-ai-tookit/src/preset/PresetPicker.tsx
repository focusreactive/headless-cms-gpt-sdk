import { Box, MenuItem, Stack, Typography } from '@mui/material'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Select } from '../ui/Select'
import { localeKey } from './localeKey'
import type { LanguageCode, PresetId, StyleSettings } from './preset.types'
import { resolveStyle } from './presetSet'
import { usePresets } from './PresetsProvider'

/**
 * What the editor has said about which preset to use.
 *
 * Three states and not two. "Nothing said yet, so the space's default applies" is a
 * different thing from "no preset at all", and a nullable id cannot tell them apart —
 * which would make choosing "No preset" unobservable, because the screen would remember
 * nothing and go on showing the default.
 */
export type PresetChoice = { said: false } | { said: true; preset: PresetId | null }

export type PresetPickerProps = {
  /** The language being translated into, as the space's own code — normalised here, not by the caller. */
  locale: LanguageCode
  /** That language's name, for the messages that quote it. */
  localeName: string
  chosen: PresetChoice
  onChoose: (preset: PresetId | null) => void
  onManage: () => void
}

const NO_PRESET = ''

/** Which preset the editor has asked for: what they said, or the space's default. */
const asked = (chosen: PresetChoice, settings: StyleSettings | null) =>
  chosen.said ? chosen.preset : settings?.defaultId ?? null

/**
 * What the select shows, which is not always what was asked for.
 *
 * With no settings loaded it shows "No preset" whatever was remembered — a preset we have
 * not read cannot be named, and a row with no name would say less. Nothing is lost: the
 * choice lives in the screen around this one. Same for a preset that is no longer there,
 * deleted in another window: claiming it is still chosen would be the lie.
 *
 * The sentence below the field is about what was **asked for**, so it still reports that
 * nothing will be applied. **Whether that is the right sentence for a preset that has been
 * deleted is a design question, not one to invent here.**
 */
const showing = (chosen: PresetChoice, settings: StyleSettings | null) => {
  const wanted = asked(chosen, settings)

  if (settings === null || wanted === null) {
    return NO_PRESET
  }

  return settings.items.some((preset) => preset.id === wanted) ? wanted : NO_PRESET
}

const Gear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fillRule="evenodd"
      fill="currentColor"
      d="M12 3c1.247 0 2.33.697 2.883 1.722l.062.123c.276-.093.557-.15.845-.168l.216-.008a3.271 3.271 0 0 1 3.274 3.274c0 .362-.06.718-.175 1.054l-.011.029.21.106a3.273 3.273 0 0 1 1.69 2.682L21 12c0 1.247-.697 2.33-1.722 2.883l-.124.062c.094.276.15.557.17.845l.007.216a3.271 3.271 0 0 1-4.124 3.161l-.19-.057-.098.195a3.273 3.273 0 0 1-2.682 1.69L12.05 21a3.272 3.272 0 0 1-2.883-1.722l-.071-.141-.049.02a3.33 3.33 0 0 1-.838.166l-.216.008a3.271 3.271 0 0 1-3.161-4.124l.056-.19-.194-.098a3.273 3.273 0 0 1-1.69-2.682L3 12.05c0-1.247.697-2.33 1.722-2.883l.14-.071-.018-.049a3.272 3.272 0 0 1-.167-.838l-.008-.216A3.271 3.271 0 0 1 7.943 4.72c.362 0 .718.06 1.054.17l.029.01.106-.21a3.273 3.273 0 0 1 2.682-1.69zm0 2c-.703 0-1.273.57-1.273 1.273v.108a1.05 1.05 0 0 1-.636.96h-.051a1.05 1.05 0 0 1-1.158-.21l-.038-.037a1.273 1.273 0 1 0-1.801 1.8l.038.039c.3.307.383.765.21 1.158a1.05 1.05 0 0 1-.961.687h-.057a1.273 1.273 0 0 0 0 2.546h.108c.418.001.796.251.96.636.174.393.091.851-.21 1.158l-.037.038a1.273 1.273 0 1 0 1.8 1.801l.039-.038a1.05 1.05 0 0 1 1.158-.21c.405.149.677.53.687.961v.057a1.273 1.273 0 1 0 2.546 0v-.108a1.05 1.05 0 0 1 .636-.96 1.05 1.05 0 0 1 1.158.21l.038.037a1.273 1.273 0 1 0 1.801-1.8l-.038-.039a1.05 1.05 0 0 1-.21-1.158 1.05 1.05 0 0 1 .961-.636h.057a1.273 1.273 0 1 0 0-2.546h-.108a1.05 1.05 0 0 1-.96-.636v-.051a1.05 1.05 0 0 1 .21-1.158l.037-.038a1.273 1.273 0 1 0-1.8-1.801l-.039.038a1.05 1.05 0 0 1-1.158.21 1.05 1.05 0 0 1-.636-.961v-.057C13.273 5.57 12.703 5 12 5zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
    />
  </svg>
)

export const PresetPicker = ({
  locale,
  localeName,
  chosen,
  onChoose,
  onManage,
}: PresetPickerProps) => {
  const { presets, reload } = usePresets()
  const settings = presets.kind === 'ready' ? presets.settings : null
  const value = showing(chosen, settings)
  const wanted = asked(chosen, settings)

  // Only a preset that exists and says something for this language contributes anything,
  // and `resolveStyle` is the one place that decides so — asking it here keeps the warning
  // and the translation agreeing about what "has nothing for this language" means.
  const silent =
    settings !== null &&
    wanted !== null &&
    resolveStyle(settings, wanted, localeKey(locale)) === null

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing="8px">
        <Select
          $label="Style preset"
          $width={234}
          // `''` is a real choice here — "no preset at all" — and MUI would otherwise draw
          // it as an empty field rather than as the option that carries that meaning.
          displayEmpty
          value={value}
          onChange={(event) => onChoose(event.target.value === NO_PRESET ? null : event.target.value)}
        >
          <MenuItem value={NO_PRESET}>No preset</MenuItem>
          {(settings?.items ?? []).map((preset) => (
            <MenuItem key={preset.id} value={preset.id}>
              {preset.name}
            </MenuItem>
          ))}
        </Select>
        <IconButton $label="Manage style presets" onClick={onManage}>
          <Gear />
        </IconButton>
      </Stack>

      {presets.kind === 'loading' ? (
        <Typography sx={{ mt: '4px', ml: '14px', fontSize: 12, color: 'text.secondary' }}>
          Loading style settings…
        </Typography>
      ) : null}

      {presets.kind === 'failed' ? (
        <Alert $tone="error" role="status" sx={{ mt: '6px' }}>
          Couldn’t load style settings. Localize will run without a preset.
          <Box sx={{ mt: '6px' }}>
            <Button
              $tone="secondary"
              onClick={() => {
                void reload()
              }}
            >
              Retry
            </Button>
          </Box>
        </Alert>
      ) : null}

      {silent ? (
        <Alert $tone="warning" role="status" sx={{ mt: '6px' }}>
          No {localeName} settings in this preset. Localize will use its default style.
        </Alert>
      ) : null}
    </Box>
  )
}

import { Box, MenuItem, Stack, Typography } from '@mui/material'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Select } from '../ui/Select'
import type { LanguageCode, PresetId, StyleSettings } from './preset.types'
import { askedFor, styleFor, type PresetChoice } from './presetChoice'
import { usePresets } from './PresetsProvider'

export type { PresetChoice }

export type PresetPickerProps = {
  /** The space's own language code; normalising to the `byLocale` key happens here, so pass it unchanged. */
  locale: LanguageCode
  localeName: string
  chosen: PresetChoice
  /**
   * Off while the caller's screen has no target language. It disables the field **and**
   * suppresses the "No <language> settings in this preset" warning, which in that state has
   * no language to name.
   */
  disabled?: boolean
  onChoose: (preset: PresetId | null) => void
  onManage: () => void
}

const NO_PRESET = ''

/**
 * What the select shows: `NO_PRESET` while the settings are unread, or when the asked-for
 * preset is gone — a preset we have not read cannot be named.
 */
const showing = (chosen: PresetChoice, settings: StyleSettings | null) => {
  const wanted = askedFor(chosen, settings)

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
  disabled = false,
  onChoose,
  onManage,
}: PresetPickerProps) => {
  const { presets, reload } = usePresets()
  const settings = presets.kind === 'ready' ? presets.settings : null
  const value = showing(chosen, settings)
  const wanted = askedFor(chosen, settings)

  const silent =
    !disabled &&
    settings !== null &&
    wanted !== null &&
    styleFor(settings, chosen, locale) === null

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="flex-end" spacing="8px">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Select
            $label="Style preset"
            $width="100%"
            displayEmpty
            disabled={disabled}
            value={value}
            onChange={(event) =>
              onChoose(event.target.value === NO_PRESET ? null : event.target.value)
            }
          >
            <MenuItem value={NO_PRESET}>No preset</MenuItem>
            {(settings?.items ?? []).map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <IconButton
          $label="Manage style presets"
          $tone="secondary"
          // The kit's 34 is the size of a row icon; here it stands beside a 40px field and
          // has to match its height. Square, so both axes move together.
          sx={{ width: 40, height: 40, flexShrink: 0 }}
          onClick={onManage}
        >
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

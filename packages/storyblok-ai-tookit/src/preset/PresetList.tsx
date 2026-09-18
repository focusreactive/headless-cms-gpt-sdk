import { useEffect, useState } from 'react'
import { Box, ListItemButton, Stack, Typography } from '@mui/material'

import type { language } from '@src/context/AppDataContext'

import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { localeKey } from './localeKey'
import type { LanguageCode, PresetId, StylePreset } from './preset.types'
import { saysNothing } from './presetSet'
import { usePresets } from './PresetsProvider'

export type PresetListProps = {
  languages: language[]
  onClose: () => void
  onCreate: () => void
  onOpen: (preset: PresetId, locale: LanguageCode) => void
}

const covers = (preset: StylePreset, code: LanguageCode) => {
  const entry = preset.byLocale[localeKey(code)]

  return entry !== undefined && !saysNothing(entry)
}

const languageWord = (count: number) => (count === 1 ? 'language' : 'languages')

/** How long an armed delete waits before disarming itself, matching `useTwoStepConfirm`. */
const ARMED_MS = 4000

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none' }}
  >
    <path
      d="M10.122 10.535l2.121 2.12-2.12 2.122a1 1 0 0 0 1.413 1.415l2.829-2.829a.995.995 0 0 0 .277-.53l.014-.118v-.118a.996.996 0 0 0-.291-.648L11.536 9.12a1 1 0 0 0-1.414 1.415z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
)

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12.358 6.086c.16.08.29.212.368.375l1.415 2.928 3.166.47a.824.824 0 0 1 .684.937.833.833 0 0 1-.236.473l-2.29 2.28.54 3.218a.825.825 0 0 1-.66.954.795.795 0 0 1-.514-.083L12 16.118l-2.831 1.52a.801.801 0 0 1-1.093-.347.842.842 0 0 1-.082-.524l.54-3.219-2.29-2.28A.839.839 0 0 1 6.23 10.1a.804.804 0 0 1 .463-.241l3.165-.47 1.416-2.928a.802.802 0 0 1 1.084-.375z"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? undefined : 'currentColor'}
      strokeWidth={filled ? undefined : 1.5}
      fillRule="evenodd"
    />
  </svg>
)

const Trash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 4a3 3 0 0 1 2.954 2.474l.026.179.01.115.012.232H19a1 1 0 0 1 0 2h-1v9c0 1.657-1.24 3-2.77 3H8.77C7.24 21 6 19.657 6 18V9H5a1 1 0 1 1 0-2h4a3 3 0 0 1 3-3zm4 5H8v9c0 .513.343.936.785.993L8.89 19h6.222c.456 0 .832-.386.883-.883L16 18V9zm-5.25 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 1 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75zm2.5 0a.75.75 0 0 1 .75.75v3.5a.75.75 0 1 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75zM12 6a1 1 0 0 0-.993.883L11 7h2a1 1 0 0 0-1-1z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
)

type RowProps = {
  preset: StylePreset
  languages: language[]
  isDefault: boolean
  armed: boolean
  onArm: () => void
  onOpen: (preset: PresetId, locale: LanguageCode) => void
}

const PresetRow = ({
  preset,
  languages,
  isDefault,
  armed,
  onArm,
  onOpen,
}: RowProps) => {
  const { removePreset, setDefaultPreset } = usePresets()
  const [open, setOpen] = useState(false)

  const configured = languages.filter((lang) => covers(preset, lang.code)).length
  const summary = `${preset.name} — ${configured} of ${languages.length} languages configured`

  const remove = {
    pending: armed,
    press: () => {
      if (armed) {
        void removePreset(preset.id)

        return
      }

      onArm()
    },
  }

  return (
    <Box component="li" sx={{ listStyle: 'none', borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" sx={{ height: 40 }}>
        <IconButton
          $label={`${open ? 'Collapse' : 'Expand'} ${summary}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Chevron open={open} />
        </IconButton>
        <IconButton
          $label={
            isDefault ? `${preset.name} is the default preset` : `Make ${preset.name} the default`
          }
          onClick={() => {
            void setDefaultPreset(preset.id)
          }}
        >
          <Star filled={isDefault} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Typography
            noWrap
            sx={{ flex: '0 1 auto', minWidth: 0, fontSize: 14 }}
          >
            {preset.name}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ flexShrink: 0, fontSize: 12, color: 'text.secondary' }}>
            {configured} / {languages.length}
          </Typography>
        </Box>
        <IconButton
          $label={
            remove.pending
              ? `Delete ${preset.name} — tap again, removes ${configured} ${languageWord(configured)}`
              : `Delete ${preset.name}`
          }
          $tone={remove.pending ? 'danger' : 'default'}
          onClick={remove.press}
        >
          <Trash />
        </IconButton>
      </Stack>
      {remove.pending ? (
        <Typography sx={{ px: '10px', pb: '6px', fontSize: 11, color: 'text.secondary' }}>
          Tap again to delete · {configured} {languageWord(configured)}
        </Typography>
      ) : null}
      {open ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {languages.map((lang) => {
            const set = covers(preset, lang.code)

            return (
              <Box component="li" key={lang.code}>
                <ListItemButton
                  aria-label={`${preset.name} — ${lang.name}, ${set ? 'configured' : 'not set'}`}
                  onClick={() => onOpen(preset.id, lang.code)}
                  sx={{ pl: '34px', py: '4px' }}
                >
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    {lang.name}
                  </Typography>
                  <Typography sx={{ flexShrink: 0, fontSize: 12, color: 'text.secondary' }}>
                    {set ? 'configured' : 'not set'}
                  </Typography>
                </ListItemButton>
              </Box>
            )
          })}
        </Box>
      ) : null}
    </Box>
  )
}

export const PresetList = ({ languages, onClose, onCreate, onOpen }: PresetListProps) => {
  const { presets, reload } = usePresets()

  // Which row's delete is armed lives here rather than in each row, because "arming one
  // disarms any other" is a fact about the list. `useTwoStepConfirm` disarms on a press
  // outside its own element, which a mouse reports and a keyboard never does — so a row
  // holding its own state would leave a destructive control armed for anyone who reached
  // the next one by tab.
  const [armed, setArmed] = useState<PresetId | null>(null)

  useEffect(() => {
    if (armed === null) {
      return
    }

    const timer = window.setTimeout(() => setArmed(null), ARMED_MS)

    return () => window.clearTimeout(timer)
  }, [armed])

  return (
    <Box sx={{ p: '12px' }}>
      <Stack direction="row" alignItems="center" sx={{ height: 34, mb: '8px' }}>
        <IconButton $label="Back to Localization" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M14.363 14.777l-2.121-2.12 2.121-2.122A1 1 0 0 0 12.95 9.12l-2.83 2.83a.995.995 0 0 0-.277.53l-.014.118v.118a.997.997 0 0 0 .291.648l2.829 2.829a1 1 0 0 0 1.414-1.415z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
        </IconButton>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 500 }}>
          Style presets
        </Typography>
      </Stack>

      {presets.kind === 'loading' ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          Loading style settings…
        </Typography>
      ) : null}

      {presets.kind === 'failed' ? (
        <Alert $tone="error" role="status">
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

      {presets.kind === 'ready' && presets.settings.items.length === 0 ? (
        <Typography sx={{ fontSize: 14 }}>Save a translation style and reuse it.</Typography>
      ) : null}

      {presets.kind === 'ready' && presets.settings.items.length > 0 ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {presets.settings.items.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              languages={languages}
              isDefault={presets.settings.defaultId === preset.id}
              armed={armed === preset.id}
              onArm={() => setArmed(preset.id)}
              onOpen={onOpen}
            />
          ))}
        </Box>
      ) : null}

      <Box sx={{ mt: '12px' }}>
        <Button $tone="secondary" fullWidth onClick={onCreate}>
          New preset
        </Button>
      </Box>
    </Box>
  )
}

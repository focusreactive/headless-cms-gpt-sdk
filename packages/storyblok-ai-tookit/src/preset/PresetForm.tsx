import { useMemo, useRef, useState } from 'react'
import { Box, MenuItem, Stack, Typography } from '@mui/material'

import type { language } from '@src/context/AppDataContext'

import type { FieldErrors, Resolver } from '../shared/formState.types'
import { useController } from '../shared/useController'
import { useForm } from '../shared/useForm'
import { useTwoStepConfirm } from '../shared/useTwoStepConfirm'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Disclosure } from '../ui/Disclosure'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { TagsInput } from '../ui/TagsInput'
import { Textarea } from '../ui/Textarea'
import { describeStyle } from './describeStyle'
import { localeKey } from './localeKey'
import {
  INSTRUCTIONS_MAX,
  VOICE_MAX,
  type Formality,
  type LanguageCode,
  type LocaleStyle,
  type PresetDraft,
  type PresetId,
  type StylePreset,
  type StyleSettings,
} from './preset.types'
import { saysNothing } from './presetSet'
import { usePresets } from './PresetsProvider'
import type { Written } from './presetStore.types'
import { validatePreset } from './validatePreset'

/** Which preset the form is for. The id of a new preset is minted by the form, not by the caller. */
export type PresetFormTarget = { kind: 'new' } | { kind: 'existing'; preset: PresetId }

export type PresetFormProps = {
  languages: language[]
  /** The space's own language code, not the `byLocale` key — normalised here. */
  locale: LanguageCode
  target: PresetFormTarget
  /** Called on any way out of the form, a save included. */
  onDone: () => void
}

type Values = {
  name: string
  locale: LanguageCode
  formality: Formality
  voice: string[]
  instructions: string
}

const EMPTY: Omit<Values, 'locale'> = {
  name: '',
  formality: 'neutral',
  voice: [],
  instructions: '',
}

const draftOf = (values: Values, id: PresetId): PresetDraft => ({
  id,
  name: values.name,
  locale: localeKey(values.locale),
  formality: values.formality,
  voice: values.voice.map((word) => ({ word })),
  instructions: values.instructions,
})

const newPresetId = (): PresetId =>
  `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`

const saved = (written: Written) => written === 'written' || written === 'unchanged'

const nameOfLanguage = (languages: language[], code: LanguageCode) =>
  languages.find((lang) => lang.code === code)?.name ?? code

const takenBy = (name: string, siblings: readonly StylePreset[], id: PresetId) =>
  siblings.find(
    (preset) =>
      preset.id !== id && preset.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )?.name ?? ''

/** Where the character counter starts showing, well before the limit it counts towards. */
const COUNTER_FROM = 400

const counterOf = (instructions: string) =>
  instructions.length >= COUNTER_FROM
    ? `${instructions.length} / ${INSTRUCTIONS_MAX}`
    : undefined

const overMessage = (instructions: string) => {
  const over = instructions.length - INSTRUCTIONS_MAX

  return `${instructions.length} / ${INSTRUCTIONS_MAX} — remove ${over} ${
    over === 1 ? 'character' : 'characters'
  } to save.`
}

const Header = ({
  title,
  disabled,
  onLeave,
}: {
  title: string
  disabled: boolean
  onLeave: () => void
}) => (
  <Stack direction="row" alignItems="center" sx={{ height: 34, mb: '8px' }}>
    <IconButton $label="Back to style presets" disabled={disabled} onClick={onLeave}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M14.363 14.777l-2.121-2.12 2.121-2.122A1 1 0 0 0 12.95 9.12l-2.83 2.83a.995.995 0 0 0-.277.53l-.014.118v.118a.997.997 0 0 0 .291.648l2.829 2.829a1 1 0 0 0 1.414-1.415z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    </IconButton>
    <Typography component="h2" noWrap sx={{ fontSize: 18, fontWeight: 500 }}>
      {title}
    </Typography>
  </Stack>
)

export const PresetForm = ({ languages, locale, target, onDone }: PresetFormProps) => {
  const { presets } = usePresets()

  if (presets.kind !== 'ready') {
    return (
      <Box sx={{ p: '12px' }}>
        <Header title="New preset" disabled onLeave={onDone} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          Loading style settings…
        </Typography>
      </Box>
    )
  }

  return (
    <PresetFormFields
      languages={languages}
      locale={locale}
      target={target}
      onDone={onDone}
      settings={presets.settings}
    />
  )
}

/**
 * Split in two: `useForm` takes its defaults at mount and never again, so the fields must
 * not mount until the settings have loaded.
 */
const PresetFormFields = ({
  languages,
  locale,
  target,
  onDone,
  settings,
}: PresetFormProps & { settings: StyleSettings }) => {
  const { mutation, savePreset, removePreset } = usePresets()

  const minted = useRef<PresetId | null>(null)

  if (minted.current === null) {
    minted.current = target.kind === 'existing' ? target.preset : newPresetId()
  }

  const id = minted.current
  const preset = settings.items.find((item) => item.id === id) ?? null
  const entry: LocaleStyle = preset?.byLocale[localeKey(locale)] ?? {}

  const defaultValues: Values = {
    ...EMPTY,
    locale,
    ...(preset === null
      ? {}
      : {
          name: preset.name,
          formality: entry.formality ?? 'neutral',
          voice: (entry.voice ?? []).map((word) => word.word),
          instructions: entry.instructions ?? '',
        }),
  }

  const siblings = settings.items

  const resolver: Resolver<Values> = (values) => {
    const reported = validatePreset(draftOf(values, id), siblings)
    const errors: FieldErrors<Values> = {}

    if (reported.name !== undefined) {
      errors.name = {
        type: reported.name.type,
        message:
          reported.name.type === 'required'
            ? 'Name is required.'
            : `A preset called “${takenBy(values.name, siblings, id)}” already exists.`,
      }
    }

    if (reported.instructions !== undefined) {
      errors.instructions = {
        type: reported.instructions.type,
        message: overMessage(values.instructions),
      }
    }

    if (reported.voice !== undefined) {
      errors.voice = { type: reported.voice.type, message: 'Remove one to add another' }
    }

    return { values, errors }
  }

  const form = useForm<Values>({ defaultValues, resolver })
  const name = useController<Values, 'name'>({ name: 'name', control: form.control })
  const chosenLocale = useController<Values, 'locale'>({ name: 'locale', control: form.control })
  const formality = useController<Values, 'formality'>({
    name: 'formality',
    control: form.control,
  })
  const voice = useController<Values, 'voice'>({ name: 'voice', control: form.control })
  const instructions = useController<Values, 'instructions'>({
    name: 'instructions',
    control: form.control,
  })

  const [duplicate, setDuplicate] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const saving = mutation.kind === 'saving'
  const values = form.watch()
  const languageName = nameOfLanguage(languages, values.locale)

  const remove = useTwoStepConfirm<HTMLButtonElement>(() => {
    void removePreset(id).then((written) => {
      if (saved(written)) {
        onDone()
      }
    })
  })

  const leave = () => {
    // An armed delete is only hidden by the discard prompt, not ended by it: without this
    // the footer comes back as a lone "Delete for all languages?" after Keep editing, and
    // the next press — the only control on screen — is the second press.
    remove.cancel()

    if (form.formState.isDirty) {
      setLeaving(true)

      return
    }

    onDone()
  }

  const submit = form.handleSubmit(async (ready: Values) => {
    if (saved(await savePreset(draftOf(ready, id)))) {
      onDone()
    }
  })

  const style: LocaleStyle = useMemo(() => {
    const draft = draftOf(values, id)

    return {
      formality: draft.formality,
      voice: draft.voice,
      instructions: draft.instructions,
    }
  }, [values, id])

  const voiceHelper =
    duplicate !== null && voice.fieldState.isTouched
      ? `“${duplicate}” is already in the list. It clears when you move on.`
      : typed !== ''
        ? 'Enter adds it — so does leaving the field.'
        : (voice.fieldState.error?.message ??
          `Aim for 3–5 · ${values.voice.length} of ${VOICE_MAX}`)

  return (
    <Box component="form" onSubmit={submit} sx={{ p: '12px' }}>
      <Header title={preset?.name ?? 'New preset'} disabled={saving} onLeave={leave} />

      <Stack spacing="10px" alignItems="flex-start">
        <Input
          $label="Name"
          placeholder={target.kind === 'new' ? 'e.g. Product pages' : undefined}
          disabled={saving}
          value={name.field.value}
          onChange={name.field.onChange}
          onBlur={name.field.onBlur}
          error={name.fieldState.error !== undefined}
          helperText={name.fieldState.error?.message}
          fullWidth
        />

        {target.kind === 'new' ? (
          <Select
            $label="Language"
            disabled={saving}
            value={chosenLocale.field.value}
            onChange={chosenLocale.field.onChange}
          >
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        ) : null}

        <Box sx={{ width: '100%' }}>
          <Typography component="h3" sx={{ ml: '14px', fontSize: 12, fontWeight: 500 }}>
            Settings for {languageName}
          </Typography>
          {target.kind === 'existing' && saysNothing(entry) ? (
            <Typography sx={{ ml: '14px', fontSize: 12, color: 'text.secondary' }}>
              Nothing set yet. Saving adds {languageName} to this preset.
            </Typography>
          ) : null}
        </Box>

        <Select
          $label="Formality"
          disabled={saving}
          value={formality.field.value}
          onChange={formality.field.onChange}
        >
          <MenuItem value="neutral">Neutral</MenuItem>
          <MenuItem value="formal">Formal</MenuItem>
          <MenuItem value="informal">Informal</MenuItem>
        </Select>

        <Box sx={{ width: '100%' }}>
          {values.voice.length >= VOICE_MAX && voice.fieldState.isTouched ? (
            <Typography sx={{ ml: '14px', fontSize: 12, color: 'text.secondary' }}>
              Remove one to add another
            </Typography>
          ) : null}
          <TagsInput
            $label="Voice"
            $helperText={voiceHelper}
            $error={voice.fieldState.error !== undefined}
            disabled={saving}
            $placeholder={values.voice.length === 0 ? 'Type a word, press Enter' : undefined}
            value={voice.field.value}
            onInputChange={(_event, next) => setTyped(next)}
            // A word already in the list never reaches `onChange`: MUI (5.14.18) swallows
            // the commit rather than reporting it, so it has to be caught before it does.
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return
              }

              const word = typed.trim()

              if (
                word !== '' &&
                values.voice.some((have) => have.trim().toLowerCase() === word.toLowerCase())
              ) {
                setDuplicate(word)
              }
            }}
            onBlur={() => {
              setDuplicate(null)
              setTyped('')
              voice.field.onBlur()
            }}
            onChange={(_event, next) => {
              const words = next as string[]
              if (words.length > VOICE_MAX) {
                return
              }

              setDuplicate(null)
              voice.field.onChange(words)
            }}
          />
        </Box>

        <Textarea
          $label="Instructions"
          placeholder="House rules, e.g. terms to leave untranslated"
          disabled={saving}
          value={instructions.field.value}
          onChange={instructions.field.onChange}
          onBlur={instructions.field.onBlur}
          error={instructions.fieldState.error !== undefined}
          helperText={instructions.fieldState.error?.message ?? counterOf(values.instructions)}
          fullWidth
        />

        <Disclosure
          $label="Preview"
          $open={previewOpen}
          onToggle={() => setPreviewOpen(!previewOpen)}
          style={{ width: '100%' }}
        >
          <Typography sx={{ fontSize: 12 }}>{describeStyle(languageName, style)}</Typography>
          {saysNothing(style) ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Formality is Neutral. Voice and Instructions are empty.
            </Typography>
          ) : null}
        </Disclosure>

        {mutation.kind === 'failed' ? (
          <Alert $tone="error" sx={{ width: '100%' }}>
            Couldn’t save. Your changes are still here — try again.
          </Alert>
        ) : null}
      </Stack>

      <Box sx={{ mt: '12px' }}>
        {leaving ? (
          <Stack spacing="8px">
            <Typography sx={{ fontSize: 14 }}>Discard unsaved changes?</Typography>
            <Stack direction="row" spacing="8px">
              <Button $tone="secondary" fullWidth onClick={() => setLeaving(false)}>
                Keep editing
              </Button>
              <Button $tone="danger" fullWidth onClick={onDone}>
                Discard
              </Button>
            </Stack>
          </Stack>
        ) : remove.pending ? (
          <Button $tone="danger" fullWidth ref={remove.ref} onClick={remove.press}>
            Delete for all languages?
          </Button>
        ) : (
          <Stack direction="row" spacing="8px">
            {target.kind === 'existing' ? (
              <Button
                $tone="danger"
                fullWidth
                ref={remove.ref}
                disabled={saving}
                onClick={remove.press}
              >
                Delete
              </Button>
            ) : null}
            <Button $tone="secondary" fullWidth disabled={saving} onClick={leave}>
              Cancel
            </Button>
            <Button
              $tone="primary"
              fullWidth
              type="submit"
              disabled={saving || !form.formState.isValid}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  )
}

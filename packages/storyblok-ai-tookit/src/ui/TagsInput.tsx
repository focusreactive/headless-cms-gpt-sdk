import { forwardRef } from 'react'
import {
  Autocomplete,
  TextField,
  type AutocompleteProps,
} from '@mui/material'

const NO_SUGGESTIONS: string[] = []

type TagsInputProps = Omit<
  AutocompleteProps<string, true, false, true>,
  | 'renderInput'
  | 'multiple'
  | 'freeSolo'
  | 'autoSelect'
  | 'options'
  | 'size'
  | 'value'
  | 'onChange'
> & {
  $label: string
  $helperText?: string
  $error?: boolean
  /** Required, not optional: left out, Autocomplete keeps the words itself and the
   *  caller's cap and duplicate check never run. */
  value: string[]
  onChange: NonNullable<AutocompleteProps<string, true, false, true>['onChange']>
}

export const TagsInput = forwardRef<HTMLDivElement, TagsInputProps>(function TagsInput(
  { $label, $helperText, $error, ...rest },
  ref,
) {
  return (
    <Autocomplete
      {...rest}
      ref={ref}
      multiple
      freeSolo
      // `autoSelect` also commits on blur: without it a tag typed but not confirmed with
      // Enter is dropped.
      autoSelect
      options={NO_SUGGESTIONS}
      size="small"
      renderInput={(params) => (
        <TextField
          {...params}
          label={$label}
          helperText={$helperText}
          error={$error}
          size="small"
        />
      )}
    />
  )
})

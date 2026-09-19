import { forwardRef } from 'react'
import {
  Autocomplete,
  Chip,
  TextField,
  type AutocompleteProps,
} from '@mui/material'

const NO_SUGGESTIONS: string[] = []

/** MUI puts its own `onClick` on whatever is handed to `deleteIcon`; this only names it. */
const DeleteIcon = ({ label, ...rest }: { label: string }) => (
  <svg
    {...rest}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    role="button"
    aria-label={label}
    focusable="false"
  >
    <path
      d="M16.728 8.243a1 1 0 0 1 0 1.414l-2.829 2.827 2.829 2.83a1 1 0 1 1-1.414 1.414l-2.829-2.83-2.828 2.83a1 1 0 0 1-1.414-1.414l2.828-2.83-2.828-2.827a1 1 0 0 1 1.414-1.414l2.828 2.827 2.829-2.827a1 1 0 0 1 1.414 0z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
)

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
  | 'renderTags'
> & {
  $label: string
  $helperText?: string
  $error?: boolean
  /** Goes on the input, not on the Autocomplete around it, which would drop it. */
  $placeholder?: string
  /** Required, not optional: left out, Autocomplete keeps the words itself and the
   *  caller's cap and duplicate check never run. */
  value: string[]
  onChange: NonNullable<AutocompleteProps<string, true, false, true>['onChange']>
}

export const TagsInput = forwardRef<HTMLDivElement, TagsInputProps>(function TagsInput(
  { $label, $helperText, $error, $placeholder, ...rest },
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
      // MUI's own chips give their delete control no name at all, so a screen reader
      // reaches an unlabelled button per word. Naming the word is the whole point of it.
      renderTags={(words: string[], getTagProps) =>
        words.map((word, index) => {
          const { key, ...tag } = getTagProps({ index })

          return (
            <Chip
              {...tag}
              key={key}
              label={word}
              size="small"
              deleteIcon={<DeleteIcon label={`Remove ${word}`} />}
            />
          )
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={$label}
          placeholder={$placeholder}
          helperText={$helperText}
          error={$error}
          size="small"
        />
      )}
    />
  )
})

import { forwardRef } from 'react'
import { TextField, type OutlinedTextFieldProps } from '@mui/material'

type TextareaProps = Omit<
  OutlinedTextFieldProps,
  | 'label'
  | 'size'
  | 'variant'
  | 'multiline'
  | 'minRows'
  | 'rows'
  | 'select'
  | 'SelectProps'
> & {
  $label: string
  $minRows?: number
}

export const Textarea = forwardRef<HTMLDivElement, TextareaProps>(function Textarea(
  { $label, $minRows = 2, ...rest },
  ref,
) {
  return (
    <TextField
      {...rest}
      ref={ref}
      label={$label}
      variant="outlined"
      size="small"
      multiline
      minRows={$minRows}
    />
  )
})

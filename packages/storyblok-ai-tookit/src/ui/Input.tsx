import { forwardRef } from 'react'
import { TextField, type OutlinedTextFieldProps } from '@mui/material'

type InputProps = Omit<
  OutlinedTextFieldProps,
  | 'label'
  | 'size'
  | 'variant'
  | 'multiline'
  | 'minRows'
  | 'maxRows'
  | 'rows'
  | 'select'
  | 'SelectProps'
> & {
  $label: string
}

export const Input = forwardRef<HTMLDivElement, InputProps>(function Input(
  { $label, ...rest },
  ref,
) {
  return <TextField {...rest} ref={ref} label={$label} variant="outlined" size="small" />
})

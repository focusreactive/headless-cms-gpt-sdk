import { forwardRef, useId } from 'react'
import {
  FormControl,
  FormHelperText,
  InputLabel,
  Select as MuiSelect,
  type SelectProps as MuiSelectProps,
} from '@mui/material'

type SelectProps = Omit<
  MuiSelectProps<string>,
  'label' | 'labelId' | 'size' | 'variant' | 'multiple'
> & {
  /** Sits in the notch of the outline rather than on its own line above the field. */
  $label: string
  $width?: number | string
  $helperText?: string
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  { $label, $width = '100%', $helperText, id, disabled, error, ...rest },
  ref,
) {
  const generated = useId()
  const selectId = id ?? generated
  const helperId = $helperText === undefined ? undefined : `${selectId}-helper-text`

  return (
    <FormControl size="small" disabled={disabled} error={error} sx={{ width: $width }}>
      <InputLabel id={`${selectId}-label`}>{$label}</InputLabel>
      <MuiSelect
        {...rest}
        ref={ref}
        id={selectId}
        labelId={`${selectId}-label`}
        // The outline cuts its notch from this prop, not from the InputLabel above:
        // without it the label sits on top of an unbroken border.
        label={$label}
        size="small"
        disabled={disabled}
        aria-describedby={helperId}
      />
      {helperId === undefined ? null : (
        <FormHelperText id={helperId}>{$helperText}</FormHelperText>
      )}
    </FormControl>
  )
})

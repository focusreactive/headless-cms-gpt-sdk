import { forwardRef, useId } from 'react'
import {
  FormControl,
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
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  { $label, $width = '100%', id, disabled, ...rest },
  ref,
) {
  const generated = useId()
  const selectId = id ?? generated

  return (
    <FormControl size="small" disabled={disabled} sx={{ width: $width }}>
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
      />
    </FormControl>
  )
})

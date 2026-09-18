import { forwardRef } from 'react'
import {
  Button as MuiButton,
  CircularProgress,
  type ButtonProps as MuiButtonProps,
} from '@mui/material'

type Tone = 'primary' | 'secondary' | 'danger'

type ButtonProps = Omit<MuiButtonProps, 'size' | 'variant' | 'color'> & {
  $tone: Tone
  $loading?: boolean
}

const SPINNER_SIZE = 16

const TONES: Record<Tone, Pick<MuiButtonProps, 'variant' | 'color'>> = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'inherit' },
  danger: { variant: 'outlined', color: 'error' },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { $tone, $loading = false, disabled, startIcon, ...rest },
  ref,
) {
  return (
    <MuiButton
      {...rest}
      ref={ref}
      {...TONES[$tone]}
      size="small"
      disabled={disabled || $loading}
      startIcon={$loading ? <CircularProgress size={SPINNER_SIZE} color="inherit" /> : startIcon}
    />
  )
})

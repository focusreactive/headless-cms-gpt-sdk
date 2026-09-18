import { forwardRef } from 'react'
import { Button as MuiButton, type ButtonProps as MuiButtonProps } from '@mui/material'

type Tone = 'primary' | 'secondary' | 'danger'

type ButtonProps = Omit<MuiButtonProps, 'size' | 'variant' | 'color'> & {
  $tone: Tone
}

const TONES: Record<Tone, Pick<MuiButtonProps, 'variant' | 'color'>> = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'inherit' },
  danger: { variant: 'outlined', color: 'error' },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { $tone, ...rest },
  ref,
) {
  return <MuiButton {...rest} ref={ref} {...TONES[$tone]} size="small" />
})

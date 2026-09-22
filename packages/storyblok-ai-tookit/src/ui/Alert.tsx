import { forwardRef } from 'react'
import { Alert as MuiAlert, type AlertProps as MuiAlertProps } from '@mui/material'

type AlertProps = Omit<MuiAlertProps, 'severity' | 'variant'> & {
  $tone: 'info' | 'warning' | 'error'
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { $tone, ...rest },
  ref,
) {
  return <MuiAlert {...rest} ref={ref} severity={$tone} variant="standard" />
})

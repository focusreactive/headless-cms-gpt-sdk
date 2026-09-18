import { forwardRef } from 'react'
import {
  IconButton as MuiIconButton,
  Tooltip,
  type IconButtonProps as MuiIconButtonProps,
} from '@mui/material'

type Tone = 'default' | 'danger'

type IconButtonProps = Omit<MuiIconButtonProps, 'aria-label' | 'size'> & {
  /** Names the action once, for the tooltip and for assistive tech alike. */
  $label: string
  $tone?: Tone
}

const SIZE = { width: 34, height: 34 } as const

const DANGER = {
  bgcolor: 'error.main',
  color: 'error.contrastText',
  '&:hover': { bgcolor: 'error.dark' },
} as const

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ $label, $tone = 'default', sx, ...rest }, ref) {
    const tone = $tone === 'danger' ? [SIZE, DANGER] : [SIZE]

    return (
      <Tooltip title={$label}>
        <MuiIconButton
          {...rest}
          ref={ref}
          aria-label={$label}
          size="small"
          sx={sx === undefined ? tone : [...tone, ...(Array.isArray(sx) ? sx : [sx])]}
        />
      </Tooltip>
    )
  },
)

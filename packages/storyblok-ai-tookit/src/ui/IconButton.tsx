import { forwardRef } from 'react'
import {
  IconButton as MuiIconButton,
  Tooltip,
  type IconButtonProps as MuiIconButtonProps,
} from '@mui/material'

type IconButtonProps = Omit<MuiIconButtonProps, 'aria-label' | 'size'> & {
  /** Names the action once, for the tooltip and for assistive tech alike. */
  $label: string
}

const SIZE = { width: 34, height: 34 } as const

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ $label, sx, ...rest }, ref) {
    return (
      <Tooltip title={$label}>
        <MuiIconButton
          {...rest}
          ref={ref}
          aria-label={$label}
          size="small"
          sx={sx === undefined ? SIZE : [SIZE, ...(Array.isArray(sx) ? sx : [sx])]}
        />
      </Tooltip>
    )
  },
)

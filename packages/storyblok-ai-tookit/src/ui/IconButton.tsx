import { forwardRef } from 'react'
import {
  IconButton as MuiIconButton,
  Tooltip,
  type IconButtonProps as MuiIconButtonProps,
} from '@mui/material'

type Tone = 'default' | 'secondary' | 'danger'

type IconButtonProps = Omit<MuiIconButtonProps, 'aria-label' | 'size'> & {
  /** Names the action once, for the tooltip and for assistive tech alike. */
  $label: string
  $tone?: Tone
}

// 28, not the 34 the artboards drew: three of these sit in one row of a 300px panel, and
// at 34 they took a third of it away from the name beside them. No padding of its own —
// MUI's would leave a 22px glyph floating in the middle of what is already a small button.
const SIZE = { width: 28, height: 28, padding: 0 } as const

const DANGER = {
  bgcolor: 'error.main',
  color: 'error.contrastText',
  '&:hover': { bgcolor: 'error.dark' },
} as const

// MUI's own outlined-field border, which it hardcodes and exposes no token for: a swap to
// `divider` or `grey.400` renders lighter than the field this button stands beside.
const SECONDARY = {
  border: '1px solid',
  borderColor: 'rgba(0, 0, 0, 0.23)',
  '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
} as const

const TONES: Record<Tone, readonly object[]> = {
  default: [SIZE],
  secondary: [SIZE, SECONDARY],
  danger: [SIZE, DANGER],
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ $label, $tone = 'default', sx, ...rest }, ref) {
    const tone = TONES[$tone]

    return (
      // Above, not below: the panel is one 300px column with its controls stacked, so a
      // tooltip under the button covers the next control rather than empty space.
      <Tooltip title={$label} placement="top">
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

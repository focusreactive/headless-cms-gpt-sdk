import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { Box, ButtonBase, Collapse } from '@mui/material'

type DisclosureProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  $label: string
  $open: boolean
  onToggle: () => void
  children: ReactNode
}

export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(function Disclosure(
  { $label, $open, onToggle, children, ...rest },
  ref,
) {
  const generated = useId()
  const panelId = `${generated}-panel`

  return (
    <div {...rest} ref={ref}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={$open}
        aria-controls={panelId}
        sx={{
          width: '100%',
          height: 34,
          px: '10px',
          gap: '6px',
          justifyContent: 'flex-start',
          fontSize: 13,
          fontWeight: 500,
          border: 1,
          borderColor: 'divider',
          borderRadius: $open ? '5px 5px 0 0' : '5px',
          bgcolor: 'action.hover',
        }}
      >
        <Chevron open={$open} />
        {$label}
      </ButtonBase>
      <Collapse in={$open} id={panelId}>
        <Box
          sx={{
            p: '8px 10px',
            borderWidth: '0 1px 1px',
            borderStyle: 'solid',
            borderColor: 'divider',
            borderRadius: '0 0 5px 5px',
            bgcolor: 'action.hover',
          }}
        >
          {children}
        </Box>
      </Collapse>
    </div>
  )
})

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    style={{
      flexShrink: 0,
      transform: open ? 'rotate(90deg)' : 'none',
      transition: 'transform 150ms',
    }}
  >
    <path
      d="M10.122 10.535l2.121 2.12-2.12 2.122a1 1 0 0 0 1.413 1.415l2.829-2.829a.995.995 0 0 0 .277-.53l.014-.118v-.118a.996.996 0 0 0-.291-.648L11.536 9.12a1 1 0 0 0-1.414 1.415z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
)

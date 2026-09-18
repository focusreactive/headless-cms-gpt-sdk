import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_TIMEOUT_MS = 4000

/**
 * A control that commits on the second press: the first arms it, the second performs.
 * The arming decays on a timer, on a press outside `ref`, and on Escape.
 */
export function useTwoStepConfirm<T extends HTMLElement = HTMLElement>(
  perform: () => void,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
) {
  const [pending, setPending] = useState(false)
  const ref = useRef<T>(null)

  const cancel = useCallback(() => setPending(false), [])

  const press = useCallback(() => {
    if (!pending) {
      setPending(true)

      return
    }

    setPending(false)
    perform()
  }, [pending, perform])

  // Escape stays available to whatever else answers it: a document listener in the
  // bubble phase runs after React's root container and after MUI's own roots.
  useEffect(() => {
    if (!pending) {
      return
    }

    // setTimeout truncates its delay to an integer, so `Infinity` — the obvious way to
    // ask for no decay at all — would otherwise come out as 0 and disarm immediately.
    const timer =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? window.setTimeout(cancel, timeoutMs)
        : undefined

    const onPressOutside = (event: MouseEvent) => {
      const element = ref.current

      if (element && event.target instanceof Node && !element.contains(event.target)) {
        cancel()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      cancel()
    }

    // mousedown, not click: the press outside has to disarm before that element's own
    // click handler runs.
    document.addEventListener('mousedown', onPressOutside)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }

      document.removeEventListener('mousedown', onPressOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pending, timeoutMs, cancel])

  return { pending, press, cancel, ref }
}

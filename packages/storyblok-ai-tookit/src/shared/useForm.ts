import { useReducer, useRef, type Reducer } from 'react'

import { coreReducer, hasErrors, initCore, isSameValues } from './formState.core'
import type { CoreAction, CoreState } from './formState.core'
import type { UseFormProps, UseFormReturn } from './formState.types'

export const useForm = <T extends Record<string, unknown>>({
  defaultValues,
  resolver,
}: UseFormProps<T>): UseFormReturn<T> => {
  const [state, dispatch] = useReducer<
    Reducer<CoreState<T>, CoreAction<T>>,
    T
  >(coreReducer, defaultValues, initCore)

  const { errors } = resolver(state.values)

  // handleSubmit must judge what is on screen now, not what was there when the render that
  // built it ran: a field committing its value on blur and a click on Save are two events,
  // and a closure would submit the state between them.
  const live = useRef(state.values)
  live.current = state.values

  const handleSubmit: UseFormReturn<T>['handleSubmit'] =
    (onValid, onInvalid) => async (event) => {
      if (event && event.preventDefault) {
        event.preventDefault()
      }

      const result = resolver(live.current)

      if (hasErrors(result.errors)) {
        dispatch({ type: 'submitRejected', errors: result.errors })

        try {
          if (onInvalid) {
            onInvalid(result.errors)
          }
        } catch {
          // Same promise as below: the contract says it never rejects, whichever handler
          // was the one that failed.
        }

        return
      }

      dispatch({ type: 'submitStarted' })

      try {
        await onValid(result.values)
      } catch {
        // handleSubmit's promise never rejects — see the contract; a failing handler is
        // the caller's to report.
      } finally {
        dispatch({ type: 'submitSettled' })
      }
    }

  const reset = (next?: T) => dispatch({ type: 'reset', next })
  const getValues = () => state.values

  return {
    control: {
      __state: {
        values: state.values,
        defaultValues: state.baselineValues,
        touched: state.touched,
        errors,
      },
      __change: (name, value) => dispatch({ type: 'change', name, value }),
      __blur: (name) => dispatch({ type: 'blur', name }),
    },
    formState: {
      errors,
      touchedFields: state.touched,
      isDirty: !isSameValues(state.values, state.baselineValues),
      isValid: !hasErrors(errors),
      isSubmitting: state.isSubmitting,
      isSubmitted: state.isSubmitted,
    },
    handleSubmit,
    reset,
    watch: getValues,
    getValues,
  }
}

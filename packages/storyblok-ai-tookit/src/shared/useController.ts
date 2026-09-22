import { isSameFieldValue, readChangeArgument } from './formState.core'
import type { UseControllerProps, UseControllerReturn } from './formState.types'

export const useController = <T extends Record<string, unknown>, N extends keyof T = keyof T>({
  name,
  control,
}: UseControllerProps<T, N>): UseControllerReturn<T, N> => {
  const { __state, __change, __blur } = control
  const isTouched = __state.touched[name] !== undefined
  const error = __state.errors[name]

  return {
    field: {
      name,
      value: __state.values[name],
      onChange: (...event) => __change(name, readChangeArgument(event)),
      onBlur: () => __blur(name),
      ref: () => {},
    },
    fieldState: {
      invalid: isTouched && error !== undefined,
      error: isTouched ? error : undefined,
      isTouched,
      isDirty: !isSameFieldValue(__state.values[name], __state.defaultValues[name]),
      isValidating: false,
    },
  }
}

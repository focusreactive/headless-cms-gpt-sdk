import type { FieldErrors, TouchedFields } from './formState.types'

export type CoreState<T> = {
  values: T
  baselineValues: T
  creationDefaults: T
  touched: TouchedFields<T>
  isSubmitting: boolean
  isSubmitted: boolean
}

export type CoreAction<T> =
  | { type: 'change'; name: keyof T; value: unknown }
  | { type: 'blur'; name: keyof T }
  | { type: 'submitRejected'; errors: FieldErrors<T> }
  | { type: 'submitStarted' }
  | { type: 'submitSettled' }
  | { type: 'reset'; next?: T }

export const initCore = <T extends Record<string, unknown>>(
  defaultValues: T,
): CoreState<T> => ({
  values: defaultValues,
  baselineValues: defaultValues,
  creationDefaults: defaultValues,
  touched: {},
  isSubmitting: false,
  isSubmitted: false,
})

/**
 * Takes the field names from the errors as well as the values: an optional field absent
 * from `defaultValues` can still be the one the resolver objects to, and leaving it
 * untouched would hide the only explanation of why the form will not submit.
 */
const revealAllErrors = <T>(values: T, errors: FieldErrors<T>): TouchedFields<T> => {
  const touched: TouchedFields<T> = {}
  const names = Object.keys(values as Record<string, unknown>).concat(Object.keys(errors))

  for (let i = 0; i < names.length; i += 1) {
    touched[names[i] as keyof T] = true
  }

  return touched
}

/** A key holding `undefined` is not a reported error, and `strict: false` lets one through. */
export const hasErrors = <T>(errors: FieldErrors<T>): boolean =>
  Object.keys(errors).some((name) => errors[name as keyof T] !== undefined)

export const coreReducer = <T extends Record<string, unknown>>(
  state: CoreState<T>,
  action: CoreAction<T>,
): CoreState<T> => {
  switch (action.type) {
    case 'change': {
      const values = { ...state.values, [action.name]: action.value }

      return { ...state, values }
    }

    case 'blur':
      return { ...state, touched: { ...state.touched, [action.name]: true } }

    case 'submitRejected':
      return { ...state, isSubmitted: true, touched: revealAllErrors(state.values, action.errors) }

    case 'submitStarted':
      return { ...state, isSubmitted: true, isSubmitting: true }

    case 'submitSettled':
      return { ...state, isSubmitting: false }

    case 'reset': {
      const values = action.next === undefined ? state.creationDefaults : action.next

      return {
        ...state,
        values,
        baselineValues: values,
        touched: {},
        isSubmitted: false,
      }
    }

    default:
      return state
  }
}

export const isSameFieldValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index])
  }

  return a === b
}

export const isSameValues = <T extends Record<string, unknown>>(a: T, b: T): boolean => {
  const names = Object.keys(a)

  if (names.length !== Object.keys(b).length) {
    return false
  }

  for (let i = 0; i < names.length; i += 1) {
    if (!isSameFieldValue(a[names[i]], b[names[i]])) {
      return false
    }
  }

  return true
}

/** Key presence, not definedness: an emptied input sends `{ target: { value: undefined } }`. */
export const readChangeArgument = (args: unknown[]): unknown => {
  const first = args[0]

  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    return first
  }

  const target = (first as { target?: unknown }).target

  if (typeof target !== 'object' || target === null) {
    return first
  }

  return 'value' in target ? (target as { value: unknown }).value : first
}

/**
 * A cut-down, API-compatible react-hook-form.
 *
 * Compatibility runs one way: code written against these types must compile and behave
 * identically against the real RHF, not the reverse. This file is the contract, not a
 * pointer to RHF's docs — where it is silent, the silence is deliberate and listed at the
 * bottom; do not resolve one by reading RHF.
 */

/** `type` names the rule that failed, not the field's data type. */
export type FieldError = {
  type: string
  message?: string
}

export type FieldErrors<T> = Partial<Record<keyof T, FieldError>>

/** Narrower than RHF's `boolean`: absent is the only way to say untouched. Safe one-way — code written against this still compiles against RHF's. */
export type TouchedFields<T> = Partial<Record<keyof T, true>>

/**
 * Synchronous: there is no second waiting state beside `isSubmitting`.
 *
 * On a submit that passes validation the handler receives the resolver's `values`, so a
 * resolver may coerce. The form's own state is not coerced — `field.value`, `watch`,
 * `getValues` and `isDirty` keep showing what was typed.
 */
export type Resolver<T> = (values: T) => { values: T; errors: FieldErrors<T> }

/**
 * What the form knows about itself.
 *
 * `errors` holds every error the resolver currently reports, whether or not the field has
 * been touched — it is the whole truth. What a *field* shows is narrower; see
 * `ControllerFieldState.error`.
 *
 * `isValid` is `errors` being empty and nothing else. It does not consider touched, so a
 * form nobody has typed into is already invalid and its submit control already disabled.
 *
 * `isDirty` compares the current values against `defaultValues` **by value**: a field
 * holding an array of strings is dirty only when its contents differ, never merely
 * because the array is a different object.
 *
 * `isSubmitting` is true from the moment a submit passes validation until the handler's
 * promise settles, whether it resolves or rejects. `isSubmitted` turns true on the first
 * submit attempt and stays true — including an attempt that failed validation — until
 * `reset`.
 */
export type FormState<T> = {
  errors: FieldErrors<T>
  touchedFields: TouchedFields<T>
  isDirty: boolean
  isValid: boolean
  isSubmitting: boolean
  isSubmitted: boolean
}

export type Control<T> = {
  __state: {
    values: T
    defaultValues: T
    touched: TouchedFields<T>
    errors: FieldErrors<T>
  }
  __change: (name: keyof T, value: unknown) => void
  __blur: (name: keyof T) => void
}

export type UseFormProps<T> = {
  defaultValues: T
  /**
   * Read afresh every time it is needed, never captured. A resolver usually closes over
   * something outside the form — the other records a new name must not collide with — and
   * that something changes while the form is open. A caller may hand over a different one
   * on any render and the next validation uses it.
   */
  resolver: Resolver<T>
  /** `'onTouched'`: a field validates from the first change and shows what it found once the user has left it. */
  mode?: 'onTouched'
}

export type UseFormReturn<T> = {
  control: Control<T>
  formState: FormState<T>
  /**
   * Validates, then either calls `onValid` with the resolver's values, or — when anything
   * is wrong — marks **every** field touched so each error becomes visible at once, calls
   * `onInvalid` if given, and does not call `onValid`.
   *
   * A submit that passes validation marks nothing touched: there is nothing to reveal.
   * It also unmarks nothing — only `reset` clears touched.
   *
   * A handler that throws synchronously is treated exactly as one that returns a rejected
   * promise. A handler that returns anything else is awaited all the same, so
   * `isSubmitting` may never be observably true for a synchronous one.
   *
   * The returned promise resolves whether the handler resolves or rejects — a failing
   * handler is the caller's to report, and `isSubmitting` clears either way. It is never
   * rejected, so a caller need not guard the call.
   *
   * The returned handler calls `preventDefault` when handed an event, so it can be passed
   * straight to a form's `onSubmit`.
   */
  handleSubmit: (
    onValid: (values: T) => unknown | Promise<unknown>,
    onInvalid?: (errors: FieldErrors<T>) => void,
  ) => (event?: { preventDefault?: () => void }) => Promise<void>
  /**
   * Replaces the values and the baseline `isDirty` measures against, and clears touched
   * and `isSubmitted`.
   *
   * It does **not** clear `errors` — it recomputes them from the new values. Clearing
   * them would contradict `isValid`: a form reset to defaults that are invalid would
   * report itself valid and enable its submit control. What a reset form hides is not the
   * errors but their display, and clearing touched already does that.
   *
   * Called without arguments it returns to the `defaultValues` the form was created with.
   */
  reset: (next?: T) => void
  watch: () => T
  getValues: () => T
}

export type UseControllerProps<T, N extends keyof T = keyof T> = {
  name: N
  control: Control<T>
}

export type ControllerRenderProps<T, N extends keyof T = keyof T> = {
  name: N
  /**
   * The field's own type, not `unknown`: a caller spreads this straight onto a control
   * that declares what it accepts, and a cast at that call site would be the caller
   * guessing at something the form already knows.
   */
  value: T[N]
  /**
   * Takes either the new value itself or an event carrying it at `target.value`, so one
   * handler serves a plain control and a DOM input alike.
   *
   * It reads the first argument as an event only when that argument is an object with a
   * `target` that itself has a `value` **key**, present or not — `{ target: { value:
   * undefined } }` sets the value to `undefined` rather than storing the event. Anything
   * else — a string, an array, `null`, `undefined`, an object without `target` — is the
   * value, and calling it with no argument at all sets `undefined`. Further arguments are
   * ignored, which is what lets a MUI handler of shape `(event, value)` be wired as
   * `(_, next) => field.onChange(next)`.
   *
   * Changing a value does not mark the field touched. Only `onBlur` does, which is what
   * keeps an error hidden while someone is still typing their first entry.
   */
  onChange: (...event: unknown[]) => void
  onBlur: () => void
  /** A no-op. Present so the shape matches RHF's, whose `ref` serves focus management. */
  ref: (instance: unknown) => void
}

/**
 * `error` is what this field should display, which is narrower than `formState.errors`:
 * it is present only once the field has been touched. `invalid` follows the same gate, so
 * a field nobody has entered reads as valid even while the form does not.
 */
export type ControllerFieldState = {
  invalid: boolean
  isTouched: boolean
  isDirty: boolean
  isValidating: false
  error?: FieldError
}

export type UseControllerReturn<T, N extends keyof T = keyof T> = {
  field: ControllerRenderProps<T, N>
  fieldState: ControllerFieldState
}

/**
 * Not promised, and not to be inferred from react-hook-form:
 *
 *   - what happens if the resolver throws;
 *   - a second submit begun while the first is in flight, and whether `reset` disturbs one;
 *   - whether any returned function or object keeps its identity across renders;
 *   - `watch` and `getValues` both return the current values; neither subscribes;
 *   - how deep the by-value comparison goes — arrays of primitives only.
 */

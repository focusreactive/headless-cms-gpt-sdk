/**
 * What went wrong when the plugin talked to its storage.
 *
 * `kind` is the whole classification and it is closed: a caller switching on it has
 * covered every case. `network` means the request never produced a response — offline,
 * DNS, a cancelled fetch. `http` means a response arrived carrying a failing status, which
 * is then in `status`. `malformed` means a response arrived, said it succeeded, and its
 * body could not be read as what was expected.
 *
 * The kind is the caller's classification and is taken as given: an `'http'` carrying a
 * status in the success range is built without complaint, because only the caller knows
 * why it decided the response was a failure.
 *
 * `message` is for a developer reading a log. It is never what a screen shows: the
 * wording a person sees belongs to the screen, which knows what was being attempted.
 */
export type ApiErrorKind = 'network' | 'http' | 'malformed'

export class ApiError extends Error {
  /**
   * The discriminant a caller must test, and the reason it exists rather than `instanceof`:
   * this package compiles to `target: es5`, where subclassing `Error` loses the prototype
   * chain and `error instanceof ApiError` is false for an error this class produced. A
   * plain own property survives that, so `isApiError` below is the only supported test.
   */
  readonly isApiError = true as const

  readonly kind: ApiErrorKind

  /**
   * Carried only for `'http'`: a status passed with any other kind is discarded, so the
   * invariant holds whatever a caller does. An `'http'` built without one keeps `undefined`
   * and still classifies as http — the classification is the kind, never the status.
   */
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = kind === 'http' ? status : undefined
  }
}

/**
 * The supported way to recognise one. Returns false for every other value, `null` and
 * `undefined` included, and never throws for any value whose properties can be read.
 *
 * It tests the mark, so an object carrying `isApiError: true` that this class never built
 * reads as true. That is deliberate: the mark exists because the prototype cannot be
 * trusted here, and defending against a forgery nobody has a reason to write would cost
 * the one property that survives the compile target.
 */
export type IsApiError = (value: unknown) => value is ApiError

export const isApiError: IsApiError = (value): value is ApiError =>
  typeof value === 'object' &&
  value !== null &&
  (value as { isApiError?: unknown }).isApiError === true

/**
 * What to put in front of a person when something rejected.
 *
 * `storyblok-js-client` rejects with a plain object rather than an `Error`, so
 * `String(cause)` on it reads "[object Object]" — and its `message` is routinely empty,
 * with the whole of the diagnosis in `status` and `response`. An expired management token
 * arrives here as `{ message: "", status: 401, response: "Unauthorized" }`.
 *
 * ## What comes back
 *
 * An `Error` gives its `message`, whatever that is — including the empty string, because
 * an `Error` that says nothing is still the thing that was thrown.
 *
 * Any other object gives `status`, `response` and `message`, in that order, joined by a
 * space, with the empty ones left out. The order puts the code first because it is the
 * half a reader can look up.
 *
 * Anything else — a string, a number, `null`, `undefined` — is stringified as it is.
 */
export type DescribeCause = (cause: unknown) => string;

export const describeCause: DescribeCause = (cause) => {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (cause && typeof cause === "object") {
    const { message, status, response } = cause as {
      message?: unknown;
      status?: unknown;
      response?: unknown;
    };

    const parts = [
      typeof status === "number" ? String(status) : "",
      typeof response === "string" ? response : "",
      typeof message === "string" ? message : "",
    ].filter((part) => part !== "");

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return String(cause);
};

export class ExtendedError extends Error {
  _debug?: Record<string, any>;

  constructor(message: string, cause?: Error | null, debugMeta?: Record<string, any>) {
    super(message);

    this._debug = debugMeta;
    this.cause = cause;
  }
}

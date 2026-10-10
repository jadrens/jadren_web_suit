/** Failure of an RPC call, shaped like the former REST client error. */
export class ApiError<TDetails = unknown> extends Error {
  readonly code: string | null;

  constructor(
    message: string,
    /** HTTP status equivalent of the RPC status code. */
    readonly status: number,
    readonly url: string,
    readonly details: TDetails | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.code =
      typeof details === "object" &&
      details !== null &&
      "code" in details &&
      typeof details.code === "string"
        ? details.code
        : null;
  }
}

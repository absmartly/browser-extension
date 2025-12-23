export class APIError extends Error {
  constructor(
    message: string,
    public readonly isAuthError: boolean = false,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }

  static isAPIError(err: unknown): err is APIError {
    return err instanceof APIError
  }

  static fromError(err: unknown, isAuthError: boolean = false): APIError {
    if (err instanceof APIError) {
      return err
    }
    if (err instanceof Error) {
      return new APIError(err.message, isAuthError)
    }
    return new APIError(String(err), isAuthError)
  }
}

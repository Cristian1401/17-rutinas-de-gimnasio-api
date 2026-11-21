export type ErrorDetails = unknown;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function unauthorized(message = "No autorizado"): HttpError {
  return new HttpError(401, "UNAUTHORIZED", message);
}

function internalError(message = "Error interno"): HttpError {
  return new HttpError(500, "INTERNAL_ERROR", message);
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  return internalError();
}

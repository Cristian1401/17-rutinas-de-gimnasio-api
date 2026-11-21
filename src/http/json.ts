import type { ApiErrorPayload } from "./errorPayload";
import { HttpError, toHttpError } from "./errors";

export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function jsonError(error: HttpError): Response {
  const payload: ApiErrorPayload = {
    error: { code: error.code, message: error.message },
  };
  if (error.details !== undefined) {
    payload.error.details = error.details;
  }
  return new Response(JSON.stringify(payload), {
    status: error.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function handleRouteError(error: unknown): Response {
  return jsonError(toHttpError(error));
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "Cuerpo JSON inválido");
  }
}

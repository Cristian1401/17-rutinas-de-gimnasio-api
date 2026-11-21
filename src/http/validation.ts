import { type output, type ZodType } from "zod";

import { HttpError } from "./errors";

export function parseBody<T extends ZodType>(schema: T, value: unknown): output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new HttpError(400, "VALIDATION_ERROR", "Datos inválidos", details);
  }
  return result.data;
}

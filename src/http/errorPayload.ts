import type { ErrorDetails } from "./errors";

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

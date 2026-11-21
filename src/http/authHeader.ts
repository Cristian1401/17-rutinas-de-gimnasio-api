import { unauthorized } from "./errors";

export function readBearerToken(header: string | null): string {
  if (!header) {
    throw unauthorized("Falta el token");
  }
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    throw unauthorized("Formato de autorización inválido");
  }
  return parts[1];
}

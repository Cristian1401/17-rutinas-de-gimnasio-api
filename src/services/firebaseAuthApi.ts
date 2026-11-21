import { z } from "zod";

import { getWebApiKey } from "@/config/firebase";
import { HttpError } from "@/http/errors";

export interface PasswordCredentials {
  email: string;
  password: string;
}

export interface SignUpInput extends PasswordCredentials {
  displayName?: string;
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  uid?: string;
  email?: string;
}

interface FirebaseErrorMapping {
  status: number;
  code: string;
  message: string;
}

const passwordTokensSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.string().min(1),
  localId: z.string().optional(),
  email: z.string().optional(),
});

const refreshTokensSchema = z.object({
  id_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.union([z.string(), z.number()]).transform(String),
  user_id: z.string().optional(),
});

const errorSchema = z.object({
  error: z.object({ message: z.string().optional() }).optional(),
});

const errorMappings: Record<string, FirebaseErrorMapping> = {
  EMAIL_EXISTS: { status: 409, code: "CONFLICT", message: "El correo ya está registrado" },
  INVALID_LOGIN_CREDENTIALS: {
    status: 401,
    code: "UNAUTHORIZED",
    message: "Credenciales inválidas",
  },
  INVALID_PASSWORD: { status: 401, code: "UNAUTHORIZED", message: "Credenciales inválidas" },
  EMAIL_NOT_FOUND: { status: 401, code: "UNAUTHORIZED", message: "Credenciales inválidas" },
  INVALID_EMAIL: { status: 400, code: "BAD_REQUEST", message: "Correo inválido" },
  WEAK_PASSWORD: { status: 400, code: "BAD_REQUEST", message: "Contraseña débil" },
  INVALID_REFRESH_TOKEN: { status: 401, code: "UNAUTHORIZED", message: "Sesión inválida" },
  TOKEN_EXPIRED: { status: 401, code: "UNAUTHORIZED", message: "Sesión expirada" },
  USER_DISABLED: { status: 401, code: "UNAUTHORIZED", message: "Usuario deshabilitado" },
};

function defaultErrorMapping(): FirebaseErrorMapping {
  return { status: 400, code: "BAD_REQUEST", message: "Error de Firebase" };
}

function mapFirebaseError(message: string | undefined): FirebaseErrorMapping {
  const mapping = message ? errorMappings[message] : undefined;
  return mapping ?? defaultErrorMapping();
}

function toHttpError(payload: unknown): HttpError {
  const parsed = errorSchema.safeParse(payload);
  const mapping = mapFirebaseError(parsed.success ? parsed.data.error?.message : undefined);
  return new HttpError(mapping.status, mapping.code, mapping.message);
}

function invalidPayload(): HttpError {
  return new HttpError(502, "UPSTREAM_ERROR", "Respuesta inválida de Firebase");
}

async function request(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new HttpError(502, "UPSTREAM_ERROR", "No se pudo conectar con Firebase");
  }
  try {
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw toHttpError(payload);
    }
    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw invalidPayload();
  }
}

function identityUrl(action: "signUp" | "signInWithPassword"): string {
  return `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${getWebApiKey()}`;
}

function refreshUrl(): string {
  return `https://securetoken.googleapis.com/v1/token?key=${getWebApiKey()}`;
}

function parsePasswordTokens(payload: unknown): AuthTokens {
  const parsed = passwordTokensSchema.safeParse(payload);
  if (!parsed.success) {
    throw invalidPayload();
  }
  return {
    idToken: parsed.data.idToken,
    refreshToken: parsed.data.refreshToken,
    expiresIn: parsed.data.expiresIn,
    uid: parsed.data.localId,
    email: parsed.data.email,
  };
}

function parseRefreshTokens(payload: unknown): AuthTokens {
  const parsed = refreshTokensSchema.safeParse(payload);
  if (!parsed.success) {
    throw invalidPayload();
  }
  return {
    idToken: parsed.data.id_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in,
    uid: parsed.data.user_id,
  };
}

export async function signUpWithPassword(input: SignUpInput): Promise<AuthTokens> {
  const payload = await request(identityUrl("signUp"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, returnSecureToken: true }),
  });
  return parsePasswordTokens(payload);
}

export async function signInWithPassword(input: PasswordCredentials): Promise<AuthTokens> {
  const payload = await request(identityUrl("signInWithPassword"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, returnSecureToken: true }),
  });
  return parsePasswordTokens(payload);
}

export async function refreshWithToken(refreshToken: string): Promise<AuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const payload = await request(refreshUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return parseRefreshTokens(payload);
}

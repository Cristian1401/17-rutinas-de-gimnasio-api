import { getAdminAuth } from "@/config/firebase";
import { unauthorized } from "@/http/errors";
import type { LoginInput, RegistroInput, RefreshInput } from "@/schemas/auth";

import {
  type AuthTokens,
  refreshWithToken,
  signInWithPassword,
  signUpWithPassword,
} from "./firebaseAuthApi";

export interface CurrentUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export async function registerUser(input: RegistroInput): Promise<AuthTokens> {
  return signUpWithPassword({
    email: input.email,
    password: input.password,
    displayName: input.displayName,
  });
}

export async function loginUser(input: LoginInput): Promise<AuthTokens> {
  return signInWithPassword({ email: input.email, password: input.password });
}

export async function refreshSession(input: RefreshInput): Promise<AuthTokens> {
  return refreshWithToken(input.refreshToken);
}

export async function getCurrentUser(idToken: string): Promise<CurrentUser> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified ?? false,
      displayName: decoded.name,
    };
  } catch {
    throw unauthorized("Token inválido o expirado");
  }
}

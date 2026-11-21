import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

import { HttpError } from "@/http/errors";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(500, "CONFIG_ERROR", `Falta la variable ${name}`);
  }
  return value;
}

function getAdminApp(): App {
  const [app] = getApps();
  if (app) {
    return app;
  }
  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getWebApiKey(): string {
  return requireEnv("FIREBASE_WEB_API_KEY");
}

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAuth } from "@/config/firebase";
import { HttpError } from "@/http/errors";

import { getCurrentUser, loginUser, refreshSession, registerUser } from "./auth";
import { refreshWithToken, signInWithPassword, signUpWithPassword } from "./firebaseAuthApi";

vi.mock("@/config/firebase", () => ({ getAdminAuth: vi.fn() }));
vi.mock("./firebaseAuthApi", () => ({
  signUpWithPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshWithToken: vi.fn(),
}));

const tokens = {
  idToken: "id-token",
  refreshToken: "refresh-token",
  expiresIn: "3600",
};

type AdminAuth = ReturnType<typeof getAdminAuth>;

describe("servicio de autenticación", () => {
  beforeEach(() => {
    vi.mocked(signUpWithPassword).mockResolvedValue(tokens);
    vi.mocked(signInWithPassword).mockResolvedValue(tokens);
    vi.mocked(refreshWithToken).mockResolvedValue(tokens);
  });

  it("registra al usuario y reenvía los datos", async () => {
    await expect(
      registerUser({
        email: "user@test.com",
        password: "secret123",
        displayName: "User",
      }),
    ).resolves.toEqual(tokens);
    expect(signUpWithPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "secret123",
      displayName: "User",
    });
  });

  it("inicia sesión y propaga error 401 de Firebase", async () => {
    const credentials = { email: "user@test.com", password: "secret123" };
    await expect(loginUser(credentials)).resolves.toEqual(tokens);
    expect(signInWithPassword).toHaveBeenCalledWith(credentials);

    vi.mocked(signInWithPassword).mockRejectedValueOnce(
      new HttpError(401, "UNAUTHORIZED", "Credenciales inválidas"),
    );
    await expect(loginUser(credentials)).rejects.toMatchObject({ status: 401 });
  });

  it("propaga error 400 de Firebase en login", async () => {
    vi.mocked(signInWithPassword).mockRejectedValueOnce(
      new HttpError(400, "BAD_REQUEST", "Correo inválido"),
    );
    await expect(loginUser({ email: "bad", password: "secret123" })).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("refresca la sesión", async () => {
    await expect(refreshSession({ refreshToken: "refresh-token" })).resolves.toEqual(tokens);
    expect(refreshWithToken).toHaveBeenCalledWith("refresh-token");
  });

  it("verifica el idToken con firebase-admin", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: "uid-1",
      email: "user@test.com",
      email_verified: true,
      name: "User",
    });
    vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken } as unknown as AdminAuth);

    await expect(getCurrentUser("id-token")).resolves.toEqual({
      uid: "uid-1",
      email: "user@test.com",
      emailVerified: true,
      displayName: "User",
    });
    expect(verifyIdToken).toHaveBeenCalledWith("id-token");
  });

  it("usa valores por defecto cuando Firebase no devuelve datos opcionales", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: "uid-2" });
    vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken } as unknown as AdminAuth);

    await expect(getCurrentUser("id-token")).resolves.toEqual({
      uid: "uid-2",
      email: undefined,
      emailVerified: false,
      displayName: undefined,
    });
  });

  it("devuelve 401 cuando verifyIdToken falla", async () => {
    const verifyIdToken = vi.fn().mockRejectedValue(new Error("auth/id-token-expired"));
    vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken } as unknown as AdminAuth);

    await expect(getCurrentUser("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
});

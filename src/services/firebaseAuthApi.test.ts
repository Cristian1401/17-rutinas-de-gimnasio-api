import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWebApiKey } from "@/config/firebase";

import { refreshWithToken, signInWithPassword, signUpWithPassword } from "./firebaseAuthApi";

vi.mock("@/config/firebase", () => ({ getWebApiKey: vi.fn(() => "clave-falsa") }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const passwordTokens = {
  idToken: "id-token",
  refreshToken: "refresh-token",
  expiresIn: "3600",
  localId: "uid-1",
  email: "user@test.com",
};

describe("cliente REST de Firebase Auth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registra usuarios con la web api key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(passwordTokens));

    await expect(
      signUpWithPassword({ email: "user@test.com", password: "secret123", displayName: "User" }),
    ).resolves.toEqual({
      idToken: "id-token",
      refreshToken: "refresh-token",
      expiresIn: "3600",
      uid: "uid-1",
      email: "user@test.com",
    });
    expect(getWebApiKey).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=clave-falsa",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("inicia sesión", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(passwordTokens));

    await expect(
      signInWithPassword({ email: "user@test.com", password: "secret123" }),
    ).resolves.toMatchObject({ idToken: "id-token" });
  });

  it("refresca token y normaliza la respuesta", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id_token: "new-id-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        user_id: "uid-1",
      }),
    );

    await expect(refreshWithToken("refresh-token")).resolves.toEqual({
      idToken: "new-id-token",
      refreshToken: "new-refresh-token",
      expiresIn: "3600",
      uid: "uid-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://securetoken.googleapis.com/v1/token?key=clave-falsa",
      expect.objectContaining({ body: "grant_type=refresh_token&refresh_token=refresh-token" }),
    );
  });

  it("mapea credenciales inválidas a 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }, 400),
    );

    await expect(
      signInWithPassword({ email: "user@test.com", password: "secret123" }),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("mapea errores de validación a 400", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "INVALID_EMAIL" } }, 400));

    await expect(signInWithPassword({ email: "bad", password: "secret123" })).rejects.toMatchObject(
      { status: 400, code: "BAD_REQUEST" },
    );
  });

  it("mapea correo duplicado a 409", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "EMAIL_EXISTS" } }, 400));

    await expect(
      signUpWithPassword({ email: "user@test.com", password: "secret123" }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("mapea errores desconocidos de Firebase", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: {} }, 500));
    await expect(refreshWithToken("refresh-token")).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse("boom", 500));
    await expect(refreshWithToken("refresh-token")).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("rechaza respuestas inválidas y fallos de red", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ idToken: "incompleto" }));
    await expect(
      signInWithPassword({ email: "user@test.com", password: "secret123" }),
    ).rejects.toMatchObject({ status: 502 });

    fetchMock.mockResolvedValueOnce(jsonResponse({ idToken: "incompleto" }));
    await expect(refreshWithToken("refresh-token")).rejects.toMatchObject({ status: 502 });

    fetchMock.mockResolvedValueOnce(new Response("no-json", { status: 200 }));
    await expect(refreshWithToken("refresh-token")).rejects.toMatchObject({ status: 502 });

    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(refreshWithToken("refresh-token")).rejects.toMatchObject({ status: 502 });
  });
});

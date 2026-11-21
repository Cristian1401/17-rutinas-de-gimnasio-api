import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { POST as registro } from "@/app/api/auth/registro/route";
import { GET as yo } from "@/app/api/auth/yo/route";
import { HttpError } from "@/http/errors";
import { getCurrentUser, loginUser, refreshSession, registerUser } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  refreshSession: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const tokens = {
  idToken: "id-token",
  refreshToken: "refresh-token",
  expiresIn: "3600",
};

const user = {
  uid: "uid-1",
  email: "user@test.com",
  emailVerified: true,
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("route handlers de autenticación", () => {
  beforeEach(() => {
    vi.mocked(registerUser).mockResolvedValue(tokens);
    vi.mocked(loginUser).mockResolvedValue(tokens);
    vi.mocked(refreshSession).mockResolvedValue(tokens);
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it("registra y devuelve 201", async () => {
    const response = await registro(
      jsonRequest("http://localhost/api/auth/registro", {
        email: "user@test.com",
        password: "secret123",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(tokens);
  });

  it("devuelve 400 cuando el cuerpo de registro es inválido", async () => {
    const response = await registro(
      jsonRequest("http://localhost/api/auth/registro", { email: "bad", password: "123" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos inválidos",
        details: expect.any(Array),
      },
    });
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("devuelve 401 cuando login falla", async () => {
    vi.mocked(loginUser).mockRejectedValueOnce(
      new HttpError(401, "UNAUTHORIZED", "Credenciales inválidas"),
    );
    const response = await login(
      jsonRequest("http://localhost/api/auth/login", {
        email: "user@test.com",
        password: "secret123",
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Credenciales inválidas" },
    });
  });

  it("devuelve 400 cuando el refresh token falta", async () => {
    const response = await refresh(
      jsonRequest("http://localhost/api/auth/refresh", { refreshToken: "" }),
    );
    expect(response.status).toBe(400);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("devuelve 401 cuando no hay bearer token", async () => {
    const response = await yo(new Request("http://localhost/api/auth/yo"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Falta el token" },
    });
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("devuelve 401 cuando Firebase rechaza el token", async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(
      new HttpError(401, "UNAUTHORIZED", "Token inválido o expirado"),
    );
    const request = new Request("http://localhost/api/auth/yo", {
      headers: { authorization: "Bearer bad-token" },
    });
    const response = await yo(request);
    expect(response.status).toBe(401);
  });

  it("devuelve el usuario autenticado", async () => {
    const request = new Request("http://localhost/api/auth/yo", {
      headers: { authorization: "Bearer id-token" },
    });
    const response = await yo(request);
    expect(getCurrentUser).toHaveBeenCalledWith("id-token");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
  });
});

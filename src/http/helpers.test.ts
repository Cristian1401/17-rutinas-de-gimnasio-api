import { z } from "zod";
import { describe, expect, it } from "vitest";

import { readBearerToken } from "./authHeader";
import { HttpError, notFound, toHttpError, unauthorized } from "./errors";
import { handleRouteError, jsonError, jsonOk, readJson } from "./json";
import { getHealthStatus } from "./status";
import { parseBody, parseQuery } from "./validation";

const tokenSchema = z.object({ token: z.string().min(1) });

describe("HTTP helpers", () => {
  it("convierte errores HttpError y errores desconocidos", () => {
    const httpError = unauthorized();
    expect(toHttpError(httpError)).toBe(httpError);
    expect(toHttpError(new Error("boom"))).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
    });
  });

  it("serializa respuestas correctas y de error con detalles", async () => {
    const ok = jsonOk({ ok: true }, 201);
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ ok: true });
    expect(ok.headers.get("content-type")).toContain("application/json");

    const error = jsonError(new HttpError(400, "VALIDATION_ERROR", "Datos inválidos", ["email"]));
    expect(error.status).toBe(400);
    expect(await error.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Datos inválidos", details: ["email"] },
    });
  });

  it("omite detalles cuando no están definidos", async () => {
    const response = handleRouteError(new Error("boom"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Error interno" },
    });
  });

  it("lee JSON válido y rechaza JSON inválido", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ email: "user@test.com" }),
    });
    await expect(readJson(request)).resolves.toEqual({ email: "user@test.com" });

    const invalid = new Request("http://localhost", { method: "POST", body: "no-json" });
    await expect(readJson(invalid)).rejects.toMatchObject({ status: 400 });
  });

  it("parsea con zod y devuelve detalles de validación", () => {
    expect(parseBody(tokenSchema, { token: "abc" })).toEqual({ token: "abc" });
    expect(() => parseBody(tokenSchema, {})).toThrowError(HttpError);
  });

  it("parsea query params con zod", () => {
    const request = new Request("http://localhost/api/rutina?since=2026-01-01T00:00:00Z");
    expect(parseQuery(z.object({ since: z.iso.datetime() }), request)).toEqual({
      since: "2026-01-01T00:00:00Z",
    });
    expect(() =>
      parseQuery(z.object({ since: z.iso.datetime() }), new Request("http://localhost?x=1")),
    ).toThrow(HttpError);
  });

  it("crea errores 404", () => {
    expect(notFound("No encontrado")).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("lee el bearer token y rechaza cabeceras inválidas", () => {
    expect(readBearerToken("Bearer token-123")).toBe("token-123");
    expect(() => readBearerToken(null)).toThrow(HttpError);
    expect(() => readBearerToken("Basic token-123")).toThrow(HttpError);
    expect(() => readBearerToken("Bearer token extra")).toThrow(HttpError);
  });

  it("devuelve el estado de salud", () => {
    expect(getHealthStatus()).toBe("ok");
  });
});

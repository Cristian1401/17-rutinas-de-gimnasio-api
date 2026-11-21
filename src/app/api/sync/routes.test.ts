import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getProgresoRoute } from "@/app/api/progreso/route";
import { GET as getRutinas } from "@/app/api/rutina/route";
import {
  DELETE as deleteRutina,
  GET as getRutina,
  PUT as putRutina,
} from "@/app/api/rutina/[id]/route";
import { GET as getSeries } from "@/app/api/serie_hecha/route";
import { PUT as putSerie } from "@/app/api/serie_hecha/[id]/route";
import { requireUid } from "@/auth/requireUid";
import { getProgreso } from "@/services/progreso";
import { rutinaService, serieHechaService } from "@/services/sync";

vi.mock("@/auth/requireUid", () => ({ requireUid: vi.fn() }));
vi.mock("@/services/progreso", () => ({ getProgreso: vi.fn() }));
vi.mock("@/services/sync", () => ({
  rutinaService: {
    get: vi.fn(),
    listSince: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
  },
  serieHechaService: {
    get: vi.fn(),
    listSince: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
  },
}));

const rutina = { nombre: "Rutina A", updated_at: "2026-01-01T00:00:00Z" };
const storedRutina = { ...rutina, id: "r1" };
const serie = {
  ejercicio: "Press banca",
  peso: 100,
  repeticiones: 5,
  fecha: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const storedSerie = { ...serie, id: "s1" };
const progreso = { ejercicio: "Press banca", oneRepMax: 116.67, series: 1 };

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("rutas de sincronización y progreso", () => {
  beforeEach(() => {
    vi.mocked(requireUid).mockResolvedValue("uid-a");
    vi.mocked(rutinaService.listSince).mockResolvedValue([storedRutina]);
    vi.mocked(rutinaService.get).mockResolvedValue(storedRutina);
    vi.mocked(rutinaService.upsert).mockResolvedValue(storedRutina);
    vi.mocked(rutinaService.remove).mockResolvedValue({
      ...storedRutina,
      deleted_at: "2026-02-01T00:00:00Z",
    });
    vi.mocked(serieHechaService.listSince).mockResolvedValue([storedSerie]);
    vi.mocked(serieHechaService.upsert).mockResolvedValue(storedSerie);
    vi.mocked(getProgreso).mockResolvedValue(progreso);
  });

  it("lista rutinas solo del uid del token", async () => {
    vi.mocked(rutinaService.listSince).mockImplementation(async (uid) =>
      uid === "uid-a" ? [storedRutina] : [],
    );
    const request = new Request("http://localhost/api/rutina?since=2026-01-01T00:00:00Z");
    const response = await getRutinas(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [storedRutina] });
    expect(rutinaService.listSince).toHaveBeenCalledWith("uid-a", "2026-01-01T00:00:00Z");
    expect(rutinaService.listSince).not.toHaveBeenCalledWith("uid-b", expect.anything());
  });

  it("rechaza un since inválido", async () => {
    const response = await getRutinas(new Request("http://localhost/api/rutina?since=no-vale"));
    expect(response.status).toBe(400);
    expect(rutinaService.listSince).not.toHaveBeenCalled();
  });

  it("rechaza uid en el cuerpo de la rutina", async () => {
    const response = await putRutina(
      jsonRequest("http://localhost/api/rutina/r1", { ...rutina, uid: "uid-b" }),
      context("r1"),
    );
    expect(response.status).toBe(400);
    expect(rutinaService.upsert).not.toHaveBeenCalled();
  });

  it("guarda la rutina con el uid del token", async () => {
    const response = await putRutina(
      jsonRequest("http://localhost/api/rutina/r1", rutina),
      context("r1"),
    );
    expect(response.status).toBe(200);
    expect(rutinaService.upsert).toHaveBeenCalledWith("uid-a", "r1", rutina);
    expect(await response.json()).toEqual(storedRutina);
  });

  it("devuelve 404 si la rutina no existe para ese usuario", async () => {
    vi.mocked(rutinaService.get).mockResolvedValue(null);
    const response = await getRutina(new Request("http://localhost/api/rutina/r1"), context("r1"));
    expect(response.status).toBe(404);
    expect(rutinaService.get).toHaveBeenCalledWith("uid-a", "r1");
  });

  it("borra lógicamente la rutina del usuario", async () => {
    const response = await deleteRutina(
      new Request("http://localhost/api/rutina/r1", { method: "DELETE" }),
      context("r1"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "r1",
      deleted_at: "2026-02-01T00:00:00Z",
    });
    expect(rutinaService.remove).toHaveBeenCalledWith("uid-a", "r1");
  });

  it("lista series del uid del token", async () => {
    vi.mocked(serieHechaService.listSince).mockImplementation(async (uid) =>
      uid === "uid-a" ? [storedSerie] : [],
    );
    const response = await getSeries(new Request("http://localhost/api/serie_hecha"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [storedSerie] });
    expect(serieHechaService.listSince).toHaveBeenCalledWith("uid-a", undefined);
  });

  it("guarda una serie con el uid del token", async () => {
    const response = await putSerie(
      jsonRequest("http://localhost/api/serie_hecha/s1", serie),
      context("s1"),
    );
    expect(response.status).toBe(200);
    expect(serieHechaService.upsert).toHaveBeenCalledWith("uid-a", "s1", serie);
  });

  it("calcula el progreso del uid del token", async () => {
    vi.mocked(getProgreso).mockImplementation(async (uid) =>
      uid === "uid-a" ? progreso : { ...progreso, oneRepMax: 0 },
    );
    const response = await getProgresoRoute(
      new Request("http://localhost/api/progreso?ejercicio=Press%20banca"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(progreso);
    expect(getProgreso).toHaveBeenCalledWith("uid-a", "Press banca");
    expect(getProgreso).not.toHaveBeenCalledWith("uid-b", "Press banca");
  });

  it("rechaza progreso sin ejercicio", async () => {
    const response = await getProgresoRoute(new Request("http://localhost/api/progreso"));
    expect(response.status).toBe(400);
    expect(getProgreso).not.toHaveBeenCalled();
  });
});

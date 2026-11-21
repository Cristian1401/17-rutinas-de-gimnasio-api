import { beforeEach, describe, expect, it, vi } from "vitest";

import { rutinaRepository, serieHechaRepository } from "@/repositories/sync";

import { rutinaService, serieHechaService } from "./sync";

vi.mock("@/repositories/sync", () => ({
  rutinaRepository: {
    get: vi.fn(),
    listSince: vi.fn(),
    upsertIfNewer: vi.fn(),
    markDeleted: vi.fn(),
  },
  serieHechaRepository: {
    get: vi.fn(),
    listSince: vi.fn(),
    upsertIfNewer: vi.fn(),
    markDeleted: vi.fn(),
    listByExercise: vi.fn(),
  },
}));

const rutina = {
  nombre: "Rutina A",
  updated_at: "2026-01-01T00:00:00Z",
};

const serie = {
  ejercicio: "Press banca",
  peso: 100,
  repeticiones: 5,
  fecha: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("servicio de sincronización", () => {
  beforeEach(() => {
    vi.mocked(rutinaRepository.get).mockResolvedValue({ ...rutina, id: "r1" });
    vi.mocked(rutinaRepository.listSince).mockResolvedValue([{ ...rutina, id: "r1" }]);
    vi.mocked(rutinaRepository.upsertIfNewer).mockResolvedValue({ ...rutina, id: "r1" });
    vi.mocked(rutinaRepository.markDeleted).mockResolvedValue({ ...rutina, id: "r1" });
    vi.mocked(serieHechaRepository.get).mockResolvedValue({ ...serie, id: "s1" });
    vi.mocked(serieHechaRepository.listSince).mockResolvedValue([{ ...serie, id: "s1" }]);
    vi.mocked(serieHechaRepository.upsertIfNewer).mockResolvedValue({ ...serie, id: "s1" });
    vi.mocked(serieHechaRepository.markDeleted).mockResolvedValue({ ...serie, id: "s1" });
  });

  it("usa el uid del token para rutinas", async () => {
    await expect(rutinaService.get("uid-a", "r1")).resolves.toEqual({ ...rutina, id: "r1" });
    expect(rutinaRepository.get).toHaveBeenCalledWith("uid-a", "r1");

    await expect(rutinaService.listSince("uid-a", "2026-01-01T00:00:00Z")).resolves.toHaveLength(1);
    expect(rutinaRepository.listSince).toHaveBeenCalledWith("uid-a", "2026-01-01T00:00:00Z");

    await expect(rutinaService.upsert("uid-a", "r1", rutina)).resolves.toEqual({
      ...rutina,
      id: "r1",
    });
    expect(rutinaRepository.upsertIfNewer).toHaveBeenCalledWith("uid-a", "r1", rutina);
  });

  it("borra lógicamente rutinas con timestamp explícito", async () => {
    await expect(rutinaService.remove("uid-a", "r1", "2026-02-01T00:00:00Z")).resolves.toEqual({
      ...rutina,
      id: "r1",
    });
    expect(rutinaRepository.markDeleted).toHaveBeenCalledWith(
      "uid-a",
      "r1",
      "2026-02-01T00:00:00Z",
    );
  });

  it("usa el uid del token para series", async () => {
    await expect(serieHechaService.get("uid-a", "s1")).resolves.toEqual({ ...serie, id: "s1" });
    expect(serieHechaRepository.get).toHaveBeenCalledWith("uid-a", "s1");

    await expect(serieHechaService.listSince("uid-a")).resolves.toHaveLength(1);
    expect(serieHechaRepository.listSince).toHaveBeenCalledWith("uid-a", undefined);

    await expect(serieHechaService.upsert("uid-a", "s1", serie)).resolves.toEqual({
      ...serie,
      id: "s1",
    });
    expect(serieHechaRepository.upsertIfNewer).toHaveBeenCalledWith("uid-a", "s1", serie);
  });

  it("genera timestamp al borrar series", async () => {
    await expect(serieHechaService.remove("uid-a", "s1")).resolves.toEqual({ ...serie, id: "s1" });
    expect(serieHechaRepository.markDeleted).toHaveBeenCalledWith(
      "uid-a",
      "s1",
      expect.any(String),
    );
  });
});

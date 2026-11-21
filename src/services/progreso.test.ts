import { beforeEach, describe, expect, it, vi } from "vitest";

import { serieHechaRepository, type SyncEntity } from "@/repositories/sync";
import type { SerieHechaRecord } from "@/schemas/sync";

import { getProgreso } from "./progreso";

vi.mock("@/repositories/sync", () => ({
  serieHechaRepository: { listByExercise: vi.fn() },
}));

function serie(id: string, peso: number, repeticiones: number): SyncEntity<SerieHechaRecord> {
  return {
    id,
    ejercicio: "Press banca",
    peso,
    repeticiones,
    fecha: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  };
}

describe("progreso", () => {
  beforeEach(() => {
    vi.mocked(serieHechaRepository.listByExercise).mockImplementation(async (uid) =>
      uid === "uid-a"
        ? [serie("s1", 100, 5), serie("s2", 80, 2), serie("s3", 60, 1)]
        : [serie("s9", 200, 10)],
    );
  });

  it("calcula el 1RM con la fórmula de Epley", async () => {
    await expect(getProgreso("uid-a", "Press banca")).resolves.toEqual({
      ejercicio: "Press banca",
      oneRepMax: 116.67,
      series: 3,
      mejorSerie: {
        id: "s1",
        peso: 100,
        repeticiones: 5,
        fecha: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("usa el peso cuando solo hay una repetición", async () => {
    vi.mocked(serieHechaRepository.listByExercise).mockResolvedValueOnce([serie("s3", 60, 1)]);
    await expect(getProgreso("uid-a", "Press banca")).resolves.toMatchObject({
      oneRepMax: 60,
      series: 1,
    });
  });

  it("devuelve cero cuando no hay series", async () => {
    vi.mocked(serieHechaRepository.listByExercise).mockResolvedValueOnce([]);
    await expect(getProgreso("uid-a", "Press banca")).resolves.toEqual({
      ejercicio: "Press banca",
      oneRepMax: 0,
      series: 0,
      mejorSerie: undefined,
    });
  });

  it("aísla el progreso entre usuarios", async () => {
    await getProgreso("uid-a", "Press banca");
    expect(serieHechaRepository.listByExercise).toHaveBeenCalledWith("uid-a", "Press banca");
    expect(serieHechaRepository.listByExercise).not.toHaveBeenCalledWith("uid-b", "Press banca");

    await expect(getProgreso("uid-b", "Press banca")).resolves.toMatchObject({
      oneRepMax: 266.67,
      series: 1,
    });
  });
});

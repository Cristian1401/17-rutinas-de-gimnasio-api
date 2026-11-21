import { serieHechaRepository, type SyncEntity } from "@/repositories/sync";
import type { SerieHechaRecord } from "@/schemas/sync";

export interface MejorSerie {
  id: string;
  peso: number;
  repeticiones: number;
  fecha?: string;
}

export interface Progreso {
  ejercicio: string;
  oneRepMax: number;
  series: number;
  mejorSerie?: MejorSerie;
}

interface SerieCalculada extends MejorSerie {
  oneRepMax: number;
}

function calcularOneRepMax(peso: number, repeticiones: number): number {
  const valor = repeticiones <= 1 ? peso : peso * (1 + repeticiones / 30);
  return Math.round(valor * 100) / 100;
}

function calcularSerie(item: SyncEntity<SerieHechaRecord>): SerieCalculada {
  return {
    id: item.id,
    peso: item.peso,
    repeticiones: item.repeticiones,
    fecha: item.fecha,
    oneRepMax: calcularOneRepMax(item.peso, item.repeticiones),
  };
}

export async function getProgreso(uid: string, ejercicio: string): Promise<Progreso> {
  const items = await serieHechaRepository.listByExercise(uid, ejercicio);
  const calculadas = items.map(calcularSerie);
  const mejor = calculadas.reduce<SerieCalculada | undefined>(
    (actual, serie) => (!actual || serie.oneRepMax > actual.oneRepMax ? serie : actual),
    undefined,
  );

  return {
    ejercicio,
    oneRepMax: mejor?.oneRepMax ?? 0,
    series: calculadas.length,
    mejorSerie: mejor
      ? {
          id: mejor.id,
          peso: mejor.peso,
          repeticiones: mejor.repeticiones,
          fecha: mejor.fecha,
        }
      : undefined,
  };
}

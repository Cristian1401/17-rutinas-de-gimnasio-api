import { z } from "zod";

const datetime = () => z.iso.datetime({ offset: true });

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const sinceQuerySchema = z.object({ since: datetime().optional() }).strict();

const syncFields = {
  updated_at: datetime(),
  deleted_at: datetime().nullable().optional(),
};

export const rutinaSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    descripcion: z.string().max(500).optional(),
    ...syncFields,
  })
  .strict();

export const serieHechaSchema = z
  .object({
    ejercicio: z.string().trim().min(1).max(120),
    peso: z.number().finite().nonnegative(),
    repeticiones: z.number().int().positive(),
    fecha: datetime(),
    rutina_id: z.string().min(1).max(128).optional(),
    ...syncFields,
  })
  .strict();

export type RutinaRecord = z.infer<typeof rutinaSchema>;
export type SerieHechaRecord = z.infer<typeof serieHechaSchema>;

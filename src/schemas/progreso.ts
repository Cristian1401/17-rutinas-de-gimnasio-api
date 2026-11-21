import { z } from "zod";

export const progresoQuerySchema = z
  .object({
    ejercicio: z.string().trim().min(1).max(120),
  })
  .strict();

export type ProgresoQuery = z.infer<typeof progresoQuerySchema>;

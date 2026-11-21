import { z } from "zod";

export const registroSchema = z
  .object({
    email: z.email("Correo inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    displayName: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.email("Correo inválido"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "El refresh token es obligatorio"),
  })
  .strict();

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

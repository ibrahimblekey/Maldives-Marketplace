import { z } from "zod";

/**
 * Password policy: enforced server-side. This is intentionally the only
 * place this rule is defined — reused by registration and (later) password
 * reset/change flows, so the rule never drifts between them.
 */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters long")
  .max(128, "Password is too long")
  .refine((val) => /[a-z]/.test(val), "Password must include a lowercase letter")
  .refine((val) => /[A-Z]/.test(val), "Password must include an uppercase letter")
  .refine((val) => /[0-9]/.test(val), "Password must include a number");

/**
 * Registration input as accepted from the client.
 *
 * Deliberately has NO `role` field: role is never taken from client input.
 * Every account starts as TRAVELER (see the registration route). Becoming a
 * HOST happens through a separate onboarding flow, and ADMIN/SUPER_ADMIN
 * accounts are never self-service — they're created by another admin or by
 * the seed script.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100, "Name is too long"),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(255),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

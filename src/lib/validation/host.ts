import { z } from "zod";

/** "Become a host" / host details form. */
export const hostProfileInputSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(120, "Business name is too long (max 120 characters)"),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, e.g. +960 777 1234"),
  businessRegistrationNumber: z
    .string()
    .trim()
    .max(60, "Registration number is too long")
    .optional()
    .transform((v) => v || undefined),
});
export type HostProfileInput = z.infer<typeof hostProfileInputSchema>;

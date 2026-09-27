import { z } from "zod";

/** The documents every host uploads before verification (docs/decisions.md → "Host verification"). */
export const VERIFICATION_DOCUMENT_TYPES = [
  {
    key: "TOURISM_LICENCE",
    label: "Ministry of Tourism operating licence or permit",
    help: "The certificate showing your licence number, business name and island.",
  },
  {
    key: "BUSINESS_REGISTRATION",
    label: "Business registration certificate",
    help: "Company, partnership or sole proprietorship registration.",
  },
  {
    key: "TGST_CERTIFICATE",
    label: "TGST registration certificate",
    help: "Your Tourism Goods and Services Tax registration from MIRA.",
  },
  {
    key: "OWNER_ID",
    label: "Owner's ID card or passport",
    help: "Front and back of the ID card, or the passport photo page.",
  },
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number]["key"];

export const MAX_FILES_PER_DOCUMENT_TYPE = 3;

export function isVerificationDocumentType(value: unknown): value is VerificationDocumentType {
  return VERIFICATION_DOCUMENT_TYPES.some((t) => t.key === value);
}

export function documentTypeLabel(key: string) {
  return VERIFICATION_DOCUMENT_TYPES.find((t) => t.key === key)?.label ?? key;
}

export const licenceDetailsSchema = z.object({
  licenceNumber: z.string().trim().min(3, "Enter your licence or permit number").max(60, "Licence number is too long"),
  licenceBusinessName: z
    .string()
    .trim()
    .min(2, "Enter the business name exactly as it's written on the licence")
    .max(160, "Business name is too long"),
  licenceIslandId: z.string().trim().min(1, "Select the island written on the licence"),
});
export type LicenceDetailsInput = z.infer<typeof licenceDetailsSchema>;

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import { isVerificationDocumentType } from "@/lib/validation/verification";
import { addVerificationDocument, assertCanUploadDocument } from "@/server/services/verification-service";
import { UserFacingError } from "@/server/services/errors";
import {
  DocumentStorageNotConfiguredError,
  MAX_DOCUMENT_BYTES,
  deleteVerificationDocuments,
  detectDocumentKind,
  storeVerificationDocument,
} from "@/server/storage/document-storage";

/**
 * Upload one verification document (multipart fields "document" and
 * "documentType"). A route handler rather than a server action because
 * documents are bigger than a server action's 1 MB body limit. Treats the
 * upload as hostile: re-checks the HOST role, enforces the size limit, and
 * identifies the file by its bytes (only JPEG/PNG/WebP images and PDFs are
 * stored). Files go to private storage (document-storage.ts).
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireRole(["HOST"])).user.id;
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const tooLarge = "That file is too large (max 4 MB). Take a photo instead, or save the PDF at a smaller size.";
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_DOCUMENT_BYTES + 64 * 1024) return NextResponse.json({ error: tooLarge }, { status: 413 });

  let stored: string | null = null;
  try {
    const form = await request.formData();
    const documentType = form.get("documentType");
    const file = form.get("document");
    if (!isVerificationDocumentType(documentType)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was received." }, { status: 400 });
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: tooLarge }, { status: 413 });

    const hostProfileId = await assertCanUploadDocument(userId, documentType);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectDocumentKind(bytes);
    if (!kind) return NextResponse.json({ error: "Only PDF files or photos (JPEG, PNG, WebP) are accepted." }, { status: 415 });

    stored = await storeVerificationDocument(hostProfileId, bytes, kind);
    const fileName = (form.get("fileName")?.toString() || file.name || "document").replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) || "document";
    const doc = await addVerificationDocument(userId, documentType, {
      fileUrl: stored,
      fileName,
      contentType: kind.contentType,
      sizeBytes: bytes.length,
    });
    revalidatePath("/dashboard/host", "layout");
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (err) {
    // Stored, but the database refused it (e.g. submitted in another tab): don't leave the file behind.
    if (stored) await deleteVerificationDocuments([stored]);
    if (err instanceof UserFacingError || err instanceof DocumentStorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[document-upload] unexpected error:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

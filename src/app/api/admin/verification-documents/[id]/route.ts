import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import { openDocumentForAdmin } from "@/server/services/verification-service";
import { NotFoundError } from "@/server/services/errors";
import { readVerificationDocument } from "@/server/storage/document-storage";

/**
 * The only way to open a verification document: admins only, every
 * opening audit-logged, never cached. The file is streamed from private
 * storage; its URL is never sent to the browser.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/verification-documents/[id]">) {
  const { id } = await ctx.params;
  let adminUserId: string;
  try {
    adminUserId = (await requireRole(["ADMIN", "SUPER_ADMIN"])).user.id;
  } catch (err) {
    if (err instanceof UnauthenticatedError) return new Response("Sign in as an admin to open this document.", { status: 401 });
    if (err instanceof ForbiddenError) return new Response("Only admins can open verification documents.", { status: 403 });
    throw err;
  }

  try {
    const doc = await openDocumentForAdmin(adminUserId, id);
    const body = await readVerificationDocument(doc.fileUrl);
    if (!body) return new Response("This file is no longer in storage.", { status: 404 });
    const extension = doc.contentType === "application/pdf" ? "pdf" : doc.contentType.split("/")[1];
    const name = doc.fileName.toLowerCase().endsWith(`.${extension}`) ? doc.fileName : `${doc.fileName}.${extension}`;
    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Uploaded content must never run scripts on our site. Images get a
        // sandbox; PDFs can't (browsers refuse to show a sandboxed PDF) but
        // open in the browser's own PDF viewer, which doesn't run as our site.
        ...(doc.contentType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'" }),
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Document not found.", { status: 404 });
    console.error("[document-view] unexpected error:", err);
    return new Response("This document couldn't be opened. Please try again.", { status: 500 });
  }
}

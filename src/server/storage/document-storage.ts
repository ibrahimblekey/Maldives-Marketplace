import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { detectImageKind } from "./photo-storage";

/**
 * Where host verification documents (licences, certificates, ID) live.
 * They're sensitive (docs/decisions.md → "Verification documents"), so
 * they never go in the public photo store:
 *
 * Production: a separate, PRIVATE Vercel Blob store, connected to the
 * project with the environment variable prefix "PRIVATE_BLOB" so its token
 * arrives as PRIVATE_BLOB_READ_WRITE_TOKEN (see README "Verification
 * documents"). Private blobs can't be opened from their URL; the server
 * reads them with the token and hands them only to admins
 * (/api/admin/verification-documents/[id]).
 *
 * Local development without that token: files go to .private-uploads/
 * (git-ignored, outside public/ so they're never served). This fallback is
 * refused in production.
 */

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

export class DocumentStorageNotConfiguredError extends Error {
  constructor() {
    super("Document storage isn't set up yet. An admin needs to connect a private Vercel Blob store to the project.");
    this.name = "DocumentStorageNotConfiguredError";
  }
}

export type DocumentKind = { contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; extension: string };

/** Identifies a document by its bytes: a JPEG/PNG/WebP image or a PDF. Null for anything else. */
export function detectDocumentKind(bytes: Uint8Array): DocumentKind | null {
  const image = detectImageKind(bytes);
  if (image) return image;
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  return null;
}

const token = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || undefined;

function shouldUseLocalFallback() {
  if (token()) return false;
  if (process.env.NODE_ENV === "production") throw new DocumentStorageNotConfiguredError();
  return true;
}

const LOCAL_DIR = path.join(process.cwd(), ".private-uploads");
const LOCAL_PREFIX = "local:";

function localPath(ref: string) {
  const target = path.join(LOCAL_DIR, ref.slice(LOCAL_PREFIX.length));
  // Only ever touch files inside the local document folder.
  if (!target.startsWith(LOCAL_DIR + path.sep)) throw new Error("invalid local document reference");
  return target;
}

/** Stores a validated document and returns its private storage reference. */
export async function storeVerificationDocument(hostProfileId: string, bytes: Uint8Array, kind: DocumentKind): Promise<string> {
  const fileName = `${randomUUID()}.${kind.extension}`;

  if (shouldUseLocalFallback()) {
    const dir = path.join(LOCAL_DIR, hostProfileId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    return `${LOCAL_PREFIX}${hostProfileId}/${fileName}`;
  }

  const blob = await put(`verification/${hostProfileId}/${fileName}`, Buffer.from(bytes), {
    access: "private",
    contentType: kind.contentType,
    addRandomSuffix: false, // the UUID file name is already unguessable and unique
    token: token(),
  });
  return blob.url;
}

/** Reads a stored document. Null if it no longer exists. */
export async function readVerificationDocument(ref: string): Promise<ReadableStream<Uint8Array> | Uint8Array | null> {
  if (ref.startsWith(LOCAL_PREFIX)) {
    return readFile(localPath(ref)).then(
      (buf) => new Uint8Array(buf),
      () => null
    );
  }
  if (!token()) throw new DocumentStorageNotConfiguredError();
  const result = await get(ref, { access: "private", token: token(), useCache: false });
  return result?.stream ?? null;
}

/**
 * Deletes stored documents. Best effort: a failure leaves an orphaned file
 * but must never block the database change that triggered it.
 */
export async function deleteVerificationDocuments(refs: string[]): Promise<void> {
  if (refs.length === 0) return;
  try {
    for (const ref of refs.filter((r) => r.startsWith(LOCAL_PREFIX))) {
      await unlink(localPath(ref)).catch(() => undefined);
    }
    const remote = refs.filter((r) => !r.startsWith(LOCAL_PREFIX));
    if (remote.length > 0 && token()) await del(remote, { token: token() });
  } catch (err) {
    console.error("[document-storage] failed to delete documents:", err);
  }
}

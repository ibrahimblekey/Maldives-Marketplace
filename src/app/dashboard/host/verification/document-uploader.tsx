"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "../../_components/shrink-image";
import styles from "../../ui.module.css";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // must match MAX_DOCUMENT_BYTES on the server
const MAX_ORIGINAL_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2400; // px: sharp enough to read small print on a certificate

/** Uploads files for one verification document. Photos are shrunk in the browser; PDFs are sent as they are. */
export function DocumentUploader({ documentType, remainingSlots }: { documentType: string; remainingSlots: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, remainingSlots);
    const problems: string[] = [];
    if (fileList.length > remainingSlots) problems.push(`Only the first ${remainingSlots} file(s) were uploaded.`);
    setBusy(true);
    setErrors([]);

    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      setStatus(`Uploading file ${index + 1} of ${files.length}...`);
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let body: Blob;
      try {
        if (isPdf) {
          if (file.size > MAX_UPLOAD_BYTES) {
            problems.push(`${file.name}: this PDF is larger than 4 MB. Take a clear photo of the document instead.`);
            continue;
          }
          body = file;
        } else {
          if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
            problems.push(`${file.name}: too large (max 25 MB).`);
            continue;
          }
          body = await shrinkImage(file, { maxEdge: MAX_EDGE, maxBytes: MAX_UPLOAD_BYTES });
        }
      } catch {
        problems.push(`${file.name}: this file couldn't be read. Upload a PDF, or a photo saved as JPEG.`);
        continue;
      }
      const form = new FormData();
      form.append("documentType", documentType);
      form.append("fileName", file.name.replace(/\.(heic|heif|png|webp)$/i, ".jpg"));
      form.append("document", body, isPdf ? "document.pdf" : "document.jpg");
      try {
        const response = await fetch("/api/host/verification/documents", { method: "POST", body: form });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          problems.push(`${file.name}: ${data?.error ?? "upload failed."}`);
          continue;
        }
        uploaded += 1;
      } catch {
        problems.push(`${file.name}: upload failed. Check your connection and try again.`);
      }
    }

    setBusy(false);
    setStatus(uploaded > 0 ? `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded.` : null);
    setErrors(problems);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <label className={styles.buttonSecondary} style={busy ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
        {busy ? "Uploading..." : "Upload PDF or photo"}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {status && (
        <p className={styles.success} role="status" style={{ marginTop: 8 }}>
          {status}
        </p>
      )}
      {errors.map((e) => (
        <p key={e} className={styles.error} role="alert" style={{ marginTop: 8 }}>
          {e}
        </p>
      ))}
    </div>
  );
}

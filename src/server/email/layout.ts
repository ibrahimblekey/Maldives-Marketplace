/**
 * Building blocks for notification emails: one simple, table-based layout
 * that renders in every mail app, plus a matching plain-text version.
 *
 * Everything that comes from users (names, property names, reasons…) goes
 * through escapeHtml — an email is HTML, and a property called
 * "<script>…" must arrive as text, not markup.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute site URL for links in emails. */
export function appUrl(path = "/") {
  const base =
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}

export type EmailRow = [label: string, value: string];

export type EmailContent = {
  heading: string;
  /** Paragraphs of plain text (escaped automatically). */
  intro: string[];
  rows?: EmailRow[];
  button?: { label: string; path: string };
  /** Extra paragraphs after the details. */
  outro?: string[];
};

const BRAND = "#0e7c86";

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = (items: string[] = []) =>
    items
      .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33474e;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  const rows = (content.rows ?? [])
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#7a8a90;font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#0f2a35;font-size:14px;">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");
  const button = content.button
    ? `<p style="margin:22px 0;"><a href="${escapeHtml(appUrl(content.button.path))}" style="background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;display:inline-block;font-size:15px;">${escapeHtml(content.button.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f7f9fa;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fa;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px;">
<tr><td>
<p style="margin:0 0 20px;font-weight:700;font-size:16px;color:#0f2a35;">Maldives <span style="color:${BRAND};">Marketplace</span></p>
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#0f2a35;">${escapeHtml(content.heading)}</h1>
${paragraphs(content.intro)}
${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;border-top:1px solid #e5eaec;padding-top:8px;width:100%;">${rows}</table>` : ""}
${button}
${paragraphs(content.outro)}
</td></tr></table>
<p style="font-size:12px;color:#7a8a90;margin:16px 0 0;">You're receiving this because you have an account on Maldives Marketplace.</p>
</td></tr></table></body></html>`;

  const text = [
    content.heading,
    "",
    ...content.intro,
    ...(content.rows?.length ? ["", ...content.rows.map(([l, v]) => `${l}: ${v}`)] : []),
    ...(content.button ? ["", `${content.button.label}: ${appUrl(content.button.path)}`] : []),
    ...(content.outro?.length ? ["", ...content.outro] : []),
    "",
    "— Maldives Marketplace",
  ].join("\n");

  return { html, text };
}

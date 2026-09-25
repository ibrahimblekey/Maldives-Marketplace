/**
 * Only same-site paths are allowed as "where to go after signing in".
 * Anything else (https://evil.example, //evil.example, javascript:…) falls
 * back to the dashboard, so a crafted login link can't send a user to
 * another website after they sign in.
 */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

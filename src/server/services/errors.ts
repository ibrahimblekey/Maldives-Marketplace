/**
 * Errors whose message is written for the person using the app and is safe
 * to show them as-is. Server actions show these messages directly; anything
 * else thrown is treated as unexpected, logged, and replaced with a generic
 * message so internals (SQL, stack traces) never reach the browser.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Also used when a record exists but belongs to someone else — a host
 * poking at another host's property id gets exactly the same answer as for
 * an id that doesn't exist, so ids can't be probed.
 */
export class NotFoundError extends UserFacingError {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

/** An admin tried to act on a version of a listing that has since changed. */
export class StaleReviewError extends UserFacingError {
  constructor() {
    super(
      "This listing changed after you opened it (the host edited or withdrew it). Reload the page and review it again."
    );
    this.name = "StaleReviewError";
  }
}

/** Maps any thrown error to a message that's safe to show in the UI. */
export function userMessageFor(err: unknown, logContext: string): string {
  if (err instanceof UserFacingError) return err.message;
  console.error(`[${logContext}] unexpected error:`, err);
  return "Something went wrong. Please try again.";
}

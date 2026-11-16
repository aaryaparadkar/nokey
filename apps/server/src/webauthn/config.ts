import type { Env } from "../env";

export type RelyingParty = {
  /** Domain passkeys are scoped to, e.g. "nokey.dev". No scheme, no port. */
  id: string;
  /** Human-readable name shown by some authenticators. */
  name: string;
  /** Exact origin(s) the browser must report in clientDataJSON. */
  origins: string[];
};

/**
 * The browser only lets a page use an RP ID equal to its own host or a
 * registrable suffix of it (sub.nokey.dev may use "nokey.dev"). Catch a
 * misconfiguration at boot rather than as a cryptic SecurityError in the browser.
 */
export function isValidRpIdForOrigin(rpId: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  const hostMatches = host === rpId || host.endsWith(`.${rpId}`);
  // WebAuthn requires a secure context: https, or http://localhost for dev.
  const secure = url.protocol === "https:" || (url.protocol === "http:" && host === "localhost");
  return hostMatches && secure && url.origin === origin;
}

export function createRelyingParty(env: Pick<Env, "RP_ID" | "RP_NAME" | "ORIGIN">): RelyingParty {
  const origins = env.ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, ""));
  for (const origin of origins) {
    if (!isValidRpIdForOrigin(env.RP_ID, origin)) {
      throw new Error(
        `Invalid WebAuthn config: origin "${origin}" is not a secure origin under RP_ID "${env.RP_ID}"`,
      );
    }
  }
  return { id: env.RP_ID, name: env.RP_NAME, origins };
}

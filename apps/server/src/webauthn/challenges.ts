import { and, eq, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Challenge, challenges } from "../db/schema";
import { randomId } from "../lib/ids";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export type ChallengeKind = Challenge["kind"];

/**
 * Store a fresh challenge. The `challenge` (32 random bytes) goes to the
 * browser inside the options; the `id` goes in an HttpOnly cookie so we can
 * find it again on verify without trusting anything the client echoes back.
 */
export function createChallenge(
  db: Db,
  kind: ChallengeKind,
  { userId = null, now = Date.now() }: { userId?: string | null; now?: number } = {},
) {
  return db
    .insert(challenges)
    .values({
      id: randomId(),
      challenge: randomId(32),
      kind,
      userId,
      expiresAt: new Date(now + CHALLENGE_TTL_MS),
    })
    .returning()
    .get();
}

/**
 * Atomically delete-and-return the challenge. Deleting first means a challenge
 * can be used at most once, even if two verify requests race. Returns
 * undefined if missing, of the wrong kind, or expired.
 */
export function consumeChallenge(
  db: Db,
  id: string,
  kind: ChallengeKind,
  { now = Date.now() }: { now?: number } = {},
): Challenge | undefined {
  const row = db
    .delete(challenges)
    .where(and(eq(challenges.id, id), eq(challenges.kind, kind)))
    .returning()
    .get();
  if (!row || row.expiresAt.getTime() <= now) return undefined;
  return row;
}

/** Remove expired challenges. Returns how many were deleted. */
export function sweepExpiredChallenges(db: Db, { now = Date.now() }: { now?: number } = {}) {
  return db
    .delete(challenges)
    .where(lt(challenges.expiresAt, new Date(now)))
    .returning()
    .all().length;
}

import { and, eq, gt, lt } from "drizzle-orm";
import { randomId } from "../../lib/ids";
import type { Db } from "../client";
import { sessions, users } from "../schema";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Extend a session when it is used and has less than this much life left. */
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

/**
 * Only a SHA-256 hash of the token is stored, so a leaked database can't be
 * replayed as cookies.
 */
export const hashToken = (token: string) =>
  new Bun.CryptoHasher("sha256").update(token).digest("base64url");

export function createSession(
  db: Db,
  userId: string,
  { userAgent = null, now = Date.now() }: { userAgent?: string | null; now?: number } = {},
) {
  const token = randomId(32);
  const session = db
    .insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      userAgent: userAgent?.slice(0, 256) ?? null,
      expiresAt: new Date(now + SESSION_TTL_MS),
    })
    .returning()
    .get();
  return { token, session };
}

/** Look up a live session by token; slides the expiry forward when past half-life. */
export function validateSession(db: Db, token: string, { now = Date.now() } = {}) {
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date(now))))
    .get();
  if (!row) return undefined;

  let renewed = false;
  if (row.session.expiresAt.getTime() - now < RENEW_THRESHOLD_MS) {
    row.session.expiresAt = new Date(now + SESSION_TTL_MS);
    db.update(sessions)
      .set({ expiresAt: row.session.expiresAt })
      .where(eq(sessions.id, row.session.id))
      .run();
    renewed = true;
  }
  return { ...row, renewed };
}

export function revokeSession(db: Db, token: string) {
  db.delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run();
}

export function sweepExpiredSessions(db: Db, { now = Date.now() } = {}) {
  return db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .returning()
    .all().length;
}

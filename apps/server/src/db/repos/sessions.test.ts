import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { sessions } from "../schema";
import { createTestDb } from "../test-utils";
import {
  createSession,
  hashToken,
  revokeSession,
  SESSION_TTL_MS,
  sweepExpiredSessions,
  validateSession,
} from "./sessions";
import { createUser } from "./users";

let db: Db;
let userId: string;
beforeEach(() => {
  db = createTestDb();
  userId = createUser(db, { handle: "alice" }).id;
});

describe("sessions", () => {
  test("stores only the token hash", () => {
    const { token, session } = createSession(db, userId);
    expect(session.id).toBe(hashToken(token));
    expect(session.id).not.toBe(token);
    expect(
      db
        .select()
        .from(sessions)
        .all()
        .map((s) => s.id),
    ).not.toContain(token);
  });

  test("validates and returns the user", () => {
    const { token } = createSession(db, userId);
    expect(validateSession(db, token)?.user.handle).toBe("alice");
    expect(validateSession(db, "wrong")).toBeUndefined();
  });

  test("expired sessions are invalid", () => {
    const now = 1_000_000;
    const { token } = createSession(db, userId, { now });
    expect(validateSession(db, token, { now: now + SESSION_TTL_MS })).toBeUndefined();
  });

  test("slides expiry after half-life, not before", () => {
    const now = 1_000_000;
    const { token } = createSession(db, userId, { now });
    expect(validateSession(db, token, { now: now + 1000 })?.renewed).toBe(false);
    const later = now + SESSION_TTL_MS * 0.75;
    const v = validateSession(db, token, { now: later });
    expect(v?.renewed).toBe(true);
    expect(v?.session.expiresAt.getTime()).toBe(later + SESSION_TTL_MS);
    expect(validateSession(db, token, { now: now + SESSION_TTL_MS + 1 })).toBeDefined();
  });

  test("revoke and sweep", () => {
    const a = createSession(db, userId);
    revokeSession(db, a.token);
    expect(validateSession(db, a.token)).toBeUndefined();

    createSession(db, userId, { now: 0 });
    const fresh = createSession(db, userId);
    expect(sweepExpiredSessions(db)).toBe(1);
    expect(validateSession(db, fresh.token)).toBeDefined();
  });
});

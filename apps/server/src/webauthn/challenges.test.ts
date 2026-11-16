import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../db/client";
import { createTestDb } from "../db/test-utils";
import {
  CHALLENGE_TTL_MS,
  consumeChallenge,
  createChallenge,
  sweepExpiredChallenges,
} from "./challenges";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe("challenges", () => {
  test("challenge is 32 random bytes, base64url", () => {
    const c = createChallenge(db, "registration");
    expect(Buffer.from(c.challenge, "base64url")).toHaveLength(32);
    expect(createChallenge(db, "registration").challenge).not.toBe(c.challenge);
  });

  test("can be consumed once", () => {
    const c = createChallenge(db, "authentication");
    expect(consumeChallenge(db, c.id, "authentication")?.challenge).toBe(c.challenge);
    expect(consumeChallenge(db, c.id, "authentication")).toBeUndefined();
  });

  test("rejects wrong kind without consuming it", () => {
    const c = createChallenge(db, "registration");
    expect(consumeChallenge(db, c.id, "authentication")).toBeUndefined();
    expect(consumeChallenge(db, c.id, "registration")).toBeDefined();
  });

  test("rejects expired challenge and still deletes it", () => {
    const now = 1_000_000;
    const c = createChallenge(db, "registration", { now });
    expect(
      consumeChallenge(db, c.id, "registration", { now: now + CHALLENGE_TTL_MS }),
    ).toBeUndefined();
    expect(consumeChallenge(db, c.id, "registration", { now })).toBeUndefined();
  });

  test("valid just before expiry", () => {
    const now = 1_000_000;
    const c = createChallenge(db, "registration", { now });
    expect(
      consumeChallenge(db, c.id, "registration", { now: now + CHALLENGE_TTL_MS - 1 }),
    ).toBeDefined();
  });

  test("stores optional userId", () => {
    const c = createChallenge(db, "registration", { userId: "u1" });
    expect(consumeChallenge(db, c.id, "registration")?.userId).toBe("u1");
  });

  test("sweep removes only expired", () => {
    const now = 1_000_000;
    createChallenge(db, "registration", { now: now - CHALLENGE_TTL_MS - 1 });
    const fresh = createChallenge(db, "registration", { now });
    expect(sweepExpiredChallenges(db, { now })).toBe(1);
    expect(consumeChallenge(db, fresh.id, "registration", { now })).toBeDefined();
  });
});

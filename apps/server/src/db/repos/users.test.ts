import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { credentials } from "../schema";
import { createTestDb } from "../test-utils";
import { createUser, getUserById } from "./users";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe("users repo", () => {
  test("creates and reads a user", () => {
    const user = createUser(db, { handle: "alice" });
    expect(user.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(getUserById(db, user.id)).toEqual(user);
  });

  test("returns undefined for unknown id", () => {
    expect(getUserById(db, "missing")).toBeUndefined();
  });

  test("foreign keys are enforced", () => {
    expect(() =>
      db
        .insert(credentials)
        .values({
          id: "c1",
          userId: "nope",
          publicKey: Buffer.from([1]),
          deviceType: "singleDevice",
        })
        .run(),
    ).toThrow();
  });
});

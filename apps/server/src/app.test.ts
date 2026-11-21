import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createTestDb } from "./db/test-utils";
import { createRelyingParty } from "./webauthn/config";

const app = createApp(
  {
    db: createTestDb(),
    rp: createRelyingParty({
      RP_ID: "localhost",
      RP_NAME: "nokey",
      ORIGIN: "http://localhost:5173",
    }),
    secureCookies: false,
    sessionSecret: "test-secret-test-secret-test-secret",
    trustProxy: false,
  },
  { log: false },
);

describe("app", () => {
  test("GET /api/health returns ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("unknown route returns JSON 404", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Route not found" } });
  });
});

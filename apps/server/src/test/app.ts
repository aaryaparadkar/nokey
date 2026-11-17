import { createApp } from "../app";
import { createTestDb } from "../db/test-utils";
import { createRelyingParty } from "../webauthn/config";

export const TEST_ORIGIN = "http://localhost:5173";

/** App wired to a fresh in-memory DB, plus a tiny cookie-jar client. */
export function createTestApp() {
  const db = createTestDb();
  const app = createApp(
    {
      db,
      rp: createRelyingParty({ RP_ID: "localhost", RP_NAME: "nokey", ORIGIN: TEST_ORIGIN }),
      secureCookies: false,
      sessionSecret: "test-secret-test-secret-test-secret",
    },
    { log: false },
  );

  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  async function req(
    method: string,
    path: string,
    { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const res = await app.request(path, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(method !== "GET" && { Origin: TEST_ORIGIN }),
        ...(jar.size && { Cookie: cookieHeader() }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair = "", ...attrs] = c.split(";");
      const [name = "", ...v] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired) jar.delete(name);
      else jar.set(name, v.join("="));
    }
    return res;
  }

  return { app, db, jar, req };
}

import { beforeEach, describe, expect, test } from "bun:test";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { createApp } from "../app";
import type { Db } from "../db/client";
import { listCredentialsForUser } from "../db/repos/credentials";
import { getUserById } from "../db/repos/users";
import { createTestDb } from "../db/test-utils";
import { FLAGS, SoftAuthenticator } from "../test/soft-authenticator";
import { createRelyingParty } from "../webauthn/config";
import { REG_COOKIE } from "./auth";

const ORIGIN = "http://localhost:5173";
let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createTestDb();
  app = createApp(
    {
      db,
      rp: createRelyingParty({ RP_ID: "localhost", RP_NAME: "nokey", ORIGIN }),
      secureCookies: false,
    },
    { log: false },
  );
});

const post = (path: string, body: unknown, cookie?: string) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(body),
  });

async function getOptions(handle?: string) {
  const res = await post("/register/options", handle ? { handle } : {});
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] as string;
  const options = (await res.json()) as PublicKeyCredentialCreationOptionsJSON;
  return { options, cookie, setCookie };
}

describe("POST /register/options", () => {
  test("returns discoverable-credential options and sets HttpOnly challenge cookie", async () => {
    const { options, setCookie } = await getOptions("alice");
    expect(options.rp).toEqual({ name: "nokey", id: "localhost" });
    expect(options.user.name).toBe("alice");
    expect(Buffer.from(options.user.id, "base64url")).toHaveLength(16);
    expect(Buffer.from(options.challenge, "base64url")).toHaveLength(32);
    expect(options.attestation).toBe("none");
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "preferred",
    });
    expect(setCookie).toContain(`${REG_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/auth");
  });

  test("rejects invalid handle", async () => {
    const res = await post("/register/options", { handle: "<script>" });
    expect(res.status).toBe(400);
  });
});

describe("POST /register/verify", () => {
  test("happy path creates user + credential", async () => {
    const { options, cookie } = await getOptions("alice");
    const authn = new SoftAuthenticator();
    const response = await authn.create(options, { origin: ORIGIN });

    const res = await post("/register/verify", { handle: "alice", response }, cookie);
    expect(res.status).toBe(201);
    const { user } = (await res.json()) as { user: { id: string; handle: string | null } };
    expect(user).toEqual({ id: options.user.id, handle: "alice" });

    expect(getUserById(db, user.id)?.handle).toBe("alice");
    const [cred] = listCredentialsForUser(db, user.id);
    expect(cred?.id).toBe(authn.id);
    expect(cred?.deviceType).toBe("singleDevice");
    expect(cred?.backedUp).toBe(false);
    expect(cred?.transports).toEqual(["internal"]);
  });

  test("records synced passkeys (BE+BS flags)", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, {
      flags: FLAGS.UP | FLAGS.UV | FLAGS.AT | FLAGS.BE | FLAGS.BS,
    });
    const { user } = (await (await post("/register/verify", { response }, cookie)).json()) as {
      user: { id: string };
    };
    const [cred] = listCredentialsForUser(db, user.id);
    expect(cred?.deviceType).toBe("multiDevice");
    expect(cred?.backedUp).toBe(true);
  });

  test("rejects wrong origin (phishing site)", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, {
      origin: "https://evil.example",
    });
    const res = await post("/register/verify", { response }, cookie);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(/origin/i);
  });

  test("rejects wrong RP ID", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, { rpId: "evil.example" });
    const res = await post("/register/verify", { response }, cookie);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(/RP ID/i);
  });

  test("rejects a response signed over a different challenge", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, {
      challenge: Buffer.from("x".repeat(32)).toString("base64url"),
    });
    const res = await post("/register/verify", { response }, cookie);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
      /challenge/i,
    );
  });

  test("rejects when user presence flag is missing", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, { flags: FLAGS.AT });
    expect((await post("/register/verify", { response }, cookie)).status).toBe(400);
  });

  test("rejects missing challenge cookie", async () => {
    const { options } = await getOptions();
    const response = await new SoftAuthenticator().create(options);
    const res = await post("/register/verify", { response });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
      /expired/i,
    );
  });

  test("challenge cannot be replayed", async () => {
    const { options, cookie } = await getOptions();
    const authn = new SoftAuthenticator();
    const response = await authn.create(options);
    expect((await post("/register/verify", { response }, cookie)).status).toBe(201);
    expect((await post("/register/verify", { response }, cookie)).status).toBe(400);
  });

  test("same credential cannot be registered twice", async () => {
    const authn = new SoftAuthenticator();
    const a = await getOptions();
    expect(
      (await post("/register/verify", { response: await authn.create(a.options) }, a.cookie))
        .status,
    ).toBe(201);
    const b = await getOptions();
    const res = await post(
      "/register/verify",
      { response: await authn.create(b.options) },
      b.cookie,
    );
    expect(res.status).toBe(409);
  });

  test("failed verify does not create a user", async () => {
    const { options, cookie } = await getOptions();
    const response = await new SoftAuthenticator().create(options, {
      origin: "https://evil.example",
    });
    await post("/register/verify", { response }, cookie);
    expect(getUserById(db, options.user.id)).toBeUndefined();
  });
});

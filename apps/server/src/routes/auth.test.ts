import { beforeEach, describe, expect, test } from "bun:test";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { listCredentialsForUser } from "../db/repos/credentials";
import { getUserById } from "../db/repos/users";
import { createTestApp, TEST_ORIGIN } from "../test/app";
import { FLAGS, SoftAuthenticator } from "../test/soft-authenticator";
import { REG_COOKIE } from "./auth";

type ErrBody = { error: { message: string } };
type UserBody = { user: { id: string; handle: string | null } };

let t: ReturnType<typeof createTestApp>;
beforeEach(() => {
  t = createTestApp();
});

async function getOptions(handle?: string) {
  const res = await t.req("POST", "/api/auth/register/options", { body: handle ? { handle } : {} });
  expect(res.status).toBe(200);
  return {
    options: (await res.json()) as PublicKeyCredentialCreationOptionsJSON,
    setCookie: res.headers.get("set-cookie") ?? "",
  };
}

const verify = (body: unknown) => t.req("POST", "/api/auth/register/verify", { body });

async function register(handle?: string) {
  const { options } = await getOptions(handle);
  const response = await new SoftAuthenticator().create(options, { origin: TEST_ORIGIN });
  const res = await verify({ handle, response });
  expect(res.status).toBe(201);
  return ((await res.json()) as UserBody).user;
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
    const res = await t.req("POST", "/api/auth/register/options", { body: { handle: "<script>" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /register/verify", () => {
  test("happy path creates user + credential", async () => {
    const { options } = await getOptions("alice");
    const authn = new SoftAuthenticator();
    const res = await verify({ handle: "alice", response: await authn.create(options) });
    expect(res.status).toBe(201);
    const { user } = (await res.json()) as UserBody;
    expect(user).toEqual({ id: options.user.id, handle: "alice" });

    expect(getUserById(t.db, user.id)?.handle).toBe("alice");
    const [cred] = listCredentialsForUser(t.db, user.id);
    expect(cred?.id).toBe(authn.id);
    expect(cred?.deviceType).toBe("singleDevice");
    expect(cred?.backedUp).toBe(false);
    expect(cred?.transports).toEqual(["internal"]);
  });

  test("records synced passkeys (BE+BS flags)", async () => {
    const { options } = await getOptions();
    const response = await new SoftAuthenticator().create(options, {
      flags: FLAGS.UP | FLAGS.UV | FLAGS.AT | FLAGS.BE | FLAGS.BS,
    });
    const { user } = (await (await verify({ response })).json()) as UserBody;
    const [cred] = listCredentialsForUser(t.db, user.id);
    expect(cred?.deviceType).toBe("multiDevice");
    expect(cred?.backedUp).toBe(true);
  });

  test.each([
    ["wrong origin (phishing site)", { origin: "https://evil.example" }, /origin/i],
    ["wrong RP ID", { rpId: "evil.example" }, /RP ID/i],
    [
      "different challenge",
      { challenge: Buffer.from("x".repeat(32)).toString("base64url") },
      /challenge/i,
    ],
    ["missing user presence", { flags: FLAGS.AT }, /./],
  ])("rejects %s", async (_name, opts, msg) => {
    const { options } = await getOptions();
    const res = await verify({ response: await new SoftAuthenticator().create(options, opts) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrBody).error.message).toMatch(msg);
    expect(getUserById(t.db, options.user.id)).toBeUndefined();
  });

  test("rejects missing challenge cookie", async () => {
    const { options } = await getOptions();
    t.jar.clear();
    const res = await verify({ response: await new SoftAuthenticator().create(options) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrBody).error.message).toMatch(/expired/i);
  });

  test("challenge cannot be replayed", async () => {
    const { options } = await getOptions();
    const cookie = t.jar.get(REG_COOKIE) as string;
    const response = await new SoftAuthenticator().create(options);
    expect((await verify({ response })).status).toBe(201);
    t.jar.set(REG_COOKIE, cookie);
    expect((await verify({ response })).status).toBe(400);
  });

  test("same credential cannot be registered twice", async () => {
    const authn = new SoftAuthenticator();
    const a = await getOptions();
    expect((await verify({ response: await authn.create(a.options) })).status).toBe(201);
    const b = await getOptions();
    expect((await verify({ response: await authn.create(b.options) })).status).toBe(409);
  });
});

describe("sessions", () => {
  test("register signs you in; /api/me returns the user", async () => {
    expect((await t.req("GET", "/api/me")).status).toBe(401);
    const user = await register("alice");
    const res = await t.req("GET", "/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user });
  });

  test("session cookie is HttpOnly, Lax, signed", async () => {
    const { options } = await getOptions();
    const res = await verify({ response: await new SoftAuthenticator().create(options) });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("nk_session=")) ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(decodeURIComponent(cookie.split(";")[0] ?? "")).toMatch(/^nk_session=[\w-]+\.[\w+/=]+$/);
  });

  test("tampered cookie is rejected", async () => {
    await register();
    const value = t.jar.get("nk_session") as string;
    t.jar.set("nk_session", `x${value}`);
    expect((await t.req("GET", "/api/me")).status).toBe(401);
  });

  test("logout revokes the session server-side", async () => {
    await register();
    const stolen = t.jar.get("nk_session") as string;
    expect((await t.req("POST", "/api/auth/logout")).status).toBe(200);
    expect(t.jar.has("nk_session")).toBe(false);
    expect((await t.req("GET", "/api/me")).status).toBe(401);
    t.jar.set("nk_session", stolen); // replaying the old cookie doesn't work either
    expect((await t.req("GET", "/api/me")).status).toBe(401);
  });
});

describe("CSRF", () => {
  test("blocks cross-origin POST", async () => {
    await register();
    const res = await t.req("POST", "/api/auth/logout", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect((await t.req("GET", "/api/me")).status).toBe(200);
  });

  test("blocks cookie-bearing POST without Origin", async () => {
    await register();
    const res = await t.app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: `nk_session=${t.jar.get("nk_session")}` },
    });
    expect(res.status).toBe(403);
  });
});

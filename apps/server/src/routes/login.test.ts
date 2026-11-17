import { beforeEach, describe, expect, test } from "bun:test";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { getCredentialById } from "../db/repos/credentials";
import { createTestApp } from "../test/app";
import { FLAGS, SoftAuthenticator } from "../test/soft-authenticator";
import { AUTH_COOKIE } from "./auth";

type ErrBody = { error: { message: string } };
type UserBody = { user: { id: string; handle: string | null } };

let t: ReturnType<typeof createTestApp>;
beforeEach(() => {
  t = createTestApp();
});

/** Register a passkey, then sign out so we start logged out. */
async function registered(handle = "alice", authn = new SoftAuthenticator()) {
  const res = await t.req("POST", "/api/auth/register/options", { body: { handle } });
  const options = (await res.json()) as PublicKeyCredentialCreationOptionsJSON;
  const v = await t.req("POST", "/api/auth/register/verify", {
    body: { handle, response: await authn.create(options) },
  });
  const { user } = (await v.json()) as UserBody;
  await t.req("POST", "/api/auth/logout");
  return { authn, user };
}

async function loginOptions() {
  const res = await t.req("POST", "/api/auth/login/options");
  expect(res.status).toBe(200);
  return {
    options: (await res.json()) as PublicKeyCredentialRequestOptionsJSON,
    setCookie: res.headers.get("set-cookie") ?? "",
  };
}

const verify = (response: unknown) =>
  t.req("POST", "/api/auth/login/verify", { body: { response } });

describe("POST /login/options", () => {
  test("usernameless: empty allowCredentials, fresh challenge, HttpOnly cookie", async () => {
    const { options, setCookie } = await loginOptions();
    expect(options.rpId).toBe("localhost");
    expect(options.allowCredentials ?? []).toEqual([]);
    expect(options.userVerification).toBe("preferred");
    expect(Buffer.from(options.challenge, "base64url")).toHaveLength(32);
    expect(setCookie).toContain(`${AUTH_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/auth");
  });
});

describe("POST /login/verify", () => {
  test("signs in with a registered passkey", async () => {
    const { authn, user } = await registered();
    expect((await t.req("GET", "/api/me")).status).toBe(401);

    const { options } = await loginOptions();
    const res = await verify(await authn.get(options));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user });
    expect(await (await t.req("GET", "/api/me")).json()).toEqual({ user });
    expect(getCredentialById(t.db, authn.id)?.lastUsedAt).toBeInstanceOf(Date);
  });

  test("works when the authenticator omits userHandle", async () => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    expect((await verify(await authn.get(options, { userHandle: null }))).status).toBe(200);
  });

  test("rejects unknown credential", async () => {
    await registered();
    const { options } = await loginOptions();
    const stranger = new SoftAuthenticator();
    await stranger.create({ challenge: "x", rp: { id: "localhost" } });
    const res = await verify(await stranger.get(options));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrBody).error.message).toMatch(/isn't registered/);
  });

  test("rejects a signature from a different key with the same credential id", async () => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    const impostor = new SoftAuthenticator();
    Object.assign(impostor, { credentialId: authn.credentialId, userHandle: authn.userHandle });
    expect((await verify(await impostor.get(options))).status).toBe(401);
    expect((await t.req("GET", "/api/me")).status).toBe(401);
  });

  test("rejects mismatched user handle", async () => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    const res = await verify(await authn.get(options, { userHandle: "someone-else" }));
    expect(res.status).toBe(401);
  });

  test.each([
    ["wrong origin", { origin: "https://evil.example" }, /origin/i],
    ["wrong RP ID", { rpId: "evil.example" }, /RP ID/i],
    ["different challenge", { challenge: Buffer.alloc(32, 1).toString("base64url") }, /challenge/i],
    ["missing user presence", { flags: 0 }, /./],
  ])("rejects %s", async (_n, opts, msg) => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    const res = await verify(await authn.get(options, opts));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrBody).error.message).toMatch(msg);
  });

  test("challenge cannot be replayed", async () => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    const cookie = t.jar.get(AUTH_COOKIE) as string;
    const response = await authn.get(options);
    expect((await verify(response)).status).toBe(200);
    t.jar.set(AUTH_COOKIE, cookie);
    expect((await verify(response)).status).toBe(400);
  });

  test("a registration challenge can't be used to sign in", async () => {
    const { authn } = await registered();
    const { options } = await loginOptions();
    await t.req("POST", "/api/auth/register/options", { body: {} });
    t.jar.set(AUTH_COOKIE, t.jar.get("nk_reg") as string);
    expect((await verify(await authn.get(options))).status).toBe(400);
  });

  describe("signature counter", () => {
    test("stored and advanced for counting authenticators", async () => {
      const { authn } = await registered();
      for (const n of [5, 6, 10]) {
        const { options } = await loginOptions();
        expect((await verify(await authn.get(options, { counter: n }))).status).toBe(200);
        expect(getCredentialById(t.db, authn.id)?.counter).toBe(n);
      }
    });

    test("regression is rejected (possible cloned key)", async () => {
      const { authn } = await registered();
      let { options } = await loginOptions();
      await verify(await authn.get(options, { counter: 10 }));
      ({ options } = await loginOptions());
      const res = await verify(await authn.get(options, { counter: 9 }));
      expect(res.status).toBe(401);
      expect(((await res.json()) as ErrBody).error.message).toMatch(/counter/i);
      ({ options } = await loginOptions());
      expect((await verify(await authn.get(options, { counter: 10 }))).status).toBe(401);
    });

    test("always-zero counters (synced passkeys) are allowed", async () => {
      const { authn } = await registered();
      for (let i = 0; i < 3; i++) {
        const { options } = await loginOptions();
        expect((await verify(await authn.get(options, { counter: 0 }))).status).toBe(200);
      }
    });
  });

  test("backup state is refreshed on sign-in", async () => {
    const { authn } = await registered();
    expect(getCredentialById(t.db, authn.id)?.backedUp).toBe(false);
    const { options } = await loginOptions();
    await verify(await authn.get(options, { flags: FLAGS.UP | FLAGS.UV | FLAGS.BE | FLAGS.BS }));
    const cred = getCredentialById(t.db, authn.id);
    expect(cred?.backedUp).toBe(true);
    expect(cred?.deviceType).toBe("multiDevice");
  });

  test("signing in replaces the previous session", async () => {
    const { authn } = await registered();
    let { options } = await loginOptions();
    await verify(await authn.get(options));
    const first = t.jar.get("nk_session") as string;
    ({ options } = await loginOptions());
    await verify(await authn.get(options));
    expect(t.jar.get("nk_session")).not.toBe(first);
    t.jar.set("nk_session", first);
    expect((await t.req("GET", "/api/me")).status).toBe(401);
  });
});

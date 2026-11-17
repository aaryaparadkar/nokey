import {
  LoginVerifyRequest,
  type LoginVerifyResponse,
  type OkResponse,
  RegisterOptionsRequest,
  RegisterVerifyRequest,
  type RegisterVerifyResponse,
} from "@nokey/shared";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import { endSession, startSession } from "../lib/session-cookie";
import { validate } from "../lib/validate";
import { beginAuthentication, finishAuthentication } from "../webauthn/authentication";
import { CHALLENGE_TTL_MS, consumeChallenge } from "../webauthn/challenges";
import { beginRegistration, finishRegistration } from "../webauthn/registration";

export const REG_COOKIE = "nk_reg";
export const AUTH_COOKIE = "nk_auth";
const COOKIE_PATH = "/api/auth";

export const auth = new Hono<AppEnv>()
  .post("/register/options", validate("json", RegisterOptionsRequest), async (c) => {
    const { db, rp, secureCookies } = c.get("deps");
    const { handle } = c.req.valid("json");
    const { options, challengeId } = await beginRegistration(db, rp, handle);
    setCookie(c, REG_COOKIE, challengeId, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict",
      path: COOKIE_PATH,
      maxAge: CHALLENGE_TTL_MS / 1000,
    });
    return c.json(options);
  })
  .post("/register/verify", validate("json", RegisterVerifyRequest), async (c) => {
    const { db, rp, secureCookies } = c.get("deps");
    const { handle, response } = c.req.valid("json");

    const challengeId = getCookie(c, REG_COOKIE);
    deleteCookie(c, REG_COOKIE, { path: COOKIE_PATH, secure: secureCookies });
    const challenge = challengeId ? consumeChallenge(db, challengeId, "registration") : undefined;
    if (!challenge?.userId) {
      throw new HTTPException(400, { message: "Registration expired, please try again" });
    }

    const result = await finishRegistration(db, rp, {
      expectedChallenge: challenge.challenge,
      userId: challenge.userId,
      response: response as unknown as RegistrationResponseJSON,
      handle,
    });
    if (!result.ok) {
      throw new HTTPException(result.reason === "already_registered" ? 409 : 400, {
        message: result.message,
      });
    }
    await startSession(c, result.user.id);
    return c.json<RegisterVerifyResponse>({ user: result.user }, 201);
  })
  .post("/login/options", async (c) => {
    const { db, rp, secureCookies } = c.get("deps");
    const { options, challengeId } = await beginAuthentication(db, rp);
    setCookie(c, AUTH_COOKIE, challengeId, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict",
      path: COOKIE_PATH,
      maxAge: CHALLENGE_TTL_MS / 1000,
    });
    return c.json(options);
  })
  .post("/login/verify", validate("json", LoginVerifyRequest), async (c) => {
    const { db, rp, secureCookies } = c.get("deps");
    const { response } = c.req.valid("json");

    const challengeId = getCookie(c, AUTH_COOKIE);
    deleteCookie(c, AUTH_COOKIE, { path: COOKIE_PATH, secure: secureCookies });
    const challenge = challengeId ? consumeChallenge(db, challengeId, "authentication") : undefined;
    if (!challenge) {
      throw new HTTPException(400, { message: "Sign-in expired, please try again" });
    }

    const result = await finishAuthentication(db, rp, {
      expectedChallenge: challenge.challenge,
      response: response as unknown as AuthenticationResponseJSON,
    });
    if (!result.ok) {
      // Same status for unknown vs bad signature; message is safe to show.
      throw new HTTPException(401, { message: result.message });
    }
    await endSession(c); // drop any previous session before starting a new one
    await startSession(c, result.user.id);
    return c.json<LoginVerifyResponse>({
      user: { id: result.user.id, handle: result.user.handle },
    });
  })
  .post("/logout", async (c) => {
    await endSession(c);
    return c.json<OkResponse>({ ok: true });
  });

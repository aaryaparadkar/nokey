import {
  RegisterOptionsRequest,
  RegisterVerifyRequest,
  type RegisterVerifyResponse,
} from "@nokey/shared";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import { validate } from "../lib/validate";
import { CHALLENGE_TTL_MS, consumeChallenge } from "../webauthn/challenges";
import { beginRegistration, finishRegistration } from "../webauthn/registration";

export const REG_COOKIE = "nk_reg";
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
    return c.json<RegisterVerifyResponse>({ user: result.user }, 201);
  });

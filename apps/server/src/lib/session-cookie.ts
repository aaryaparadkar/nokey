import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../context";
import { createSession, revokeSession, SESSION_TTL_MS } from "../db/repos/sessions";

/** "__Host-" makes the browser require Secure, Path=/ and no Domain: no subdomain can overwrite it. */
export const sessionCookieName = (secure: boolean) => (secure ? "__Host-nk_session" : "nk_session");

const cookieOpts = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "Lax" as const,
  path: "/",
});

export async function readSessionToken(c: Context<AppEnv>) {
  const { secureCookies, sessionSecret } = c.get("deps");
  const value = await getSignedCookie(c, sessionSecret, sessionCookieName(secureCookies));
  return value || undefined; // false = bad signature
}

export async function writeSessionCookie(
  c: Context<AppEnv>,
  token: string,
  maxAgeMs = SESSION_TTL_MS,
) {
  const { secureCookies, sessionSecret } = c.get("deps");
  await setSignedCookie(c, sessionCookieName(secureCookies), token, sessionSecret, {
    ...cookieOpts(secureCookies),
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

/** Create a session for `userId` and set the cookie. */
export async function startSession(c: Context<AppEnv>, userId: string) {
  const { db } = c.get("deps");
  const { token } = createSession(db, userId, { userAgent: c.req.header("user-agent") });
  await writeSessionCookie(c, token);
}

export async function endSession(c: Context<AppEnv>) {
  const { db, secureCookies } = c.get("deps");
  const token = await readSessionToken(c);
  if (token) revokeSession(db, token);
  deleteCookie(c, sessionCookieName(secureCookies), cookieOpts(secureCookies));
}

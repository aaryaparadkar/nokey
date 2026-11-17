import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import { validateSession } from "../db/repos/sessions";
import { readSessionToken, writeSessionCookie } from "../lib/session-cookie";

/** Attaches `user` and `session` (or null) to every request. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  c.set("session", null);
  const token = await readSessionToken(c);
  if (token) {
    const result = validateSession(c.get("deps").db, token);
    if (result) {
      c.set("user", result.user);
      c.set("session", result.session);
      if (result.renewed) await writeSessionCookie(c, token);
    }
  }
  await next();
});

/** 401 unless signed in. Narrow with `c.get("user")!` after this. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) throw new HTTPException(401, { message: "Sign in required" });
  await next();
});

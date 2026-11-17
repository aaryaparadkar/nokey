import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie auth needs CSRF protection. SameSite=Lax already blocks most of it;
 * on top of that, every state-changing request must carry an Origin header
 * from one of our own origins. Browsers always send Origin on fetch POSTs.
 * Requests without one (curl, API clients) are rejected only if they carry
 * cookies; token auth (Phase 26) bypasses cookies entirely.
 */
export const csrf = createMiddleware<AppEnv>(async (c, next) => {
  if (!SAFE.has(c.req.method)) {
    const origin = c.req.header("origin");
    const allowed = c.get("deps").rp.origins;
    if (origin ? !allowed.includes(origin) : !!c.req.header("cookie")) {
      throw new HTTPException(403, { message: "Cross-origin request blocked" });
    }
  }
  await next();
});

import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppDeps, AppEnv } from "./context";
import { csrf } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { createRateLimiter, type RateLimitConfig } from "./middleware/rate-limit";
import { sessionMiddleware } from "./middleware/session";
import { auth } from "./routes/auth";
import { health } from "./routes/health";
import { me } from "./routes/me";

/** 20 back to back, then one every 3s per IP. Plenty for humans, slow for scripts. */
export const DEFAULT_AUTH_RATE_LIMIT: RateLimitConfig = { capacity: 20, refillPerMinute: 20 };

export type CreateAppOptions = {
  log?: boolean;
  /** Token bucket for /api/auth/*; false disables it. */
  authRateLimit?: RateLimitConfig | false;
};

export function createApp(
  deps: AppDeps,
  { log = true, authRateLimit = DEFAULT_AUTH_RATE_LIMIT }: CreateAppOptions = {},
) {
  const app = new Hono<AppEnv>();
  const authLimiter = authRateLimit ? createRateLimiter(authRateLimit) : null;
  if (log) app.use(logger());
  app.use(async (c, next) => {
    c.set("deps", deps);
    await next();
  });
  if (authLimiter) {
    app.use("/api/auth/*", authLimiter.middleware);
    setInterval(authLimiter.sweep, 5 * 60_000).unref();
  }
  app.use("/api/*", csrf, sessionMiddleware);
  app.route("/api/health", health);
  app.route("/api/auth", auth);
  app.route("/api/me", me);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;

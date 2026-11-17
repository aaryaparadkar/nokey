import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppDeps, AppEnv } from "./context";
import { csrf } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { sessionMiddleware } from "./middleware/session";
import { auth } from "./routes/auth";
import { health } from "./routes/health";
import { me } from "./routes/me";

export function createApp(deps: AppDeps, { log = true } = {}) {
  const app = new Hono<AppEnv>();
  if (log) app.use(logger());
  app.use(async (c, next) => {
    c.set("deps", deps);
    await next();
  });
  app.use("/api/*", csrf, sessionMiddleware);
  app.route("/api/health", health);
  app.route("/api/auth", auth);
  app.route("/api/me", me);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;

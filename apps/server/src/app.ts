import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppDeps, AppEnv } from "./context";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { auth } from "./routes/auth";
import { health } from "./routes/health";

export function createApp(deps: AppDeps, { log = true } = {}) {
  const app = new Hono<AppEnv>();
  if (log) app.use(logger());
  app.use(async (c, next) => {
    c.set("deps", deps);
    await next();
  });
  app.route("/api/health", health);
  app.route("/api/auth", auth);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;

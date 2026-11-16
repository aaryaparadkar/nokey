import { Hono } from "hono";
import { logger } from "hono/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { health } from "./routes/health";

export function createApp({ log = true } = {}) {
  const app = new Hono();
  if (log) app.use(logger());
  app.route("/api/health", health);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

export type AppType = ReturnType<typeof createApp>;

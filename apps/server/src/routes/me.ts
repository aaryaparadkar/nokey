import type { MeResponse } from "@nokey/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requireAuth } from "../middleware/session";

export const me = new Hono<AppEnv>().get("/", requireAuth, (c) => {
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by requireAuth
  const user = c.get("user")!;
  return c.json<MeResponse>({ user: { id: user.id, handle: user.handle } });
});

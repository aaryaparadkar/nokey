import type { HealthResponse } from "@nokey/shared";
import { Hono } from "hono";

export const health = new Hono().get("/", (c) => c.json<HealthResponse>({ ok: true }));

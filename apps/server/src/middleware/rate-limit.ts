import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import { clientIp } from "../lib/client-ip";

export type RateLimitConfig = {
  /** Burst size: requests allowed back to back. */
  capacity: number;
  /** Steady-state refill rate. */
  refillPerMinute: number;
};

type Bucket = { tokens: number; updatedAt: number };

/**
 * In-memory token bucket per key (client IP by default). Each request takes a
 * token; tokens refill continuously. This is per process, which is fine for a
 * single-instance SQLite app. Multiple instances would need a shared store.
 */
export function createRateLimiter(
  { capacity, refillPerMinute }: RateLimitConfig,
  { now = () => Date.now() }: { now?: () => number } = {},
) {
  const buckets = new Map<string, Bucket>();
  const perMs = refillPerMinute / 60_000;

  function take(key: string) {
    const t = now();
    const b = buckets.get(key) ?? { tokens: capacity, updatedAt: t };
    b.tokens = Math.min(capacity, b.tokens + (t - b.updatedAt) * perMs);
    b.updatedAt = t;
    buckets.set(key, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { ok: true as const, remaining: Math.floor(b.tokens) };
    }
    return { ok: false as const, retryAfterSec: Math.ceil((1 - b.tokens) / perMs / 1000) };
  }

  /** Drop buckets that have refilled completely; they carry no information. */
  function sweep() {
    const t = now();
    for (const [key, b] of buckets) {
      if (b.tokens + (t - b.updatedAt) * perMs >= capacity) buckets.delete(key);
    }
  }

  const middleware = createMiddleware<AppEnv>(async (c, next) => {
    const result = take(clientIp(c));
    c.header("RateLimit-Limit", String(capacity));
    if (!result.ok) {
      c.header("Retry-After", String(result.retryAfterSec));
      c.header("RateLimit-Remaining", "0");
      throw new HTTPException(429, {
        message: "Too many attempts. Please wait a moment and try again.",
      });
    }
    c.header("RateLimit-Remaining", String(result.remaining));
    await next();
  });

  return { middleware, take, sweep, size: () => buckets.size };
}

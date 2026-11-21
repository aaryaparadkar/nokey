import { describe, expect, test } from "bun:test";
import { createTestApp } from "../test/app";
import { createRateLimiter } from "./rate-limit";

describe("token bucket", () => {
  test("allows a burst, then refills over time", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 3, refillPerMinute: 60 }, { now: () => t });
    expect([1, 2, 3].map(() => rl.take("a").ok)).toEqual([true, true, true]);
    const denied = rl.take("a");
    expect(denied.ok).toBe(false);
    expect(!denied.ok && denied.retryAfterSec).toBe(1);
    t += 1000; // 60/min = one token per second
    expect(rl.take("a").ok).toBe(true);
    expect(rl.take("a").ok).toBe(false);
  });

  test("keys are independent", () => {
    const rl = createRateLimiter({ capacity: 1, refillPerMinute: 1 }, { now: () => 0 });
    expect(rl.take("a").ok).toBe(true);
    expect(rl.take("a").ok).toBe(false);
    expect(rl.take("b").ok).toBe(true);
  });

  test("never exceeds capacity after a long idle", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 2, refillPerMinute: 60 }, { now: () => t });
    rl.take("a");
    t += 60 * 60_000;
    expect([1, 2, 3].map(() => rl.take("a").ok)).toEqual([true, true, false]);
  });

  test("sweep forgets fully refilled buckets only", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 2, refillPerMinute: 60 }, { now: () => t });
    rl.take("a");
    t += 500;
    rl.take("b");
    t += 600; // a is full again (1.1s), b is not (0.6s)
    rl.sweep();
    expect(rl.size()).toBe(1);
  });
});

describe("auth rate limiting", () => {
  test("burst of auth requests gets 429 with Retry-After", async () => {
    const t = createTestApp({ authRateLimit: { capacity: 3, refillPerMinute: 3 } });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await t.req("POST", "/api/auth/login/options")).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    const res = await t.req("POST", "/api/auth/login/options");
    expect(res.headers.get("retry-after")).toBe("20");
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
  });

  test("non-auth routes are not limited", async () => {
    const t = createTestApp({ authRateLimit: { capacity: 1, refillPerMinute: 1 } });
    for (let i = 0; i < 3; i++) expect((await t.req("GET", "/api/health")).status).toBe(200);
  });

  test("X-Forwarded-For is only trusted when TRUST_PROXY is on", async () => {
    const limit = { capacity: 1, refillPerMinute: 1 };
    const opts = (ip: string) => ({ headers: { "X-Forwarded-For": `${ip}, 10.0.0.1` } });

    const untrusted = createTestApp({ authRateLimit: limit });
    expect((await untrusted.req("POST", "/api/auth/login/options", opts("1.1.1.1"))).status).toBe(
      200,
    );
    // Spoofing a new IP doesn't get a fresh bucket.
    expect((await untrusted.req("POST", "/api/auth/login/options", opts("2.2.2.2"))).status).toBe(
      429,
    );

    const trusted = createTestApp({ authRateLimit: limit, trustProxy: true });
    expect((await trusted.req("POST", "/api/auth/login/options", opts("1.1.1.1"))).status).toBe(
      200,
    );
    expect((await trusted.req("POST", "/api/auth/login/options", opts("1.1.1.1"))).status).toBe(
      429,
    );
    expect((await trusted.req("POST", "/api/auth/login/options", opts("2.2.2.2"))).status).toBe(
      200,
    );
  });
});

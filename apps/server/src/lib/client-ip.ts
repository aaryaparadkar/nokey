import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import type { AppEnv } from "../context";

/**
 * The caller's IP. Behind a reverse proxy (Fly, Railway, nginx) the socket
 * address is the proxy's, so we read X-Forwarded-For, but only when
 * TRUST_PROXY is set; otherwise anyone could spoof it to dodge rate limits.
 */
export function clientIp(c: Context<AppEnv>): string {
  if (c.get("deps").trustProxy) {
    // Left-most entry is the original client; proxies append to the right.
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // no socket, e.g. app.request() in tests
  }
}

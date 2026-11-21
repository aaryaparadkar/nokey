import { createApp } from "./app";
import { createDb, runMigrations } from "./db/client";
import { sweepExpiredSessions } from "./db/repos/sessions";
import { env } from "./env";
import { sweepExpiredChallenges } from "./webauthn/challenges";
import { createRelyingParty } from "./webauthn/config";

const rp = createRelyingParty(env); // throws early on RP_ID/ORIGIN mismatch
const db = createDb(env.DATABASE_PATH);
runMigrations(db);

setInterval(() => {
  sweepExpiredChallenges(db);
  sweepExpiredSessions(db);
}, 60_000).unref();

const app = createApp({
  db,
  rp,
  secureCookies: env.NODE_ENV === "production",
  sessionSecret: env.SESSION_SECRET,
  trustProxy: env.TRUST_PROXY,
});

console.log(`nokey server listening on http://localhost:${env.PORT} (RP ID: ${rp.id})`);

export default { port: env.PORT, fetch: app.fetch };

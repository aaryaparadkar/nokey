import { createApp } from "./app";
import { createDb, runMigrations } from "./db/client";
import { env } from "./env";
import { sweepExpiredChallenges } from "./webauthn/challenges";
import { createRelyingParty } from "./webauthn/config";

const rp = createRelyingParty(env); // throws early on RP_ID/ORIGIN mismatch
const db = createDb(env.DATABASE_PATH);
runMigrations(db);

setInterval(() => sweepExpiredChallenges(db), 60_000).unref();

const app = createApp();

console.log(`nokey server listening on http://localhost:${env.PORT} (RP ID: ${rp.id})`);

export default { port: env.PORT, fetch: app.fetch };

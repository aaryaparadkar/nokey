import { createApp } from "./app";
import { createDb, runMigrations } from "./db/client";
import { env } from "./env";

const db = createDb(env.DATABASE_PATH);
runMigrations(db);

const app = createApp();

console.log(`nokey server listening on http://localhost:${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };

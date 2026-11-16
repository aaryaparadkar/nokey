import { env } from "../env";
import { createDb, runMigrations } from "./client";

runMigrations(createDb(env.DATABASE_PATH));
console.log(`Migrated ${env.DATABASE_PATH}`);

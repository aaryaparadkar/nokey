import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

export const MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle");

/** Open a SQLite DB (":memory:" for tests) with sane pragmas. */
export function createDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true, strict: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  return drizzle({ client: sqlite, schema });
}

export type Db = ReturnType<typeof createDb>;

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

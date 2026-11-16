import { createDb, runMigrations } from "./client";

/** Fresh, fully migrated in-memory DB. Call once per test for isolation. */
export function createTestDb() {
  const db = createDb(":memory:");
  runMigrations(db);
  return db;
}

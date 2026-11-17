import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { credentials } from "../schema";

export function getCredentialById(db: Db, id: string) {
  return db.select().from(credentials).where(eq(credentials.id, id)).get();
}

export function listCredentialsForUser(db: Db, userId: string) {
  return db.select().from(credentials).where(eq(credentials.userId, userId)).all();
}

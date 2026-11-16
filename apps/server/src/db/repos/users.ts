import { eq } from "drizzle-orm";
import { randomId } from "../../lib/ids";
import type { Db } from "../client";
import { users } from "../schema";

export function createUser(db: Db, { handle }: { handle?: string | null } = {}) {
  return db
    .insert(users)
    .values({ id: randomId(), handle: handle ?? null })
    .returning()
    .get();
}

export function getUserById(db: Db, id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

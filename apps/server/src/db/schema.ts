import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

/**
 * Users have no email/password. `id` doubles as the WebAuthn user handle
 * (opaque random bytes, base64url) so it never leaks anything personal.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle"),
  createdAt: createdAt(),
});

export const credentials = sqliteTable(
  "credentials",
  {
    /** credentialID from the authenticator, base64url */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** COSE-encoded public key */
    publicKey: blob("public_key", { mode: "buffer" }).notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports", { mode: "json" }).$type<string[]>(),
    deviceType: text("device_type", { enum: ["singleDevice", "multiDevice"] }).notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull().default(false),
    aaguid: text("aaguid"),
    nickname: text("nickname"),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("credentials_user_id_idx").on(t.userId)],
);

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  kind: text("kind", { enum: ["registration", "authentication"] }).notNull(),
  userId: text("user_id"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const pastes = sqliteTable(
  "pastes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    content: text("content").notNull(),
    language: text("language").notNull().default("plaintext"),
    visibility: text("visibility", { enum: ["public", "unlisted", "private"] })
      .notNull()
      .default("unlisted"),
    burnAfterRead: integer("burn_after_read", { mode: "boolean" }).notNull().default(false),
    encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
    views: integer("views").notNull().default(0),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("pastes_user_id_idx").on(t.userId), index("pastes_expires_at_idx").on(t.expiresAt)],
);

export type User = typeof users.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Paste = typeof pastes.$inferSelect;
export type NewPaste = typeof pastes.$inferInsert;

import { z } from "zod";

const DEV_SECRET = "dev-only-insecure-session-secret-change-me";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    RP_ID: z.string().min(1).default("localhost"),
    RP_NAME: z.string().min(1).default("nokey"),
    ORIGIN: z.url().default("http://localhost:5173"),
    SESSION_SECRET: z.string().min(32).default(DEV_SECRET),
    DATABASE_PATH: z.string().min(1).default("./data/nokey.db"),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.SESSION_SECRET !== DEV_SECRET, {
    path: ["SESSION_SECRET"],
    message: "SESSION_SECRET must be set in production",
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error(`Invalid environment:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();

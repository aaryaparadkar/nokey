import type { Db } from "./db/client";
import type { Session, User } from "./db/schema";
import type { RelyingParty } from "./webauthn/config";

export type AppDeps = {
  db: Db;
  rp: RelyingParty;
  /** Set Secure (and the __Host- prefix) on cookies. True in production (HTTPS). */
  secureCookies: boolean;
  /** HMAC key for signed cookies. */
  sessionSecret: string;
};

export type AppEnv = {
  Variables: {
    deps: AppDeps;
    user: User | null;
    session: Session | null;
  };
};

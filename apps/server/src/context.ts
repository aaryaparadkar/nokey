import type { Db } from "./db/client";
import type { RelyingParty } from "./webauthn/config";

export type AppDeps = {
  db: Db;
  rp: RelyingParty;
  /** Set Secure on cookies. True in production (HTTPS). */
  secureCookies: boolean;
};

export type AppEnv = { Variables: { deps: AppDeps } };

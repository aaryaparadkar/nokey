import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { getCredentialById } from "../db/repos/credentials";
import { getUserById } from "../db/repos/users";
import { credentials, type User } from "../db/schema";
import { createChallenge } from "./challenges";
import type { RelyingParty } from "./config";

/**
 * Step 1: options for a usernameless sign-in. allowCredentials is empty, so the
 * browser offers every discoverable passkey it has for this RP ID.
 */
export async function beginAuthentication(db: Db, rp: RelyingParty) {
  const challenge = createChallenge(db, "authentication");
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    allowCredentials: [],
    userVerification: "preferred",
    challenge: Buffer.from(challenge.challenge, "base64url"),
    timeout: 120_000,
  });
  return { options, challengeId: challenge.id };
}

export type AuthenticationResult =
  | { ok: true; user: User }
  | { ok: false; reason: "unknown_credential" | "verification_failed"; message: string };

const fail = (
  reason: "unknown_credential" | "verification_failed",
  message: string,
): AuthenticationResult => ({ ok: false, reason, message });

/**
 * Step 2: find the credential the browser picked, verify its signature over
 * authenticatorData || SHA-256(clientDataJSON), and update the counter.
 */
export async function finishAuthentication(
  db: Db,
  rp: RelyingParty,
  {
    expectedChallenge,
    response,
  }: { expectedChallenge: string; response: AuthenticationResponseJSON },
): Promise<AuthenticationResult> {
  const stored = getCredentialById(db, response.id);
  if (!stored) return fail("unknown_credential", "This passkey isn't registered with nokey");

  // A discoverable credential returns the user handle it was created with. It must match.
  const userHandle = response.response.userHandle;
  if (userHandle !== undefined && userHandle !== stored.userId) {
    return fail("verification_failed", "Passkey does not belong to this account");
  }

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports ?? undefined,
      },
      // Rejects counter regression when either value is non-zero (cloned-key signal).
      requireUserVerification: false,
    });
  } catch (e) {
    return fail("verification_failed", e instanceof Error ? e.message : "Verification failed");
  }
  if (!verification.verified) return fail("verification_failed", "Verification failed");

  const { newCounter, credentialBackedUp, credentialDeviceType } = verification.authenticationInfo;
  db.update(credentials)
    .set({
      counter: newCounter,
      lastUsedAt: new Date(),
      // Backup state can change over time (e.g. user turns on iCloud Keychain).
      backedUp: credentialBackedUp,
      deviceType: credentialDeviceType,
    })
    .where(eq(credentials.id, stored.id))
    .run();

  const user = getUserById(db, stored.userId);
  if (!user) return fail("unknown_credential", "Account no longer exists");
  return { ok: true, user };
}

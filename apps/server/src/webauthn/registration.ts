import {
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { Db } from "../db/client";
import { credentials, users } from "../db/schema";
import { createChallenge } from "./challenges";
import type { RelyingParty } from "./config";

export const DEFAULT_USER_NAME = "nokey user";

/**
 * Step 1: build PublicKeyCredentialCreationOptions for a brand-new account.
 * The user handle is 16 random bytes; it becomes users.id (base64url) only if verify succeeds.
 */
export async function beginRegistration(db: Db, rp: RelyingParty, handle?: string) {
  const userHandle = crypto.getRandomValues(new Uint8Array(16));
  const userId = Buffer.from(userHandle).toString("base64url");
  const challenge = createChallenge(db, "registration", { userId });

  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userID: userHandle,
    userName: handle ?? DEFAULT_USER_NAME,
    userDisplayName: handle ?? DEFAULT_USER_NAME,
    // Pass raw bytes so options.challenge === our stored base64url string.
    challenge: Buffer.from(challenge.challenge, "base64url"),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required", // discoverable → usernameless sign-in
      userVerification: "preferred",
    },
    timeout: 120_000,
  });

  return { options, challengeId: challenge.id };
}

export type RegistrationResult =
  | { ok: true; user: { id: string; handle: string | null } }
  | { ok: false; reason: "verification_failed" | "already_registered"; message: string };

/**
 * Step 2: verify the authenticator's attestation against the consumed challenge,
 * then create the user and their first credential atomically.
 */
export async function finishRegistration(
  db: Db,
  rp: RelyingParty,
  {
    expectedChallenge,
    userId,
    response,
    handle,
  }: {
    expectedChallenge: string;
    userId: string;
    response: RegistrationResponseJSON;
    handle?: string;
  },
): Promise<RegistrationResult> {
  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      requireUserVerification: false,
    });
  } catch (e) {
    return {
      ok: false,
      reason: "verification_failed",
      message: e instanceof Error ? e.message : "Verification failed",
    };
  }
  if (!verification.verified) {
    return { ok: false, reason: "verification_failed", message: "Verification failed" };
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo;

  try {
    const user = db.transaction((tx) => {
      const u = tx
        .insert(users)
        .values({ id: userId, handle: handle ?? null })
        .returning()
        .get();
      tx.insert(credentials)
        .values({
          id: credential.id,
          userId: u.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports ?? null,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          aaguid,
        })
        .run();
      return u;
    });
    return { ok: true, user: { id: user.id, handle: user.handle } };
  } catch (e) {
    if (e instanceof Error && /UNIQUE|PRIMARY KEY/i.test(e.message)) {
      return { ok: false, reason: "already_registered", message: "Passkey already registered" };
    }
    throw e;
  }
}

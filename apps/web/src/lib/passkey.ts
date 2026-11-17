import type { LoginVerifyRequest, PublicUser, RegisterVerifyRequest } from "@nokey/shared";
import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from "@simplewebauthn/browser";
import { ApiError, api } from "./api";

export const supportsPasskeys = () => browserSupportsWebAuthn();
export const hasPlatformAuthenticator = () => platformAuthenticatorIsAvailable();

/** Thrown for errors we want to show to the user as-is. */
export class PasskeyError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "cancelled"
      | "unsupported"
      | "already_registered"
      | "not_recognized"
      | "server"
      | "unknown",
  ) {
    super(message);
    this.name = "PasskeyError";
  }
}

/** Translate the many ways a WebAuthn ceremony can fail into something a human can read. */
export function toPasskeyError(e: unknown): PasskeyError {
  if (e instanceof PasskeyError) return e;
  if (e instanceof ApiError) {
    if (e.code === "conflict") return new PasskeyError(e.message, "already_registered");
    if (e.status === 401) return new PasskeyError(e.message, "not_recognized");
    return new PasskeyError(e.message, "server");
  }
  if (e instanceof WebAuthnError) {
    switch (e.code) {
      case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
        return new PasskeyError("This device already has a nokey passkey.", "already_registered");
      case "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT":
        return new PasskeyError(
          "This authenticator can't store passkeys. Try your phone or a password manager.",
          "unsupported",
        );
      case "ERROR_INVALID_DOMAIN":
      case "ERROR_INVALID_RP_ID":
        return new PasskeyError("This site's passkey configuration is invalid.", "server");
      case "ERROR_CEREMONY_ABORTED":
        return new PasskeyError("Passkey request was cancelled.", "cancelled");
    }
  }
  if (e instanceof Error) {
    // NotAllowedError covers both "user cancelled" and "timed out"; browsers don't tell them apart.
    if (e.name === "NotAllowedError" || e.name === "AbortError") {
      return new PasskeyError("Passkey request was cancelled or timed out.", "cancelled");
    }
    if (e.name === "InvalidStateError") {
      return new PasskeyError("This device already has a nokey passkey.", "already_registered");
    }
    if (e.name === "NotSupportedError") {
      return new PasskeyError("Your browser or device doesn't support passkeys.", "unsupported");
    }
  }
  return new PasskeyError("Something went wrong with your passkey.", "unknown");
}

/** Full registration ceremony: options → authenticator → verify. */
export async function registerPasskey(handle?: string): Promise<PublicUser> {
  if (!supportsPasskeys()) {
    throw new PasskeyError("Your browser doesn't support passkeys.", "unsupported");
  }
  try {
    const options = await api.registerOptions(handle ? { handle } : {});
    const response = await startRegistration({
      optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
    });
    const { user } = await api.registerVerify({
      handle,
      response: response as unknown as RegisterVerifyRequest["response"],
    });
    return user;
  } catch (e) {
    throw toPasskeyError(e);
  }
}

/** Full usernameless sign-in ceremony: options → pick passkey → verify. */
export async function signInWithPasskey(): Promise<PublicUser> {
  if (!supportsPasskeys()) {
    throw new PasskeyError("Your browser doesn't support passkeys.", "unsupported");
  }
  try {
    const options = await api.loginOptions();
    const response = await startAuthentication({
      optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
    const { user } = await api.loginVerify({
      response: response as unknown as LoginVerifyRequest["response"],
    });
    return user;
  } catch (e) {
    throw toPasskeyError(e);
  }
}

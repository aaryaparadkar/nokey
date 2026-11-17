import { isoCBOR } from "@simplewebauthn/server/helpers";

/**
 * A minimal software authenticator for tests. It produces real "none"
 * attestations with a P-256 (ES256) key so the server runs the actual
 * WebAuthn verification code, not a mock.
 */

const b64url = (b: Uint8Array | ArrayBuffer) =>
  Buffer.from(new Uint8Array(b)).toString("base64url");
const sha256 = async (data: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", data));

/** authenticatorData flag bits (WebAuthn §6.1) */
export const FLAGS = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40 } as const;

export type SoftAuthenticatorOpts = {
  origin?: string;
  rpId?: string;
  flags?: number;
  /** Override the challenge the authenticator signs over (to simulate tampering). */
  challenge?: string;
};

export class SoftAuthenticator {
  readonly credentialId = crypto.getRandomValues(new Uint8Array(16));
  readonly aaguid = new Uint8Array(16);
  private keyPair?: CryptoKeyPair;

  get id() {
    return b64url(this.credentialId);
  }

  private async keys() {
    this.keyPair ??= await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    return this.keyPair;
  }

  private async coseKey() {
    const jwk = await crypto.subtle.exportKey("jwk", (await this.keys()).publicKey);
    const x = Buffer.from(jwk.x as string, "base64url");
    const y = Buffer.from(jwk.y as string, "base64url");
    // COSE_Key: kty=EC2(2), alg=ES256(-7), crv=P-256(1), x, y
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(x)],
        [-3, new Uint8Array(y)],
      ]),
    );
  }

  /** Simulates navigator.credentials.create() given server options JSON. */
  async create(
    options: { challenge: string; rp: { id?: string } },
    { origin = "http://localhost:5173", rpId, flags, challenge }: SoftAuthenticatorOpts = {},
  ) {
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({
        type: "webauthn.create",
        challenge: challenge ?? options.challenge,
        origin,
        crossOrigin: false,
      }),
    );

    const rpIdHash = await sha256(new TextEncoder().encode(rpId ?? options.rp.id ?? "localhost"));
    const cose = await this.coseKey();
    const credIdLen = new Uint8Array([
      this.credentialId.length >> 8,
      this.credentialId.length & 0xff,
    ]);
    const authData = new Uint8Array([
      ...rpIdHash,
      flags ?? FLAGS.UP | FLAGS.UV | FLAGS.AT,
      0,
      0,
      0,
      0, // signCount
      ...this.aaguid,
      ...credIdLen,
      ...this.credentialId,
      ...cose,
    ]);

    const attestationObject = isoCBOR.encode(
      new Map<string, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]) as never,
    );

    return {
      id: this.id,
      rawId: this.id,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientDataJSON),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
    };
  }
}

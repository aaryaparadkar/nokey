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

/** WebCrypto gives ECDSA signatures as raw r||s; WebAuthn ES256 expects ASN.1 DER. */
function rawToDer(raw: Uint8Array) {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    const v = b.slice(i);
    // Prefix 0x00 if the high bit is set, so it isn't read as negative.
    return (v[0] as number) & 0x80 ? new Uint8Array([0, ...v]) : v;
  };
  const r = int(raw.slice(0, 32));
  const s = int(raw.slice(32));
  return new Uint8Array([
    0x30,
    r.length + s.length + 4,
    0x02,
    r.length,
    ...r,
    0x02,
    s.length,
    ...s,
  ]);
}

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
  /** Signature counter. Leave at 0 to behave like a synced passkey. */
  counter = 0;
  /** User handle captured at create(), returned on get() like a discoverable credential. */
  userHandle?: string;
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
    options: { challenge: string; rp: { id?: string }; user?: { id: string } },
    { origin = "http://localhost:5173", rpId, flags, challenge }: SoftAuthenticatorOpts = {},
  ) {
    this.userHandle = options.user?.id;
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

  /** Simulates navigator.credentials.get() given server options JSON. */
  async get(
    options: { challenge: string; rpId?: string },
    {
      origin = "http://localhost:5173",
      rpId,
      flags,
      challenge,
      userHandle,
      counter,
    }: SoftAuthenticatorOpts & { userHandle?: string | null; counter?: number } = {},
  ) {
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({
        type: "webauthn.get",
        challenge: challenge ?? options.challenge,
        origin,
        crossOrigin: false,
      }),
    );
    if (counter !== undefined) this.counter = counter;
    else if (this.counter > 0) this.counter++;
    const c = this.counter;

    const rpIdHash = await sha256(new TextEncoder().encode(rpId ?? options.rpId ?? "localhost"));
    const authData = new Uint8Array([
      ...rpIdHash,
      flags ?? FLAGS.UP | FLAGS.UV,
      (c >>> 24) & 0xff,
      (c >>> 16) & 0xff,
      (c >>> 8) & 0xff,
      c & 0xff,
    ]);
    const clientDataHash = await sha256(clientDataJSON);
    const signed = new Uint8Array([...authData, ...clientDataHash]);
    const raw = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        (await this.keys()).privateKey,
        signed,
      ),
    );

    const handle = userHandle === null ? undefined : (userHandle ?? this.userHandle);
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(rawToDer(raw)),
        ...(handle && { userHandle: handle }),
      },
    };
  }
}

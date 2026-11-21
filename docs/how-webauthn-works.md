# How WebAuthn works (in nokey)

nokey has no passwords and no emails. Your account _is_ a passkey: a key pair
whose private half never leaves your device (or your synced password manager).
This doc explains the moving parts, in the order you meet them in the code.

## The cast

| Role                   | Who                                                                   | In nokey                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Relying Party (RP)** | The website that wants to authenticate you                            | `apps/server`                                                            |
| **Client**             | The browser; enforces origin rules and talks to the authenticator     | `navigator.credentials`                                                  |
| **Authenticator**      | Holds private keys and checks you're present (fingerprint, face, PIN) | Touch ID, Windows Hello, Android, iCloud Keychain, 1Password, a YubiKey… |

The server never talks to the authenticator directly. The browser sits in the
middle and stamps every message with the **origin** it came from. That stamp is
the reason passkeys can't be phished.

## RP ID and origin

- **RP ID** is a domain, like `nokey.dev`. Each credential is bound to exactly
  one RP ID. The browser refuses to use a `nokey.dev` passkey on any other site.
- A page may use its own host or a parent domain as its RP ID
  (`app.nokey.dev` → `nokey.dev` is allowed; the reverse is not).
- **Origin** is scheme + host + port, like `https://nokey.dev`. The browser writes
  it into `clientDataJSON`, and the server checks it matches what it expects.
- WebAuthn only works in a **secure context**: HTTPS, or `http://localhost` for dev.

nokey checks all of this when it boots (`webauthn/config.ts`), so a typo in
`RP_ID`/`ORIGIN` crashes immediately instead of showing up as a mysterious
`SecurityError` in the browser.

## Challenges

Every ceremony starts with the server generating a random **challenge**
(32 bytes). The authenticator signs over it, which proves the response is fresh
and not replayed.

nokey's rules (`webauthn/challenges.ts`):

- Stored server-side with a **5-minute TTL**.
- The challenge's _id_ goes in an HttpOnly cookie. We never trust the
  challenge value the client sends back.
- **Single use.** Verify does an atomic `DELETE … RETURNING`. Two racing
  requests can't both succeed.
- Tagged with a `kind` (registration / authentication), so one kind can't be
  used for the other.

## Ceremony 1: registration (attestation)

```
browser                         server
  │  POST /register/options  ─────▶  create challenge, user handle
  │  ◀───── PublicKeyCredentialCreationOptions
  │  navigator.credentials.create()   (fingerprint prompt)
  │  POST /register/verify   ─────▶  verify, store credential
```

The authenticator creates a new key pair and returns:

- **`clientDataJSON`**: `{ type: "webauthn.create", challenge, origin }`, written by the browser.
- **`attestationObject`**: CBOR containing `authenticatorData` (see below) and,
  optionally, an attestation statement proving what model of authenticator made the key.

The server checks type, challenge, origin, and RP ID hash, then stores the
**credential ID** and the **COSE public key**.

nokey uses `attestation: "none"`. We don't care what brand your authenticator
is, and asking for attestation adds privacy cost and friction.

## Ceremony 2: authentication (assertion)

```
browser                         server
  │  POST /login/options     ─────▶  create challenge
  │  ◀───── PublicKeyCredentialRequestOptions (allowCredentials: [])
  │  navigator.credentials.get()      (pick passkey, fingerprint)
  │  POST /login/verify      ─────▶  look up credential, verify signature
```

The authenticator signs `authenticatorData || SHA-256(clientDataJSON)` with the
private key. The server verifies that signature with the stored public key.
Because `clientDataJSON` contains the origin and challenge, a valid signature
proves _this_ device approved _this_ request on _this_ site.

## Discoverable credentials ("usernameless")

A **discoverable credential** (also called a resident key) is stored on the
authenticator together with the RP ID and the **user handle**. That lets the
browser show "Sign in as …" without the site first asking who you are. nokey
sends `allowCredentials: []` and requires `residentKey: "required"`, so there is
no username field at all.

The **user handle** is `users.id`: 16 random bytes. It's returned on every
sign-in and must never contain personal info.

## authenticatorData flags

`authenticatorData` starts with `SHA-256(rpId)` (32 bytes), then one byte of flags:

| Bit | Flag                   | Meaning                                                        |
| --- | ---------------------- | -------------------------------------------------------------- |
| 0   | **UP** User Present    | Someone touched/approved it                                    |
| 2   | **UV** User Verified   | Biometric or PIN check passed                                  |
| 3   | **BE** Backup Eligible | Key _can_ sync (e.g. iCloud Keychain, Google Password Manager) |
| 4   | **BS** Backup State    | Key _is currently_ synced                                      |
| 6   | **AT** Attested data   | Registration only: contains credential ID + public key         |
| 7   | **ED** Extension data  | Extensions follow                                              |

Then a 4-byte **signature counter**.

nokey stores `BE`/`BS` as `device_type` / `backed_up`. That's what powers the
"synced" vs "this device only" badge on the account page.

## The signature counter

Some authenticators bump a counter on every use. If the server ever sees it go
_backwards_, the key may have been cloned. Synced passkeys usually report
`0` forever, so nokey only enforces it when the counter is non-zero.

## User verification

`userVerification: "preferred"` asks for a biometric or PIN when the authenticator
supports one. Since the passkey is the _only_ factor, nokey records whether UV happened.

## Conditional UI (autofill)

With `mediation: "conditional"`, passkeys show up in the browser's autofill
dropdown on an `<input autocomplete="username webauthn">`. That's the sign-in
flow most people already know from passwords, minus the password.

## Signing in from another device (cross-device / hybrid)

Passkeys don't have to live on the computer you're using. If the laptop has no
nokey passkey, the browser's passkey dialog offers **"Use a phone or tablet"**
and shows a QR code:

1. Scan it with the phone's camera. The phone finds the passkey and asks for
   your fingerprint or face.
2. The phone and the laptop check they're physically close over **Bluetooth**.
   This is what stops a remote attacker from relaying the QR code.
3. The phone signs the challenge. The result travels back to the laptop's browser
   through an encrypted relay (caBLE / hybrid transport), and the browser posts it
   to nokey like any other sign-in.

Nothing changes on the server: the origin in `clientDataJSON` is still the
laptop's page, so phishing protection holds. Requirements: Bluetooth on both
devices, and a phone with a passkey manager (iOS 16+, Android 9+ with Google
Password Manager, or a third-party manager).

Registering this way works too. The passkey is then saved on the phone, which
the account page shows as `hybrid` in the passkey's transports.

## Abuse protection

The sign-in endpoints are rate-limited per IP with a token bucket: 20 requests
back to back, then one every 3 seconds (`middleware/rate-limit.ts`). Behind a
reverse proxy set `TRUST_PROXY=true` so the real client IP is read from
`X-Forwarded-For`; without it the header is ignored, so it can't be spoofed.

## Where to look in the code

| Concept                   | File                                           |
| ------------------------- | ---------------------------------------------- |
| RP ID / origin validation | `apps/server/src/webauthn/config.ts`           |
| Challenge lifecycle       | `apps/server/src/webauthn/challenges.ts`       |
| Credential storage        | `apps/server/src/db/schema.ts` (`credentials`) |

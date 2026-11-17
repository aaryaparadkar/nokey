import { z } from "zod";

export const Handle = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[\p{L}\p{N} ._-]+$/u, "Letters, numbers, spaces, . _ - only");

export const PublicUser = z.object({ id: z.string(), handle: z.string().nullable() });
export type PublicUser = z.infer<typeof PublicUser>;

export const RegisterOptionsRequest = z.object({ handle: Handle.optional() });
export type RegisterOptionsRequest = z.infer<typeof RegisterOptionsRequest>;

/**
 * WebAuthn option/response JSON is produced/consumed by SimpleWebAuthn, which owns the
 * exact types. We validate only the envelope here; the library validates the rest.
 */
export const CreationOptionsJSON = z.looseObject({
  challenge: z.string(),
  rp: z.looseObject({ name: z.string() }),
  user: z.looseObject({ id: z.string(), name: z.string() }),
});

export const RegistrationResponseJSON = z.looseObject({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.looseObject({ clientDataJSON: z.string(), attestationObject: z.string() }),
});

export const RegisterVerifyRequest = z.object({
  handle: Handle.optional(),
  response: RegistrationResponseJSON,
});
export type RegisterVerifyRequest = z.infer<typeof RegisterVerifyRequest>;

export const RegisterVerifyResponse = z.object({ user: PublicUser });
export type RegisterVerifyResponse = z.infer<typeof RegisterVerifyResponse>;

export const MeResponse = z.object({ user: PublicUser });
export type MeResponse = z.infer<typeof MeResponse>;

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

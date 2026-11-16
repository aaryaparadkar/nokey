/** Random base64url id. 16 bytes = 128 bits of entropy. */
export function randomId(bytes = 16): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

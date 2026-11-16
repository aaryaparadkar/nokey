import { describe, expect, test } from "bun:test";
import { createRelyingParty, isValidRpIdForOrigin } from "./config";

describe("isValidRpIdForOrigin", () => {
  test.each([
    ["localhost", "http://localhost:5173", true],
    ["nokey.dev", "https://nokey.dev", true],
    ["nokey.dev", "https://app.nokey.dev", true],
    ["nokey.dev", "http://nokey.dev", false], // not secure
    ["nokey.dev", "https://evilnokey.dev", false], // suffix but not a subdomain
    ["app.nokey.dev", "https://nokey.dev", false], // RP ID broader than host only
    ["nokey.dev", "https://nokey.dev/path", false], // not a bare origin
    ["localhost", "not a url", false],
  ])("rpId=%s origin=%s → %p", (rpId, origin, ok) => {
    expect(isValidRpIdForOrigin(rpId, origin)).toBe(ok);
  });
});

describe("createRelyingParty", () => {
  test("supports multiple comma-separated origins and strips trailing slash", () => {
    const rp = createRelyingParty({
      RP_ID: "nokey.dev",
      RP_NAME: "nokey",
      ORIGIN: "https://nokey.dev/, https://www.nokey.dev",
    });
    expect(rp.origins).toEqual(["https://nokey.dev", "https://www.nokey.dev"]);
  });

  test("throws on mismatched config", () => {
    expect(() =>
      createRelyingParty({ RP_ID: "nokey.dev", RP_NAME: "nokey", ORIGIN: "https://example.com" }),
    ).toThrow(/Invalid WebAuthn config/);
  });
});

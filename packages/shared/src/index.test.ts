import { expect, test } from "bun:test";
import { ApiErrorBody, HealthResponse } from "./index";

test("HealthResponse parses", () => {
  expect(HealthResponse.parse({ ok: true })).toEqual({ ok: true });
  expect(HealthResponse.safeParse({}).success).toBe(false);
});

test("ApiErrorBody rejects unknown codes", () => {
  expect(ApiErrorBody.safeParse({ error: { code: "not_found", message: "x" } }).success).toBe(true);
  expect(ApiErrorBody.safeParse({ error: { code: "nope", message: "x" } }).success).toBe(false);
});

import type { Context, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ApiError = { error: { code: string; message: string } };

const codeFor = (status: number) =>
  ({
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    429: "rate_limited",
  })[status] ?? (status >= 500 ? "internal_error" : "error");

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return c.json<ApiError>({ error: { code: codeFor(status), message: err.message } }, status);
  }
  console.error(err);
  return c.json<ApiError>(
    { error: { code: "internal_error", message: "Something went wrong" } },
    500,
  );
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json<ApiError>({ error: { code: "not_found", message: "Route not found" } }, 404);

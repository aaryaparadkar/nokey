import {
  ApiErrorBody,
  CreationOptionsJSON,
  type ErrorCode,
  HealthResponse,
  type LoginVerifyRequest,
  LoginVerifyResponse,
  MeResponse,
  OkResponse,
  type RegisterOptionsRequest,
  type RegisterVerifyRequest,
  RegisterVerifyResponse,
  RequestOptionsJSON,
} from "@nokey/shared";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "network_error" | "invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

/** Typed fetch: sends JSON, includes cookies, parses errors, validates the response with zod. */
export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  { body, headers, ...init }: RequestOptions = {},
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Could not reach the server");
  }

  const data: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const err = ApiErrorBody.safeParse(data);
    if (err.success) throw new ApiError(res.status, err.data.error.code, err.data.error.message);
    throw new ApiError(res.status, "error", `Request failed (${res.status})`);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiError(res.status, "invalid_response", "Unexpected server response");
  return parsed.data;
}

export const api = {
  health: (signal?: AbortSignal) => request("/api/health", HealthResponse, { signal }),
  registerOptions: (body: RegisterOptionsRequest) =>
    request("/api/auth/register/options", CreationOptionsJSON, { method: "POST", body }),
  registerVerify: (body: RegisterVerifyRequest) =>
    request("/api/auth/register/verify", RegisterVerifyResponse, { method: "POST", body }),
  loginOptions: () => request("/api/auth/login/options", RequestOptionsJSON, { method: "POST" }),
  loginVerify: (body: LoginVerifyRequest) =>
    request("/api/auth/login/verify", LoginVerifyResponse, { method: "POST", body }),
  /** Current user, or null when signed out. */
  me: async (signal?: AbortSignal) => {
    try {
      return (await request("/api/me", MeResponse, { signal })).user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  logout: () => request("/api/auth/logout", OkResponse, { method: "POST" }),
};

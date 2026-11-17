import { zValidator } from "@hono/zod-validator";
import type { ApiErrorBody } from "@nokey/shared";
import type { ValidationTargets } from "hono";
import { z } from "zod";

/** zValidator that responds with our standard error shape. */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json<ApiErrorBody>(
        { error: { code: "bad_request", message: z.prettifyError(result.error) } },
        400,
      );
    }
  });

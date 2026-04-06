import { NextResponse } from "next/server";

import { AppError, isAppError } from "@/server/lib/errors";
import { recordOperationalError } from "@/server/lib/ops-error";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export async function handleRouteError(error: unknown, context?: { organizationId?: string | null; scope?: string }) {
  if (isAppError(error)) {
    await recordOperationalError({
      organizationId: context?.organizationId ?? null,
      scope: context?.scope ?? "route_error",
      message: error.message,
      details: {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details ?? null
      }
    });

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null
        }
      },
      { status: error.statusCode }
    );
  }

  console.error(error);

  await recordOperationalError({
    organizationId: context?.organizationId ?? null,
    scope: context?.scope ?? "route_error",
    message: error instanceof Error ? error.message : "Unknown route error",
    details: error instanceof Error ? { stack: error.stack } : { raw: String(error) }
  });

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Произошла непредвиденная ошибка."
      }
    },
    { status: 500 }
  );
}

export async function withRouteHandler<T>(handler: () => Promise<T>) {
  try {
    return ok(await handler());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function withMutationHandler<T>(handler: () => Promise<T>, status = 200) {
  try {
    return NextResponse.json({ data: await handler() }, { status });
  } catch (error) {
    return handleRouteError(error);
  }
}

export function assertJobSecret(secret: string | null) {
  if (!secret) {
    throw new AppError(401, "missing_job_secret", "Missing job secret.");
  }
}

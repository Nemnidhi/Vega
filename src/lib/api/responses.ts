import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: { message, details },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.issues);
  }

  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) {
      return fail(error.message, 401);
    }
    if (error.message.includes("Forbidden")) {
      return fail(error.message, 403);
    }
    if (error.message.includes("not found")) {
      return fail(error.message, 404);
    }
    return fail(error.message, 400);
  }

  return fail("Unexpected server error", 500);
}

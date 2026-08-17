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

/**
 * For business logic shared between a route and an extracted lib function
 * (e.g. src/lib/auth/client-portal-credentials.ts) where the caller needs an
 * exact status code (409 conflict, 422 validation, etc.) that handleApiError's
 * generic message-substring matching wouldn't infer correctly on its own.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.issues);
  }

  if (error instanceof Error) {
    const message = error.message;
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("unauthorized")) {
      return fail(message, 401);
    }
    if (normalizedMessage.includes("forbidden")) {
      return fail(message, 403);
    }
    if (normalizedMessage.includes("not found")) {
      return fail(message, 404);
    }
    return fail(message, 400);
  }

  return fail("Unexpected server error", 500);
}

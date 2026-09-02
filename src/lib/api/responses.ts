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

/**
 * Errors thrown by the database layer rather than by our own business rules.
 *
 * These carry internals we must not hand to a caller - a CastError names the schema path and
 * expected type, a ValidationError enumerates the schema's fields, and a driver connection
 * error can carry replica-set hostnames. They are answered with a fixed, generic message and
 * the real error goes to the server log.
 */
function describeInfrastructureError(error: Error): { message: string; status: number } | null {
  const name = error.name;

  if (name === "CastError" || name === "ValidationError" || name === "ValidatorError") {
    return { message: "Some of the submitted values are not valid.", status: 422 };
  }

  // Duplicate key on a unique index - the collision itself is meaningful to the caller, the
  // index name and key shape are not.
  if (name === "MongoServerError" && (error as { code?: number }).code === 11000) {
    return { message: "That record already exists.", status: 409 };
  }

  if (
    name === "MongoServerError" ||
    name === "MongoNetworkError" ||
    name === "MongooseServerSelectionError" ||
    name === "MongoServerSelectionError" ||
    name === "MongoNotConnectedError" ||
    name === "MongooseError"
  ) {
    return { message: "The service is temporarily unavailable. Please try again.", status: 503 };
  }

  return null;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.issues);
  }

  if (error instanceof Error) {
    // Database and driver errors are sanitised; everything below this point is a message we
    // wrote ourselves and intend the user to read.
    const infrastructure = describeInfrastructureError(error);
    if (infrastructure) {
      console.error("handleApiError (infrastructure):", error);
      return fail(infrastructure.message, infrastructure.status);
    }

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

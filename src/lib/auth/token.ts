import { createHmac, timingSafeEqual } from "crypto";
import { getServerEnv } from "@/lib/env/server";
import type { UserRole } from "@/types/user";

export interface SessionTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  fullName?: string;
  iat: number;
  exp: number;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadBase64: string) {
  const { AUTH_SECRET } = getServerEnv();
  return createHmac("sha256", AUTH_SECRET).update(payloadBase64).digest("base64url");
}

export function createSessionToken(payload: SessionTokenPayload) {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payloadBase64);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const rawPayload = fromBase64Url(payloadBase64);
    const payload = JSON.parse(rawPayload) as SessionTokenPayload;

    if (!payload.sub || !payload.email || !payload.role || !payload.exp || !payload.iat) {
      return null;
    }

    if (Date.now() / 1000 >= payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

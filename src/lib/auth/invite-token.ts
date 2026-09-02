import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getServerEnv } from "@/lib/env/server";

/**
 * Same signed-payload shape as session tokens (src/lib/auth/token.ts), kept
 * as a sibling rather than reused directly - an invite token authenticates
 * a one-time action (activate this specific invite), not an ongoing
 * session, and the payload/expiry semantics are different enough that
 * sharing the function would mean threading session-only fields through.
 */
export interface InviteTokenPayload {
  inviteId: string;
  leadId: string;
  email: string;
  purpose: "client-invite";
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

export function createInviteToken(payload: Omit<InviteTokenPayload, "iat" | "exp">, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: InviteTokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const payloadBase64 = toBase64Url(JSON.stringify(fullPayload));
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

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
    const payload = JSON.parse(rawPayload) as InviteTokenPayload;

    if (
      !payload.inviteId ||
      !payload.leadId ||
      !payload.email ||
      payload.purpose !== "client-invite" ||
      !payload.exp ||
      !payload.iat
    ) {
      return null;
    }

    if (Date.now() / 1000 >= payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/** What gets stored on ClientInvite.tokenHash - never the raw token itself. */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

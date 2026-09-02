import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison for shared integration secrets.
 *
 * `!==` short-circuits at the first differing byte, so response timing leaks how long a
 * prefix matched - recoverable byte by byte across enough requests. The session and invite
 * token verifiers already compare this way; the server-to-server secret headers did not.
 *
 * Length is compared first and non-constant-time, which is unavoidable (timingSafeEqual
 * throws on unequal lengths) and harmless: the length of a shared secret is not the secret.
 */
export function secretsMatch(provided: string | null | undefined, expected: string) {
  if (!provided) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

function toBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

function fromBase64(value: string) {
  return Buffer.from(value, "base64");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${toBase64(salt)}:${toBase64(derivedKey)}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [saltPart, hashPart] = storedHash.split(":");
  if (!saltPart || !hashPart) {
    return false;
  }

  const salt = fromBase64(saltPart);
  const storedKey = fromBase64(hashPart);
  const derivedKey = scryptSync(password, salt, storedKey.length);

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

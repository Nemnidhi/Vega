import { getServerEnv } from "@/lib/env/server";

function parseOrigin(input: string | null): string | null {
  if (!input) {
    return null;
  }

  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function parseDomainFromOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function getAllowedLeadCaptureOrigins() {
  const { LEAD_CAPTURE_ALLOWED_ORIGINS } = getServerEnv();
  return LEAD_CAPTURE_ALLOWED_ORIGINS.split(",")
    .map((item) => parseOrigin(item.trim()))
    .filter((item): item is string => Boolean(item));
}

export function getRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return parseOrigin(originHeader);
  }

  const refererHeader = request.headers.get("referer");
  if (!refererHeader) {
    return null;
  }

  try {
    const refererUrl = new URL(refererHeader);
    return parseOrigin(refererUrl.origin);
  } catch {
    return null;
  }
}

export function isAllowedLeadCaptureOrigin(origin: string | null) {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedLeadCaptureOrigins();
  return allowedOrigins.includes(origin);
}

export function extractLeadSourceTracking(request: Request) {
  const origin = getRequestOrigin(request);
  const referer = request.headers.get("referer");

  let sourcePath: string | undefined;
  if (referer) {
    try {
      sourcePath = new URL(referer).pathname || "/";
    } catch {
      sourcePath = undefined;
    }
  }

  return {
    sourceDomain: parseDomainFromOrigin(origin) ?? undefined,
    sourcePath,
    sourceReferrer: referer ?? undefined,
    requestOrigin: origin,
  };
}

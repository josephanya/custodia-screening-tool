import { createHmac } from "node:crypto";

const USER_AGENT_MAX_LENGTH = 256;

export type RequestContext = {
  ipHash: string;
  userAgent: string | null;
};

export function readClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();

    if (firstHop) {
      return firstHop;
    }
  }

  return headers.get("x-real-ip")?.trim() || null;
}

export function hashIdentifier(value: string): string {
  return createHmac("sha256", hashSecret()).update(value).digest("hex");
}

export function readRequestContext(headers: Headers): RequestContext {
  const ip = readClientIp(headers);
  const agent = headers.get("user-agent");

  return {
    ipHash: hashIdentifier(ip ?? "unknown"),
    userAgent: agent ? agent.slice(0, USER_AGENT_MAX_LENGTH) : null,
  };
}

function hashSecret() {
  return (
    process.env.AUDIT_HASH_SECRET ??
    process.env.NURSE_DASHBOARD_SESSION_SECRET ??
    "custodia-development-hash-secret"
  );
}

import { NextResponse } from "next/server";

export const genericServerErrorMessage =
  "The screening service is temporarily unavailable. Please try again shortly.";

export function errorResponse(status: number, errors: string[], headers?: HeadersInit) {
  return NextResponse.json({ errors }, { status, headers });
}

export class ScoringRuleUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Scoring rule unavailable: ${reason}`);
    this.name = "ScoringRuleUnavailableError";
  }
}

export function isUniqueConstraintError(error: unknown, target: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : null;

  if (code !== "P2002") {
    return false;
  }

  const meta = "meta" in error ? (error.meta as { target?: unknown } | null) : null;
  const targets = Array.isArray(meta?.target) ? meta?.target : [meta?.target];

  return targets.some((value) => typeof value === "string" && value.includes(target));
}
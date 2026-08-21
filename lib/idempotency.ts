import { safeEquals } from "@/lib/password-hash";

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

export type IdempotentSubmissionOwner = {
  sessionId: string;
  responsesHash: string;
};

export type IdempotencyDecision = {
  outcome: "replay" | "conflict";
  sessionMatched: boolean;
  responsesMatched: boolean;
};

export function isValidIdempotencyKey(key: string) {
  return IDEMPOTENCY_KEY_PATTERN.test(key);
}

export function resolveIdempotentReplay(
  stored: IdempotentSubmissionOwner,
  caller: IdempotentSubmissionOwner,
): IdempotencyDecision {
  const sessionMatched = safeEquals(stored.sessionId, caller.sessionId);
  const responsesMatched = safeEquals(stored.responsesHash, caller.responsesHash);

  return {
    outcome: sessionMatched || responsesMatched ? "replay" : "conflict",
    sessionMatched,
    responsesMatched,
  };
}

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { retryAfterSeconds, windowStartFor } from "@/lib/rate-limit-window";

const CLEANUP_PROBABILITY = 0.02;
const CLEANUP_RETENTION_HOURS = 24;

export type RateLimitRule = {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  bucket: string;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitDecision> {
  const now = new Date();
  const windowStart = windowStartFor(now, rule.windowSeconds);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_counters" ("id", "bucket", "identifier", "window_start", "count")
    VALUES (${randomUUID()}, ${rule.bucket}, ${rule.identifier}, ${windowStart}, 1)
    ON CONFLICT ("bucket", "identifier", "window_start")
    DO UPDATE SET "count" = "rate_limit_counters"."count" + 1
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? rule.limit + 1);

  void pruneExpiredCounters();

  return {
    allowed: count <= rule.limit,
    bucket: rule.bucket,
    count,
    limit: rule.limit,
    retryAfterSeconds: retryAfterSeconds(now, windowStart, rule.windowSeconds),
  };
}

export async function consumeRateLimits(rules: RateLimitRule[]): Promise<RateLimitDecision> {
  let blocked: RateLimitDecision | null = null;

  for (const rule of rules) {
    const decision = await consumeRateLimit(rule);

    if (!decision.allowed && (!blocked || decision.retryAfterSeconds > blocked.retryAfterSeconds)) {
      blocked = decision;
    }
  }

  return blocked ?? { allowed: true, bucket: "none", count: 0, limit: 0, retryAfterSeconds: 0 };
}

async function pruneExpiredCounters() {
  if (Math.random() > CLEANUP_PROBABILITY) {
    return;
  }

  const cutoff = new Date(Date.now() - CLEANUP_RETENTION_HOURS * 60 * 60 * 1000);

  try {
    await prisma.rateLimitCounter.deleteMany({ where: { windowStart: { lt: cutoff } } });
  } catch {
    return;
  }
}

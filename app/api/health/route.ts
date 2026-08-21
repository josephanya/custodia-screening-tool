import { NextResponse } from "next/server";

import { hashForBranch } from "@/lib/hashing";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ScoringRuleStatus } from "@/lib/generated/prisma/client";
import { SCORING_ENGINE_VERSION } from "@/lib/scoring-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const [, activeRules] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.scoringRuleVersion.findMany({
        where: { status: ScoringRuleStatus.ACTIVE },
        select: { branch: true, versionNumber: true, rulesetHash: true },
      }),
    ]);
    const rulesetsInSync = activeRules.every(
      (rule) =>
        rule.rulesetHash ===
        hashForBranch(rule.branch === "RISK_OF_DIABETES" ? "risk_of_diabetes" : "complication_risk"),
    );

    return NextResponse.json(
      {
        ok: rulesetsInSync && activeRules.length > 0,
        database: "connected",
        engineVersion: SCORING_ENGINE_VERSION,
        activeRulesets: activeRules.length,
        rulesetsInSync,
        latencyMs: Date.now() - startedAt,
      },
      { status: rulesetsInSync && activeRules.length > 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("health_check_failed", error);

    return NextResponse.json(
      { ok: false, database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

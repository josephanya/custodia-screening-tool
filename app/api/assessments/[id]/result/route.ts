import { NextRequest, NextResponse } from "next/server";

import { errorResponse, genericServerErrorMessage } from "@/lib/api-errors";
import {
  fromPrismaClassification,
  fromPrismaDiabetesStatus,
  fromPrismaScoringBranch,
  fromPrismaUrgency,
} from "@/lib/assessment-api";
import { auditActions, recordAuditEvent } from "@/lib/audit";
import { assessmentSessionCookieName } from "@/lib/cookies";
import { AuditActorType } from "@/lib/generated/prisma/client";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestContext } from "@/lib/request-context";

const notFoundMessage = "Assessment result was not found for this session.";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestContext = readRequestContext(request.headers);

  try {
    const rateLimit = await consumeRateLimit({
      bucket: "assessment_result_ip",
      identifier: requestContext.ipHash,
      limit: 120,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return errorResponse(429, ["Too many requests. Please try again later."], {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      });
    }

    const sessionId = request.cookies.get(assessmentSessionCookieName())?.value;

    if (!sessionId) {
      return errorResponse(404, [notFoundMessage]);
    }

    const { id } = await context.params;
    const result = await prisma.result.findFirst({
      where: {
        assessmentId: id,
        assessment: { sessionId },
      },
      include: {
        assessment: true,
        scoringRuleVersion: true,
      },
    });

    if (!result) {
      return errorResponse(404, [notFoundMessage]);
    }

    await recordAuditEvent({
      action: auditActions.assessmentResultViewed,
      actorType: AuditActorType.PUBLIC,
      resourceType: "assessment",
      resourceId: result.assessmentId,
      ipHash: requestContext.ipHash,
      userAgent: requestContext.userAgent,
    });

    return NextResponse.json(
      {
        assessment: {
          id: result.assessment.id,
          referenceCode: result.assessment.referenceCode,
          diabetesStatus: fromPrismaDiabetesStatus(result.assessment.diabetesStatus),
          questionnaireVersion: result.assessment.questionnaireVersion,
          responses: result.assessment.anonymizedAt ? null : result.assessment.responses,
          createdAt: result.assessment.createdAt,
        },
        result: {
          id: result.id,
          classification: fromPrismaClassification(result.classification),
          urgency: fromPrismaUrgency(result.urgency),
          urgentCareRecommended: result.urgentCareRecommended,
          score: result.score === null ? null : Number(result.score),
          contributingFactors: result.contributingFactors,
          redFlags: result.redFlags,
          createdAt: result.createdAt,
        },
        scoringRuleVersion: {
          id: result.scoringRuleVersion.id,
          branch: fromPrismaScoringBranch(result.scoringRuleVersion.branch),
          versionNumber: result.scoringRuleVersion.versionNumber,
          rulesetHash: result.rulesetHash,
          engineVersion: result.engineVersion,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("assessment_result_read_failed", error);

    return errorResponse(500, [genericServerErrorMessage]);
  }
}
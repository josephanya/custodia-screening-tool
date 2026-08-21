import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { errorResponse, genericServerErrorMessage, isUniqueConstraintError, ScoringRuleUnavailableError } from "@/lib/api-errors";
import {
  fromPrismaClassification,
  fromPrismaScoringBranch,
  fromPrismaUrgency,
  toPrismaClassification,
  toPrismaDiabetesStatus,
  toPrismaScoringBranch,
  toPrismaUrgency,
} from "@/lib/assessment-api";
import { validateAssessmentSubmission } from "@/lib/assessment-submission";
import { auditActions, recordAuditEvent } from "@/lib/audit";
import { assessmentSessionCookieName, assessmentSessionMaxAgeSeconds, sessionCookieOptions } from "@/lib/cookies";
import { AuditActorType, Prisma, ScoringRuleStatus } from "@/lib/generated/prisma/client";
import { canonicalHash, hashForBranch } from "@/lib/hashing";
import { isValidIdempotencyKey, resolveIdempotentReplay } from "@/lib/idempotency";
import { logError, logEvent, logWarning } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { consumeRateLimits } from "@/lib/rate-limit";
import { createReferenceCode } from "@/lib/reference-code";
import { readRequestContext, type RequestContext } from "@/lib/request-context";
import { scoreAssessment, scoringRuleVersions, type ScoringResult } from "@/lib/scoring";

const MAX_BODY_BYTES = 16 * 1024;

const submissionRateLimits = {
  perIp: { limit: 30, windowSeconds: 60 * 60 },
  perSession: { limit: 5, windowSeconds: 60 * 60 },
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const context = readRequestContext(request.headers);
  const sessionId = request.cookies.get(assessmentSessionCookieName())?.value ?? randomUUID();
  let racedIdempotencyKey: string | null = null;
  let racedResponsesHash: string | null = null;

  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);

    if (declaredLength > MAX_BODY_BYTES) {
      return errorResponse(413, ["Request body is too large."]);
    }

    const rateLimit = await consumeRateLimits([
      {
        bucket: "assessment_submit_ip",
        identifier: context.ipHash,
        ...submissionRateLimits.perIp,
      },
      {
        bucket: "assessment_submit_session",
        identifier: sessionId,
        ...submissionRateLimits.perSession,
      },
    ]);

    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: auditActions.assessmentRateLimited,
        actorType: AuditActorType.PUBLIC,
        ipHash: context.ipHash,
        userAgent: context.userAgent,
        metadata: { bucket: rateLimit.bucket, count: rateLimit.count, limit: rateLimit.limit },
      });
      logWarning("assessment_rate_limited", { bucket: rateLimit.bucket, count: rateLimit.count });

      return errorResponse(429, ["Too many screening submissions. Please try again later."], {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      });
    }

    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
      return errorResponse(400, ["Idempotency-Key must be 8 to 128 URL-safe characters."]);
    }

    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return errorResponse(413, ["Request body is too large."]);
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, ["Request body must be valid JSON."]);
    }

    const validation = validateAssessmentSubmission(payload);

    if (!validation.ok) {
      return errorResponse(400, validation.errors);
    }

    const responsesHash = canonicalHash(validation.responses);

    racedIdempotencyKey = idempotencyKey;
    racedResponsesHash = responsesHash;

    if (idempotencyKey) {
      const replay = await replayStoredSubmission({
        idempotencyKey,
        sessionId,
        responsesHash,
        context,
      });

      if (replay) {
        return replay;
      }
    }

    const scoringResult = scoreAssessment(validation.input);
    const stored = await persistSubmission({
      sessionId,
      idempotencyKey,
      responses: validation.responses,
      responsesHash,
      scoringResult,
    });

    await recordAuditEvent({
      action: auditActions.assessmentCreated,
      actorType: AuditActorType.PUBLIC,
      resourceType: "assessment",
      resourceId: stored.assessmentId,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      metadata: {
        branch: scoringResult.branch,
        classification: scoringResult.classification,
        urgency: scoringResult.urgency,
        ruleVersion: scoringResult.ruleVersion,
      },
    });
    logEvent("assessment_created", {
      assessmentId: stored.assessmentId,
      branch: scoringResult.branch,
      classification: scoringResult.classification,
      urgency: scoringResult.urgency,
      ruleVersion: scoringResult.ruleVersion,
      durationMs: Date.now() - startedAt,
    });

    return submissionResponse(stored, sessionId, 201, false);
  } catch (error) {
    if (isUniqueConstraintError(error, "idempotency_key") && racedIdempotencyKey && racedResponsesHash) {
      const replay = await replayStoredSubmission({
        idempotencyKey: racedIdempotencyKey,
        sessionId,
        responsesHash: racedResponsesHash,
        context,
      });

      if (replay) {
        return replay;
      }
    }

    if (error instanceof ScoringRuleUnavailableError) {
      await recordAuditEvent({
        action: auditActions.rulesetMismatch,
        actorType: AuditActorType.SYSTEM,
        ipHash: context.ipHash,
        userAgent: context.userAgent,
        metadata: { reason: error.reason },
      });
      logError("scoring_rule_unavailable", error, { reason: error.reason });

      return errorResponse(503, [genericServerErrorMessage]);
    }

    logError("assessment_submission_failed", error, { durationMs: Date.now() - startedAt });

    return errorResponse(500, [genericServerErrorMessage]);
  }
}

type StoredSubmission = {
  assessmentId: string;
  referenceCode: string;
  resultId: string;
  scoringRuleVersion: number;
  sessionId: string;
  responsesHash: string;
  result: ScoringResult;
};

async function persistSubmission({
  sessionId,
  idempotencyKey,
  responses,
  responsesHash,
  scoringResult,
}: {
  sessionId: string;
  idempotencyKey: string | null;
  responses: Prisma.InputJsonValue;
  responsesHash: string;
  scoringResult: ScoringResult;
}): Promise<StoredSubmission> {
  const expectedHash = hashForBranch(scoringResult.branch);

  return prisma.$transaction(async (transaction) => {
    const ruleVersion = await transaction.scoringRuleVersion.findUnique({
      where: {
        branch_versionNumber: {
          branch: toPrismaScoringBranch(scoringResult.branch),
          versionNumber: scoringRuleVersions[scoringResult.branch],
        },
      },
    });

    if (!ruleVersion) {
      throw new ScoringRuleUnavailableError(`no rule row for ${scoringResult.branch} v${scoringResult.ruleVersion}`);
    }

    if (ruleVersion.status !== ScoringRuleStatus.ACTIVE) {
      throw new ScoringRuleUnavailableError(`rule ${ruleVersion.id} is ${ruleVersion.status}`);
    }

    if (ruleVersion.effectiveFrom.getTime() > Date.now()) {
      throw new ScoringRuleUnavailableError(`rule ${ruleVersion.id} is not yet effective`);
    }

    if (ruleVersion.rulesetHash !== expectedHash) {
      throw new ScoringRuleUnavailableError(
        `rule ${ruleVersion.id} hash ${ruleVersion.rulesetHash.slice(0, 12)} does not match engine hash ${expectedHash.slice(0, 12)}`,
      );
    }

    const assessment = await transaction.assessment.create({
      data: {
        referenceCode: createReferenceCode(),
        sessionId,
        idempotencyKey,
        questionnaireVersion: scoringResult.questionnaireVersion,
        responsesHash,
        diabetesStatus: toPrismaDiabetesStatus(scoringResult.branch === "risk_of_diabetes" ? "not_diagnosed" : "diagnosed"),
        responses,
      },
    });
    const result = await transaction.result.create({
      data: {
        assessmentId: assessment.id,
        scoringRuleVersionId: ruleVersion.id,
        classification: toPrismaClassification(scoringResult.classification),
        urgency: toPrismaUrgency(scoringResult.urgency),
        urgentCareRecommended: scoringResult.urgentCareRecommended,
        score: scoringResult.score,
        contributingFactors: scoringResult.contributingFactors,
        redFlags: scoringResult.redFlags,
        rulesetHash: expectedHash,
        engineVersion: scoringResult.engineVersion,
      },
    });

    return {
      assessmentId: assessment.id,
      referenceCode: assessment.referenceCode,
      resultId: result.id,
      scoringRuleVersion: ruleVersion.versionNumber,
      sessionId: assessment.sessionId,
      responsesHash: assessment.responsesHash,
      result: scoringResult,
    };
  });
}

async function replayStoredSubmission({
  idempotencyKey,
  sessionId,
  responsesHash,
  context,
}: {
  idempotencyKey: string;
  sessionId: string;
  responsesHash: string;
  context: RequestContext;
}) {
  const stored = await findStoredSubmission({ idempotencyKey });

  if (!stored) {
    return null;
  }

  const decision = resolveIdempotentReplay(stored, { sessionId, responsesHash });

  if (decision.outcome === "conflict") {
    await recordAuditEvent({
      action: auditActions.assessmentIdempotencyConflict,
      actorType: AuditActorType.PUBLIC,
      resourceType: "assessment",
      resourceId: stored.assessmentId,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });
    logWarning("assessment_idempotency_conflict", { assessmentId: stored.assessmentId });

    return errorResponse(409, [
      "This Idempotency-Key was already used for a different submission. Retry with a new key.",
    ]);
  }

  await recordAuditEvent({
    action: auditActions.assessmentReplayed,
    actorType: AuditActorType.PUBLIC,
    resourceType: "assessment",
    resourceId: stored.assessmentId,
    ipHash: context.ipHash,
    userAgent: context.userAgent,
    metadata: {
      sessionMatched: decision.sessionMatched,
      responsesMatched: decision.responsesMatched,
    },
  });

  return submissionResponse(stored, sessionId, 200, true);
}

async function findStoredSubmission({
  idempotencyKey,
}: {
  idempotencyKey: string;
}): Promise<StoredSubmission | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { idempotencyKey },
    include: { result: { include: { scoringRuleVersion: true } } },
  });

  if (!assessment?.result) {
    return null;
  }

  return {
    assessmentId: assessment.id,
    referenceCode: assessment.referenceCode,
    resultId: assessment.result.id,
    scoringRuleVersion: assessment.result.scoringRuleVersion.versionNumber,
    sessionId: assessment.sessionId,
    responsesHash: assessment.responsesHash,
    result: rebuildScoringResult(assessment.result, assessment.questionnaireVersion),
  };
}

function rebuildScoringResult(
  result: Prisma.ResultGetPayload<{ include: { scoringRuleVersion: true } }>,
  questionnaireVersion: string,
): ScoringResult {
  return {
    branch: fromPrismaScoringBranch(result.scoringRuleVersion.branch),
    ruleVersion: result.scoringRuleVersion.versionNumber,
    questionnaireVersion,
    engineVersion: result.engineVersion,
    classification: fromPrismaClassification(result.classification),
    score: result.score === null ? null : Number(result.score),
    contributingFactors: (result.contributingFactors ?? []) as ScoringResult["contributingFactors"],
    redFlags: (result.redFlags ?? []) as ScoringResult["redFlags"],
    urgency: fromPrismaUrgency(result.urgency),
    urgentCareRecommended: result.urgentCareRecommended,
  };
}

function submissionResponse(
  stored: StoredSubmission,
  sessionId: string,
  status: number,
  replayed: boolean,
) {
  const response = NextResponse.json(
    {
      assessmentId: stored.assessmentId,
      referenceCode: stored.referenceCode,
      resultId: stored.resultId,
      scoringRuleVersion: stored.scoringRuleVersion,
      result: stored.result,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Idempotency-Replayed": String(replayed),
      },
    },
  );

  response.cookies.set(
    assessmentSessionCookieName(),
    sessionId,
    sessionCookieOptions(assessmentSessionMaxAgeSeconds),
  );

  return response;
}
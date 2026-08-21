import { AuditActorType, type Prisma } from "@/lib/generated/prisma/client";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const auditActions = {
  loginSuccess: "login_success",
  loginFailure: "login_failure",
  loginThrottled: "login_throttled",
  loginNotConfigured: "login_not_configured",
  logout: "logout",
  sessionExpired: "session_expired",
  assessmentCreated: "assessment_created",
  assessmentReplayed: "assessment_replayed",
  assessmentIdempotencyConflict: "assessment_idempotency_conflict",
  assessmentRateLimited: "assessment_rate_limited",
  assessmentResultViewed: "assessment_result_viewed",
  assessmentListViewed: "assessment_list_viewed",
  assessmentSearched: "assessment_searched",
  assessmentViewed: "assessment_viewed",
  rulesetMismatch: "ruleset_mismatch",
} as const;

export type AuditAction = (typeof auditActions)[keyof typeof auditActions];

export type AuditEventInput = {
  action: AuditAction;
  actorType: AuditActorType;
  actorSessionId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: event.action,
        actorType: event.actorType,
        actorSessionId: event.actorSessionId ?? null,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        ipHash: event.ipHash ?? null,
        userAgent: event.userAgent ?? null,
        metadata: event.metadata ?? undefined,
      },
    });
  } catch (error) {
    logError("audit_write_failed", error, { action: event.action });
  }
}

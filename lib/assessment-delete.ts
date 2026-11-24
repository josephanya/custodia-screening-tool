import { AuditActorType } from "@/lib/generated/prisma/client";
import { normalizeReferenceCode } from "@/lib/reference-code";
import type { RequestContext } from "@/lib/request-context";

export type DeleteAssessmentStatus = "deleted" | "not_found" | "confirmation_mismatch";

type AssessmentDeleteClient = {
  assessment: {
    findUnique(input: { where: { id: string }; select: { id: true; referenceCode: true } }): Promise<{
      id: string;
      referenceCode: string;
    } | null>;
    deleteMany(input: { where: { id: string } }): Promise<{ count: number }>;
  };
  recordAuditEvent(event: {
    action: "assessment_deleted";
    actorType: AuditActorType;
    actorSessionId: string;
    resourceType: "assessment";
    resourceId: string;
    ipHash: string | null;
    userAgent: string | null;
    metadata: { referenceCode: string };
  }): Promise<void>;
};

type DeleteAssessmentForNurseInput = {
  assessmentId: string;
  confirmation: string;
  sessionId: string;
  request: RequestContext;
};

export async function deleteAssessmentForNurse(
  input: DeleteAssessmentForNurseInput,
  client: AssessmentDeleteClient,
): Promise<{ status: DeleteAssessmentStatus }> {
  const assessment = await client.assessment.findUnique({
    where: { id: input.assessmentId },
    select: { id: true, referenceCode: true },
  });

  if (!assessment) {
    return { status: "not_found" };
  }

  if (normalizeReferenceCode(input.confirmation) !== assessment.referenceCode) {
    return { status: "confirmation_mismatch" };
  }

  const deleted = await client.assessment.deleteMany({ where: { id: assessment.id } });

  if (deleted.count === 0) {
    return { status: "not_found" };
  }

  await client.recordAuditEvent({
    action: "assessment_deleted",
    actorType: AuditActorType.NURSE,
    actorSessionId: input.sessionId,
    resourceType: "assessment",
    resourceId: assessment.id,
    ipHash: input.request.ipHash,
    userAgent: input.request.userAgent,
    metadata: { referenceCode: assessment.referenceCode },
  });

  return { status: "deleted" };
}

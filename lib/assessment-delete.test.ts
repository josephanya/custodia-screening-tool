import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deleteAssessmentForNurse } from "./assessment-delete";
import { AuditActorType } from "./generated/prisma/client";

describe("deleteAssessmentForNurse", () => {
  it("deletes the assessment and records a nurse audit event when confirmation matches", async () => {
    const auditEvents: unknown[] = [];
    const deleted: string[] = [];

    const result = await deleteAssessmentForNurse(
      {
        assessmentId: "assessment-1",
        confirmation: "kyr-7f3k-92qd",
        sessionId: "session-1",
        request: { ipHash: "ip-hash", userAgent: "test-agent" },
      },
      {
        assessment: {
          findUnique: async () => ({ id: "assessment-1", referenceCode: "KYR-7F3K-92QD" }),
          deleteMany: async ({ where }) => {
            deleted.push(`assessment:${where.id}`);
            return { count: 1 };
          },
        },
        result: {
          deleteMany: async ({ where }) => {
            deleted.push(`result:${where.assessmentId}`);
            return { count: 1 };
          },
        },
        recordAuditEvent: async (event) => {
          auditEvents.push(event);
        },
      },
    );

    assert.equal(result.status, "deleted");
    assert.deepEqual(deleted, ["result:assessment-1", "assessment:assessment-1"]);
    assert.deepEqual(auditEvents, [
      {
        action: "assessment_deleted",
        actorType: AuditActorType.NURSE,
        actorSessionId: "session-1",
        resourceType: "assessment",
        resourceId: "assessment-1",
        ipHash: "ip-hash",
        userAgent: "test-agent",
        metadata: { referenceCode: "KYR-7F3K-92QD" },
      },
    ]);
  });

  it("does not delete when confirmation does not match the assessment reference", async () => {
    let deleteCalled = false;

    const result = await deleteAssessmentForNurse(
      {
        assessmentId: "assessment-1",
        confirmation: "KYR-WRONG",
        sessionId: "session-1",
        request: { ipHash: "ip-hash", userAgent: null },
      },
      {
        assessment: {
          findUnique: async () => ({ id: "assessment-1", referenceCode: "KYR-7F3K-92QD" }),
          deleteMany: async () => {
            deleteCalled = true;
            return { count: 1 };
          },
        },
        result: {
          deleteMany: async () => {
            deleteCalled = true;
            return { count: 1 };
          },
        },
        recordAuditEvent: async () => {},
      },
    );

    assert.equal(result.status, "confirmation_mismatch");
    assert.equal(deleteCalled, false);
  });
});

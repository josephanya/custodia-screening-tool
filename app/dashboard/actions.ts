"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteAssessmentForNurse } from "@/lib/assessment-delete";
import { auditActions, recordAuditEvent } from "@/lib/audit";
import { AuditActorType } from "@/lib/generated/prisma/client";
import { logEvent, logWarning } from "@/lib/logger";
import {
  isNurseAuthConfigured,
  revokeNurseSession,
  startNurseSession,
  verifyNursePassword,
} from "@/lib/nurse-auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimits } from "@/lib/rate-limit";
import { readRequestContext } from "@/lib/request-context";
import { requireNurseSession } from "./require-session";

const loginRateLimits = [
  { bucket: "nurse_login_ip", limit: 5, windowSeconds: 5 * 60 },
  { bucket: "nurse_login_global", limit: 30, windowSeconds: 60 * 60 },
];

export async function signInNurse(formData: FormData) {
  const context = readRequestContext(await headers());

  if (!isNurseAuthConfigured()) {
    await recordAuditEvent({
      action: auditActions.loginNotConfigured,
      actorType: AuditActorType.NURSE,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });
    redirect("/dashboard/login?error=not_configured");
  }

  const rateLimit = await consumeRateLimits([
    { ...loginRateLimits[0], identifier: context.ipHash },
    { ...loginRateLimits[1], identifier: "all" },
  ]);

  if (!rateLimit.allowed) {
    await recordAuditEvent({
      action: auditActions.loginThrottled,
      actorType: AuditActorType.NURSE,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      metadata: { bucket: rateLimit.bucket, count: rateLimit.count, limit: rateLimit.limit },
    });
    logWarning("nurse_login_throttled", { bucket: rateLimit.bucket, count: rateLimit.count });
    redirect("/dashboard/login?error=too_many_attempts");
  }

  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect("/dashboard/login?error=missing_password");
  }

  if (!verifyNursePassword(password)) {
    await recordAuditEvent({
      action: auditActions.loginFailure,
      actorType: AuditActorType.NURSE,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });
    logWarning("nurse_login_failed", { ipHash: context.ipHash });
    redirect("/dashboard/login?error=invalid_password");
  }

  const session = await startNurseSession(context);

  await recordAuditEvent({
    action: auditActions.loginSuccess,
    actorType: AuditActorType.NURSE,
    actorSessionId: session.id,
    ipHash: context.ipHash,
    userAgent: context.userAgent,
  });
  logEvent("nurse_login_succeeded", { sessionId: session.id });

  redirect("/dashboard");
}

export async function signOutNurse() {
  const context = readRequestContext(await headers());
  const revoked = await revokeNurseSession();

  if (revoked) {
    await recordAuditEvent({
      action: auditActions.logout,
      actorType: AuditActorType.NURSE,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });
  }

  redirect("/dashboard/login");
}

export async function deleteAssessment(formData: FormData) {
  const session = await requireNurseSession();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!assessmentId) {
    redirect("/dashboard?deleteError=missing_assessment");
  }

  const result = await deleteAssessmentForNurse(
    {
      assessmentId,
      confirmation,
      sessionId: session.sessionId,
      request: session.request,
    },
    {
      assessment: prisma.assessment,
      recordAuditEvent,
    },
  );

  if (result.status === "confirmation_mismatch") {
    redirect(`/dashboard/assessments/${assessmentId}?deleteError=confirmation`);
  }

  if (result.status === "not_found") {
    redirect("/dashboard?deleteError=not_found");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}
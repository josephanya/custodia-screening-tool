import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const retentionDays = Number(process.env.ASSESSMENT_RETENTION_DAYS ?? 365);
const auditRetentionDays = Number(process.env.AUDIT_RETENTION_DAYS ?? 730);
const rateLimitRetentionHours = 24;

async function main() {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error("ASSESSMENT_RETENTION_DAYS must be a positive number of days");
  }

  const now = Date.now();
  const assessmentCutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now - auditRetentionDays * 24 * 60 * 60 * 1000);
  const rateLimitCutoff = new Date(now - rateLimitRetentionHours * 60 * 60 * 1000);

  const anonymized = await prisma.assessment.updateMany({
    where: { createdAt: { lt: assessmentCutoff }, anonymizedAt: null },
    data: { responses: {}, sessionId: "", idempotencyKey: null, anonymizedAt: new Date() },
  });
  const expiredSessions = await prisma.nurseSession.deleteMany({
    where: { expiresAt: { lt: new Date(now) } },
  });
  const staleCounters = await prisma.rateLimitCounter.deleteMany({
    where: { windowStart: { lt: rateLimitCutoff } },
  });
  const expiredAudit = await prisma.auditEvent.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  console.log(
    JSON.stringify({
      event: "retention_completed",
      assessmentCutoff: assessmentCutoff.toISOString(),
      anonymizedAssessments: anonymized.count,
      deletedNurseSessions: expiredSessions.count,
      deletedRateLimitCounters: staleCounters.count,
      deletedAuditEvents: expiredAudit.count,
    }),
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { AssessmentCard, AssessmentRow } from "./assessment-row";
import { NurseHeader } from "./nurse-header";
import { requireNurseSession } from "./require-session";
import {
  fromPrismaClassification,
  fromPrismaDiabetesStatus,
  fromPrismaUrgency,
} from "@/lib/assessment-api";
import { auditActions, recordAuditEvent } from "@/lib/audit";
import {
  AuditActorType,
  Classification as PrismaClassification,
  ClinicalUrgency as PrismaClinicalUrgency,
  type Prisma,
} from "@/lib/generated/prisma/client";
import { normalizeReferenceCode } from "@/lib/reference-code";
import { prisma } from "@/lib/prisma";
import type { Classification } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NurseDashboardPageProps = {
  searchParams: Promise<{
    reference?: string;
    after?: string;
  }>;
};

export default async function NurseDashboardPage({ searchParams }: NurseDashboardPageProps) {
  const session = await requireNurseSession();
  const { reference, after } = await searchParams;
  const referenceQuery = reference?.trim() ?? "";
  const emptyReferenceError = reference !== undefined && referenceQuery.length === 0;
  const normalizedReference = referenceQuery ? normalizeReferenceCode(referenceQuery) : null;
  const referenceError = emptyReferenceError
    ? "Enter a reference code to search."
    : referenceQuery && !normalizedReference
      ? `Enter the full code, e.g. ${referenceExample()}.`
      : null;
  const cursor = after && UUID_PATTERN.test(after) ? after : null;

  const where: Prisma.AssessmentWhereInput = normalizedReference
    ? { referenceCode: normalizedReference }
    : {};
  const [page, totalCount, highRiskCount, urgentCount, emergencyCount, urgentOnlyCount] = await Promise.all([
    prisma.assessment.findMany({
      where,
      select: {
        id: true,
        referenceCode: true,
        diabetesStatus: true,
        createdAt: true,
        anonymizedAt: true,
        result: {
          select: {
            classification: true,
            urgency: true,
            score: true,
            scoringRuleVersion: {
              select: { versionNumber: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.assessment.count({ where }),
    prisma.result.count({
      where: { classification: PrismaClassification.DIABETES_HIGH, assessment: where },
    }),
    prisma.result.count({
      where: {
        urgency: { in: [PrismaClinicalUrgency.URGENT, PrismaClinicalUrgency.EMERGENCY] },
        assessment: where,
      },
    }),
    prisma.result.count({
      where: { urgency: PrismaClinicalUrgency.EMERGENCY, assessment: where },
    }),
    prisma.result.count({
      where: { urgency: PrismaClinicalUrgency.URGENT, assessment: where },
    }),
  ]);
  const assessments = page.slice(0, PAGE_SIZE);
  const nextCursor = page.length > PAGE_SIZE ? assessments[assessments.length - 1]?.id : null;

  await recordAuditEvent({
    action: reference !== undefined ? auditActions.assessmentSearched : auditActions.assessmentListViewed,
    actorType: AuditActorType.NURSE,
    actorSessionId: session.sessionId,
    ipHash: session.request.ipHash,
    userAgent: session.request.userAgent,
    metadata: {
      returned: assessments.length,
      paginated: Boolean(cursor),
      matched: normalizedReference ? assessments.length > 0 : undefined,
      valid: reference !== undefined ? !referenceError : undefined,
    },
  });

  const rows = assessments.map((assessment) => {
    const diabetesStatus = fromPrismaDiabetesStatus(assessment.diabetesStatus);
    const classification = assessment.result
      ? fromPrismaClassification(assessment.result.classification)
      : null;

    return {
      classification: classification ? formatClassification(classification) : "Pending result",
      diabetesStatus: diabetesStatus === "diagnosed" ? "Diagnosed" : "Not diagnosed",
      flagged: diabetesStatus === "diagnosed" && classification === "diabetes_high",
      href: `/dashboard/assessments/${assessment.id}`,
      referenceCode: assessment.anonymizedAt
        ? `${assessment.referenceCode} (anonymised)`
        : assessment.referenceCode,
      ruleVersion: assessment.result
        ? `v${assessment.result.scoringRuleVersion.versionNumber}`
        : missingValue(),
      score: formatScore(assessment.result?.score),
      submittedAt: formatDateTime(assessment.createdAt),
      urgency: assessment.result ? fromPrismaUrgency(assessment.result.urgency) : "routine",
    };
  });

  const searchForm = (
      <form className="dashboardSearch" action="/dashboard">
        <label htmlFor="reference">Search by reference</label>
        <div>
          <span className="dashboardSearchInputWrap">
            <span aria-hidden="true" className="dashboardSearchIcon" />
            <input
              aria-describedby={referenceError ? "reference-error" : undefined}
              aria-invalid={referenceError ? "true" : undefined}
              id="reference"
              name="reference"
              placeholder="Enter full reference code"
              type="search"
              defaultValue={referenceQuery}
            />
          </span>
          <button className="primaryButton" type="submit">
            Search
          </button>
          {referenceQuery || referenceError ? (
            <a className="secondaryButton" href="/dashboard">
              Clear
            </a>
          ) : null}
        </div>
        {referenceError ? (
          <p className="fieldError dashboardSearchError" id="reference-error" role="alert">
            <ErrorIcon />
            {referenceError}
          </p>
        ) : null}
      </form>
  );

  return (
    <DashboardShell headerAside={searchForm}>
      <div className="dashboardStats" aria-label="Assessment totals">
        <div className="dashboardStatCard">
          <p>{normalizedReference ? "Matching assessments" : "Total assessments"}</p>
          <span>{totalCount}</span>
        </div>
        <div className="dashboardStatCard">
          <p>Diabetes high risk</p>
          <span>{highRiskCount}</span>
        </div>
        <div className="dashboardStatCard dashboardStatCard-urgent">
          <p>Urgent or emergency</p>
          <span>
            <strong>{urgentCount}</strong>
            <small>
              <b>{emergencyCount} EMERGENCY</b> · <em>{urgentOnlyCount} URGENT</em>
            </small>
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`emptyState ${normalizedReference ? "emptyStateNoMatch" : ""}`}>
          {normalizedReference ? (
            <>
              <h2>
                No assessment matches <span className="monospace">{normalizedReference}</span>
              </h2>
              <p>Check each character and try again. Search needs the full reference code.</p>
              <a className="dashboardBackLink" href="/dashboard">
                Clear search and show all
              </a>
            </>
          ) : (
            <>
              <span className="emptyStateIcon" aria-hidden="true" />
              <h2>No assessments yet</h2>
              <p>New screenings will appear here as soon as they&apos;re submitted, newest first.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="dashboardTableWrap">
            <table className="dashboardTable">
              <colgroup>
                <col className="queueColFlag" />
                <col className="queueColUrgency" />
                <col className="queueColSubmitted" />
                <col className="queueColReference" />
                <col className="queueColStatus" />
                <col className="queueColClassification" />
                <col className="queueColScore" />
                <col className="queueColRule" />
                <col className="queueColAction" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Flag</th>
                  <th scope="col">Urgency</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Diabetes status</th>
                  <th scope="col">Classification</th>
                  <th scope="col">Score</th>
                  <th scope="col">Rule</th>
                  <th scope="col"><span className="srOnly">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <AssessmentRow key={row.href} {...row} />
                ))}
              </tbody>
            </table>
            <p className="dashboardShowingLabel">Showing {rows.length} of {totalCount}</p>
          </div>

          <div className="assessmentCards" aria-label="Assessment list">
            {rows.map((row) => (
              <AssessmentCard key={row.href} {...row} />
            ))}
            <p className="dashboardShowingLabel">Showing {rows.length} of {totalCount}</p>
          </div>

          {nextCursor ? (
            <a
              className="secondaryButton dashboardPager"
              href={`/dashboard?${new URLSearchParams({
                ...(referenceQuery ? { reference: referenceQuery } : {}),
                after: nextCursor,
              })}`}
            >
              Next {PAGE_SIZE}
            </a>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}

function DashboardShell({ children, headerAside }: { children: React.ReactNode; headerAside?: React.ReactNode }) {
  return (
    <>
      <NurseHeader />
      <main className="pageShell dashboardShell">
        <section className="dashboardPanel">
          <div className="dashboardHeader">
            <div>
              <p className="eyebrow">Shared nurse queue</p>
              <h1>Assessments</h1>
              <p className="dashboardIntro">
                Every submitted assessment is visible here, newest first. High-risk diabetes cases
                are flagged for follow-up, and red-flag cases are marked urgent or emergency.
              </p>
            </div>
            {headerAside}
          </div>

          {children}
        </section>
      </main>
    </>
  );
}

function formatDateTime(date: Date) {
  const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(date);

  return `${dayMonthYear} · ${time}`;
}

function formatClassification(classification: Classification) {
  switch (classification) {
    case "no_diabetes_low":
      return "Lower diabetes risk";
    case "no_diabetes_high":
      return "Higher diabetes risk";
    case "diabetes_low":
      return "Lower complication risk";
    case "diabetes_high":
      return "Higher complication risk";
  }
}

function formatScore(score: unknown) {
  if (score === null || score === undefined) {
    return "Override";
  }

  return Number(score).toString();
}

function missingValue() {
  return "—";
}

function referenceExample() {
  return "KYR-7F3K-92QD";
}

function ErrorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  );
}
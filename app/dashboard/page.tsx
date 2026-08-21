import { AssessmentRow } from "./assessment-row";
import { signOutNurse } from "./actions";
import { requireNurseSession } from "./require-session";
import {
  fromPrismaClassification,
  fromPrismaDiabetesStatus,
  fromPrismaScoringBranch,
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
import type { Classification, ScoringBranch } from "@/lib/scoring";

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
  const normalizedReference = referenceQuery ? normalizeReferenceCode(referenceQuery) : null;
  const cursor = after && UUID_PATTERN.test(after) ? after : null;

  if (referenceQuery && !normalizedReference) {
    await recordAuditEvent({
      action: auditActions.assessmentSearched,
      actorType: AuditActorType.NURSE,
      actorSessionId: session.sessionId,
      ipHash: session.request.ipHash,
      userAgent: session.request.userAgent,
      metadata: { matched: false },
    });

    return (
      <DashboardShell>
        <div className="emptyState">
          {`"${referenceQuery}" is not a valid reference code.`}
        </div>
      </DashboardShell>
    );
  }

  const where: Prisma.AssessmentWhereInput = normalizedReference
    ? { referenceCode: normalizedReference }
    : {};
  const [page, totalCount, highRiskCount, urgentCount] = await Promise.all([
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
              select: { branch: true, versionNumber: true },
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
  ]);
  const assessments = page.slice(0, PAGE_SIZE);
  const nextCursor = page.length > PAGE_SIZE ? assessments[assessments.length - 1]?.id : null;

  await recordAuditEvent({
    action: normalizedReference ? auditActions.assessmentSearched : auditActions.assessmentListViewed,
    actorType: AuditActorType.NURSE,
    actorSessionId: session.sessionId,
    ipHash: session.request.ipHash,
    userAgent: session.request.userAgent,
    metadata: { returned: assessments.length, paginated: Boolean(cursor) },
  });

  return (
    <DashboardShell>
      <div className="dashboardStats" aria-label="Assessment totals">
        <div>
          <span>{totalCount}</span>
          <p>{normalizedReference ? "Matching assessments" : "Total assessments"}</p>
        </div>
        <div>
          <span>{highRiskCount}</span>
          <p>Diabetes high risk</p>
        </div>
        <div>
          <span>{urgentCount}</span>
          <p>Urgent or emergency</p>
        </div>
      </div>

      <form className="dashboardSearch" action="/dashboard">
        <label htmlFor="reference">Search by reference</label>
        <div>
          <input
            id="reference"
            name="reference"
            placeholder="Enter full reference code"
            type="search"
            defaultValue={referenceQuery}
          />
          <button className="primaryButton" type="submit">
            Search
          </button>
          {referenceQuery ? (
            <a className="secondaryButton" href="/dashboard">
              Clear
            </a>
          ) : null}
        </div>
      </form>

      {assessments.length === 0 ? (
        <div className="emptyState">
          {normalizedReference
            ? `No assessment matches reference ${normalizedReference}.`
            : "No assessments have been submitted yet."}
        </div>
      ) : (
        <>
          <div className="dashboardTableWrap">
            <table className="dashboardTable">
              <thead>
                <tr>
                  <th scope="col">Flag</th>
                  <th scope="col">Urgency</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Diabetes status</th>
                  <th scope="col">Classification</th>
                  <th scope="col">Score</th>
                  <th scope="col">Rule version</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => {
                  const diabetesStatus = fromPrismaDiabetesStatus(assessment.diabetesStatus);
                  const classification = assessment.result
                    ? fromPrismaClassification(assessment.result.classification)
                    : null;
                  const branch = assessment.result
                    ? fromPrismaScoringBranch(assessment.result.scoringRuleVersion.branch)
                    : null;

                  return (
                    <AssessmentRow
                      key={assessment.id}
                      classification={
                        classification ? formatClassification(classification) : "Pending result"
                      }
                      diabetesStatus={diabetesStatus === "diagnosed" ? "Diagnosed" : "Not diagnosed / not sure"}
                      flagged={diabetesStatus === "diagnosed" && classification === "diabetes_high"}
                      href={`/dashboard/assessments/${assessment.id}`}
                      referenceCode={
                        assessment.anonymizedAt
                          ? `${assessment.referenceCode} (anonymised)`
                          : assessment.referenceCode
                      }
                      ruleVersion={
                        assessment.result
                          ? `${formatBranch(branch)} v${assessment.result.scoringRuleVersion.versionNumber}`
                          : "-"
                      }
                      score={formatScore(assessment.result?.score)}
                      submittedAt={formatDateTime(assessment.createdAt)}
                      urgency={assessment.result ? fromPrismaUrgency(assessment.result.urgency) : "routine"}
                    />
                  );
                })}
              </tbody>
            </table>
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

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pageShell dashboardShell">
      <section className="panel dashboardPanel">
        <div className="dashboardHeader">
          <div>
            <p className="eyebrow">Shared nurse queue</p>
            <h1>Assessments</h1>
            <p className="dashboardIntro">
              Every submitted assessment is visible here, newest first. High-risk diabetes cases are
              flagged for follow-up, and red-flag cases are marked urgent or emergency.
            </p>
          </div>
          <form action={signOutNurse}>
            <button className="secondaryButton" type="submit">
              Sign out
            </button>
          </form>
        </div>

        {children}
      </section>
    </main>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatClassification(classification: Classification) {
  return classification
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatBranch(branch: ScoringBranch | null) {
  if (!branch) {
    return "Rule";
  }

  return branch === "risk_of_diabetes" ? "Diabetes risk" : "Complication risk";
}

function formatScore(score: unknown) {
  if (score === null || score === undefined) {
    return "Override";
  }

  return Number(score).toString();
}
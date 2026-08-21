import Link from "next/link";
import { notFound } from "next/navigation";

import { requireNurseSession } from "../../require-session";
import {
  fromPrismaClassification,
  fromPrismaDiabetesStatus,
  fromPrismaScoringBranch,
  fromPrismaUrgency,
} from "@/lib/assessment-api";
import { auditActions, recordAuditEvent } from "@/lib/audit";
import { AuditActorType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  Classification,
  ClinicalUrgency,
  ContributingFactor,
  DiabetesStatus,
  ScoringBranch,
} from "@/lib/scoring";

type AssessmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

const urgencyCopy: Record<ClinicalUrgency, string | null> = {
  routine: null,
  urgent: "Red flags were reported. This person needs same-day clinical review.",
  emergency: "Emergency red flags were reported. This person was told to seek emergency care now.",
};

export default async function AssessmentDetailPage({ params }: AssessmentDetailPageProps) {
  const session = await requireNurseSession();
  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      result: {
        include: {
          scoringRuleVersion: {
            select: { branch: true, versionNumber: true },
          },
        },
      },
    },
  });

  if (!assessment) {
    notFound();
  }

  await recordAuditEvent({
    action: auditActions.assessmentViewed,
    actorType: AuditActorType.NURSE,
    actorSessionId: session.sessionId,
    resourceType: "assessment",
    resourceId: assessment.id,
    ipHash: session.request.ipHash,
    userAgent: session.request.userAgent,
  });

  const diabetesStatus = fromPrismaDiabetesStatus(assessment.diabetesStatus);
  const classification = assessment.result ? fromPrismaClassification(assessment.result.classification) : null;
  const urgency = assessment.result ? fromPrismaUrgency(assessment.result.urgency) : "routine";
  const branch = assessment.result ? fromPrismaScoringBranch(assessment.result.scoringRuleVersion.branch) : null;
  const factors = parseContributingFactors(assessment.result?.contributingFactors);
  const redFlags = parseContributingFactors(assessment.result?.redFlags);

  return (
    <main className="pageShell dashboardShell">
      <section className="panel dashboardPanel">
        <Link className="dashboardBackLink" href="/dashboard">
          Back to all assessments
        </Link>

        <div className="detailHeader">
          <div>
            <p className="eyebrow">Assessment detail</p>
            <h1>{formatClassification(classification)}</h1>
            <p className="dashboardIntro">
              Reference {assessment.referenceCode} · Submitted {formatDateTime(assessment.createdAt)}
            </p>
          </div>
          {diabetesStatus === "diagnosed" && classification === "diabetes_high" ? (
            <span className="flagBadge detailFlag" aria-label="Diabetes high-risk follow-up">
              FLAG
            </span>
          ) : null}
        </div>

        {urgencyCopy[urgency] ? (
          <div className={`urgencyBanner urgencyBanner-${urgency}`} role="alert">
            <strong>{urgency === "emergency" ? "Emergency" : "Urgent"}</strong>
            <p>{urgencyCopy[urgency]}</p>
            {redFlags.length > 0 ? (
              <ul>
                {redFlags.map((redFlag) => (
                  <li key={redFlag.id ?? redFlag.label}>{redFlag.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="detailGrid">
          <section className="detailBlock">
            <h2>Summary</h2>
            <dl className="summaryList">
              <div>
                <dt>Reference</dt>
                <dd>{assessment.referenceCode}</dd>
              </div>
              <div>
                <dt>Diabetes status</dt>
                <dd>{formatDiabetesStatus(diabetesStatus)}</dd>
              </div>
              <div>
                <dt>Classification</dt>
                <dd>{formatClassification(classification)}</dd>
              </div>
              <div>
                <dt>Clinical urgency</dt>
                <dd>{formatUrgency(urgency)}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{formatScore(assessment.result?.score)}</dd>
              </div>
              <div>
                <dt>Rule version</dt>
                <dd>
                  {assessment.result
                    ? `${formatBranch(branch)} v${assessment.result.scoringRuleVersion.versionNumber}`
                    : "Pending result"}
                </dd>
              </div>
              <div>
                <dt>Questionnaire</dt>
                <dd>{assessment.questionnaireVersion}</dd>
              </div>
              <div>
                <dt>Ruleset hash</dt>
                <dd className="monospace">{formatHash(assessment.result?.rulesetHash)}</dd>
              </div>
            </dl>
          </section>

          <section className="detailBlock">
            <h2>Score breakdown</h2>
            {factors.length === 0 ? (
              <p className="mutedText">No contributing factors were recorded.</p>
            ) : (
              <ul className="factorList">
                {factors.map((factor) => (
                  <li key={factor.id ?? factor.label}>
                    <span>{factor.label}</span>
                    <strong>{factor.points === undefined ? "Override" : `${factor.points} pts`}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="detailBlock responsesBlock">
          <h2>Full responses</h2>
          {assessment.anonymizedAt ? (
            <p className="mutedText">
              Responses were anonymised on {formatDateTime(assessment.anonymizedAt)} under the data
              retention policy. The clinical result above is retained.
            </p>
          ) : (
            <>
              <div className="responsesTableWrap">
                <table className="responsesTable">
                  <tbody>
                    {responseEntries(assessment.responses).map(([key, value]) => (
                      <tr key={key}>
                        <th scope="row">{formatResponseKey(key)}</th>
                        <td>{formatResponseValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="rawJsonBlock">
                <summary>Raw response JSON</summary>
                <pre>{JSON.stringify(assessment.responses, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function parseContributingFactors(value: unknown): ContributingFactor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("label" in item) || typeof item.label !== "string") {
      return [];
    }

    const points = "points" in item && typeof item.points === "number" ? item.points : undefined;
    const id = "id" in item && typeof item.id === "string" ? item.id : undefined;

    return [{ id, label: item.label, points }];
  });
}

function responseEntries(value: unknown): [string, unknown][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [["responses", value]];
  }

  return Object.entries(value);
}

function formatResponseKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatResponseValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map(formatResponseValue).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDiabetesStatus(status: DiabetesStatus) {
  return status === "diagnosed" ? "Diagnosed" : "Not diagnosed / not sure";
}

function formatClassification(classification: Classification | null) {
  if (!classification) {
    return "Pending result";
  }

  return classification
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatUrgency(urgency: ClinicalUrgency) {
  return urgency[0].toUpperCase() + urgency.slice(1);
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

function formatHash(hash: string | undefined) {
  if (!hash) {
    return "-";
  }

  return `${hash.slice(0, 16)}…`;
}
import Link from "next/link";
import { notFound } from "next/navigation";

import { NurseHeader } from "../../nurse-header";
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
import { complicationRiskRules } from "@/lib/scoring-rules";
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

const diagnosedResponseOrder = [
  "diabetesStatus",
  "foot_wound_or_ulcer",
  "chest_pain_or_shortness_of_breath",
  "hba1cControl",
  "diabetesDuration",
  "neuropathySymptoms",
  "medicationAdherence",
  "lastCheckup",
];

export const dynamic = "force-dynamic";

const urgencyCopy: Record<ClinicalUrgency, string | null> = {
  routine: null,
  urgent: "Red flags were reported. This person needs same-day clinical review.",
  emergency: "Emergency red flags were reported. This person was told to seek emergency care now.",
};

type AssessmentDetailRecord = NonNullable<Awaited<ReturnType<typeof getAssessmentDetailRecord>>>;

type SummaryItem = {
  label: string;
  value: string;
  tone?: ClinicalUrgency;
  monospace?: boolean;
};

type ScoreBreakdownItem = {
  id: string;
  label: string;
  points: number | null;
  override: Exclude<ClinicalUrgency, "routine"> | null;
};

type ResponseRow = {
  question: string;
  answer: string;
};

type AssessmentDetailView = {
  referenceCode: string;
  submittedAt: string;
  classification: string;
  isFlagged: boolean;
  urgency: ClinicalUrgency;
  urgencyMessage: string | null;
  redFlagLabels: string[];
  summary: SummaryItem[];
  scoreBreakdown: ScoreBreakdownItem[];
  responses: ResponseRow[];
  rawResponses: unknown;
  anonymizedAt: string | null;
  provenance: SummaryItem[];
  missingDesignFields: string[];
};

export default async function AssessmentDetailPage({ params }: AssessmentDetailPageProps) {
  const session = await requireNurseSession();
  const { id } = await params;
  const assessment = await getAssessmentDetailRecord(id);

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

  const detail = toAssessmentDetailView(assessment);

  return (
    <>
      <NurseHeader />
      <main className="pageShell dashboardShell">
        <section className="dashboardPanel">
          <Link className="dashboardBackLink" href="/dashboard">
            Back to all assessments
          </Link>

          <div className="detailHeader">
            <div>
              <p className="eyebrow">Assessment detail</p>
              <h1>{detail.classification}</h1>
            </div>
            <div className="detailHeaderMeta" aria-label="Assessment metadata">
              <div>
                <span>Reference</span>
                <strong className="monospace">{detail.referenceCode}</strong>
              </div>
              <div>
                <span>Submitted</span>
                <strong>{detail.submittedAt}</strong>
              </div>
              {detail.isFlagged ? (
                <span className="screeningBadge screeningBadge-flag" aria-label="Diabetes high-risk follow-up">
                  Flag
                </span>
              ) : null}
            </div>
          </div>

          {detail.urgencyMessage ? (
            <div className={`urgencyBanner urgencyBanner-${detail.urgency}`} role="alert">
              <span className="urgencyBannerIcon" aria-hidden="true">!</span>
              <div>
                <strong>{detail.urgency === "emergency" ? "Emergency" : "Urgent"}</strong>
                <p>{detail.urgencyMessage}</p>
              </div>
              {detail.redFlagLabels.length > 0 ? (
                <ul>
                  {detail.redFlagLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="assessmentDetailLayout">
            <div className="assessmentDetailMain">
              <section className="detailBlock summaryCard">
                <h2>Summary</h2>
                <dl className="summaryList">
                  {detail.summary.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd className={`${item.monospace ? "monospace" : ""} ${item.tone ? `summaryTone-${item.tone}` : ""}`}>
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="detailBlock">
                <h2>Score breakdown</h2>
                {detail.scoreBreakdown.length === 0 ? (
                  <p className="mutedText">No contributing factors were recorded.</p>
                ) : (
                  <ul className="factorList">
                    {detail.scoreBreakdown.map((factor) => (
                      <li key={factor.id}>
                        <span>{factor.label}</span>
                        {factor.override ? (
                          <strong className={`overridePill overridePill-${factor.override}`}>
                            {factor.override} override
                          </strong>
                        ) : (
                          <strong className="monospace">+{factor.points ?? 0}</strong>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="detailBlock responsesBlock">
                <h2>Full responses</h2>
                {detail.anonymizedAt ? (
                  <div className="anonymizedNotice">
                    <span className="anonymizedIcon" aria-hidden="true">Lock</span>
                    <div>
                      <strong>Responses anonymized</strong>
                      <p>
                        Individual answers for this assessment were removed under the data retention policy.
                        Classification, score and provenance are kept for reporting.
                      </p>
                      <small>Anonymized {detail.anonymizedAt}</small>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="responsesTableWrap">
                      <table className="responsesTable">
                        <thead>
                          <tr>
                            <th scope="col">Question</th>
                            <th scope="col">Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.responses.map((response) => (
                            <tr key={response.question}>
                              <th scope="row">{response.question}</th>
                              <td>{response.answer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <details className="rawJsonBlock">
                      <summary>Show raw JSON</summary>
                      <pre>{JSON.stringify(detail.rawResponses, null, 2)}</pre>
                    </details>
                  </>
                )}
              </section>
            </div>

            <aside className="detailBlock provenanceCard" aria-labelledby="provenance-heading">
              <h2 id="provenance-heading">Provenance</h2>
              <dl className="provenanceList">
                {detail.provenance.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd className={item.monospace ? "monospace" : undefined}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}

function getAssessmentDetailRecord(id: string) {
  return prisma.assessment.findUnique({
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
}

function toAssessmentDetailView(assessment: AssessmentDetailRecord): AssessmentDetailView {
  const diabetesStatus = fromPrismaDiabetesStatus(assessment.diabetesStatus);
  const classification = assessment.result ? fromPrismaClassification(assessment.result.classification) : null;
  const urgency = assessment.result ? fromPrismaUrgency(assessment.result.urgency) : "routine";
  const branch = assessment.result ? fromPrismaScoringBranch(assessment.result.scoringRuleVersion.branch) : null;
  const factors = parseContributingFactors(assessment.result?.contributingFactors);
  const redFlags = parseRedFlags(assessment.result?.redFlags);
  const scoreWasOverridden = redFlags.length > 0 || (assessment.result?.urgentCareRecommended ?? false);
  const scoreBreakdown = toScoreBreakdown(factors, redFlags, assessment.responses);

  return {
    referenceCode: assessment.referenceCode,
    submittedAt: formatDateTime(assessment.createdAt),
    classification: formatClassification(classification),
    isFlagged: diabetesStatus === "diagnosed" && classification === "diabetes_high",
    urgency,
    urgencyMessage: urgencyCopy[urgency],
    redFlagLabels: redFlags.map((redFlag) => redFlag.label),
    summary: [
      { label: "Diabetes status", value: formatDiabetesStatus(diabetesStatus) },
      { label: "Classification", value: formatClassification(classification) },
      { label: "Clinical urgency", value: formatUrgency(urgency), tone: urgency },
      { label: "Score", value: formatScore(assessment.result?.score, scoreWasOverridden, scoreBreakdown), monospace: true },
      { label: "Reference", value: assessment.referenceCode, monospace: true },
    ],
    scoreBreakdown,
    responses: toResponseRows(assessment.responses),
    rawResponses: assessment.responses,
    anonymizedAt: assessment.anonymizedAt ? formatDateTime(assessment.anonymizedAt) : null,
    provenance: [
      {
        label: "Rule version",
        value: assessment.result
          ? `${formatBranch(branch)} v${assessment.result.scoringRuleVersion.versionNumber}`
          : "Pending result",
      },
      { label: "Questionnaire version", value: assessment.questionnaireVersion, monospace: true },
      { label: "Ruleset hash", value: assessment.result?.rulesetHash ?? "-", monospace: true },
    ],
    missingDesignFields: [
      "The overridden numeric score shown in the mockup is not stored; red-flag overrides currently persist score as null.",
      "A semantic rule version such as v2.3 is not stored; the database stores branch plus integer versionNumber.",
    ],
  };
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

function parseRedFlags(value: unknown): (ContributingFactor & { urgency: Exclude<ClinicalUrgency, "routine"> })[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("label" in item) || typeof item.label !== "string") {
      return [];
    }

    const urgency = "urgency" in item && (item.urgency === "urgent" || item.urgency === "emergency")
      ? item.urgency
      : null;

    if (!urgency) {
      return [];
    }

    const id = "id" in item && typeof item.id === "string" ? item.id : item.label;

    return [{ id, label: item.label, urgency }];
  });
}

function toScoreBreakdown(
  factors: ContributingFactor[],
  redFlags: (ContributingFactor & { urgency: Exclude<ClinicalUrgency, "routine"> })[],
  responses: unknown,
): ScoreBreakdownItem[] {
  const redFlagRows = redFlags.map((redFlag) => ({
    id: redFlag.id,
    label: displayFactorLabel(redFlag.id, redFlag.label),
    points: null,
    override: redFlag.urgency,
  }));

  const storedFactorRows = factors
    .filter((factor) => !redFlags.some((redFlag) => redFlag.id === factor.id))
    .map((factor) => ({
      id: factor.id ?? factor.label,
      label: displayFactorLabel(factor.id, factor.label),
      points: factor.points ?? null,
      override: null,
    }));

  const responseFactorRows = redFlags.length > 0
    ? complicationDisplayFactorsFromResponses(responses)
    : [];
  const existingIds = new Set([...redFlagRows, ...storedFactorRows].map((factor) => factor.id));
  const additionalRows = responseFactorRows.filter((factor) => !existingIds.has(factor.id));

  return [...redFlagRows, ...storedFactorRows, ...additionalRows];
}

function complicationDisplayFactorsFromResponses(value: unknown): ScoreBreakdownItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const responses = value as Record<string, unknown>;
  const factorRows: ScoreBreakdownItem[] = [];
  const addChoiceFactor = (
    id: keyof typeof complicationRiskRules.choiceRules,
    rule: { label: string; points: number } | null,
  ) => {

    if (rule?.points) {
      factorRows.push({ id, label: displayFactorLabel(id, rule.label), points: rule.points, override: null });
    }
  };
  const addBooleanFactor = (
    id: keyof typeof complicationRiskRules.booleanRules,
    responseKey: string,
    appliesWhen: boolean,
  ) => {
    const response = responses[responseKey];
    const rule = complicationRiskRules.booleanRules[id];

    if (response === appliesWhen && rule.points) {
      factorRows.push({ id, label: displayFactorLabel(id, rule.label), points: rule.points, override: null });
    }
  };

  addChoiceFactor("hba1c_control", lookupChoiceRule(complicationRiskRules.choiceRules.hba1c_control, responses.hba1cControl));
  addChoiceFactor("glucose_episodes", lookupChoiceRule(complicationRiskRules.choiceRules.glucose_episodes, responses.glucoseEpisodeFrequency));
  addChoiceFactor("diabetes_duration", lookupChoiceRule(complicationRiskRules.choiceRules.diabetes_duration, responses.diabetesDuration));
  addChoiceFactor("blood_pressure_control", lookupChoiceRule(complicationRiskRules.choiceRules.blood_pressure_control, responses.bloodPressureControl));
  addChoiceFactor("smoking_status", lookupChoiceRule(complicationRiskRules.choiceRules.smoking_status, responses.smokingStatus));
  addBooleanFactor("neuropathy_symptoms", "neuropathySymptoms", true);
  addBooleanFactor("retinopathy_symptoms", "retinopathySymptoms", true);
  addBooleanFactor("nephropathy_signals", "nephropathySignals", true);
  addBooleanFactor("medication_adherence", "medicationAdherence", false);
  addChoiceFactor("last_checkup", lookupChoiceRule(complicationRiskRules.choiceRules.last_checkup, responses.lastCheckup));

  return factorRows;
}

function lookupChoiceRule<T extends Record<string, { label: string; points: number }>>(
  rules: T,
  value: unknown,
) {
  if (typeof value !== "string" || !Object.hasOwn(rules, value)) {
    return null;
  }

  return rules[value as keyof T];
}

function toResponseRows(value: unknown): ResponseRow[] {
  const entries = responseEntries(value);
  const orderedEntries: [string, unknown][] = entries.some(([key]) => diagnosedResponseOrder.includes(key))
    ? diagnosedResponseOrder.reduce<[string, unknown][]>((ordered, key) => {
        const entry = entries.find(([entryKey]) => entryKey === key);

        return entry ? [...ordered, entry] : ordered;
      }, [])
    : entries;

  return orderedEntries.map(([key, response]) => ({
    question: responseQuestionLabels[key] ?? formatResponseKey(key),
    answer: formatResponseValue(key, response),
  }));
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

const responseQuestionLabels: Record<string, string> = {
  diabetesStatus: "Do you already have diabetes?",
  age: "Age",
  heightCm: "Height",
  weightKg: "Weight",
  sex: "Sex",
  waistCircumferenceCm: "Waist circumference",
  dailyPhysicalActivity: "Daily physical activity",
  dailyFruitOrVegetableIntake: "Daily fruit or vegetable intake",
  historyOfBloodPressureMedication: "History of blood pressure medication",
  historyOfHighBloodGlucose: "History of high blood glucose",
  familyHistory: "Family history of diabetes",
  foot_wound_or_ulcer: "Foot wound not healing",
  sudden_vision_loss_or_blurring: "Sudden vision loss or blurry vision",
  ketoacidosis_symptoms: "Nausea, vomiting, fast breathing or confusion",
  chest_pain_or_shortness_of_breath: "Chest pain or trouble breathing",
  hba1cControl: "Most recent HbA1c",
  glucoseEpisodeFrequency: "Low or high glucose episodes",
  diabetesDuration: "How long you have had diabetes",
  bloodPressureControl: "Blood pressure control",
  smokingStatus: "Smoking status",
  neuropathySymptoms: "Numb or tingling feet",
  retinopathySymptoms: "Eye symptoms",
  nephropathySignals: "Kidney warning signs",
  medicationAdherence: "Medicine taken as prescribed",
  lastCheckup: "Last diabetes check-up",
};

const responseValueLabels: Record<string, Record<string, string>> = {
  diabetesStatus: {
    diagnosed: "Yes, I have diabetes",
    not_diagnosed: "No / not sure",
  },
  sex: {
    male: "Male",
    female: "Female",
  },
  waistCircumferenceCm: {
    unknown: "Not sure",
  },
  familyHistory: {
    none: "No family history",
    extended: "Grandparent, aunt, uncle or cousin",
    immediate: "Parent, sibling or child",
  },
  hba1cControl: {
    known_good: "Below 9%",
    known_elevated: "Above 9%",
    unknown: "I do not know",
  },
  glucoseEpisodeFrequency: {
    rare: "Rarely",
    monthly: "Monthly",
    weekly_or_more: "Weekly or more",
  },
  diabetesDuration: {
    under_5_years: "Under 5 years",
    "5_to_10_years": "5 to 10 years",
    over_10_years: "More than 10 years",
  },
  bloodPressureControl: {
    controlled: "Controlled",
    uncontrolled: "High or uncontrolled",
    unknown: "I do not know",
  },
  smokingStatus: {
    non_smoker: "Non-smoker",
    former_smoker: "Former smoker",
    current_smoker: "Current smoker",
  },
  lastCheckup: {
    within_12_months: "Within 12 months",
    over_12_months: "More than 12 months ago",
  },
};

function formatResponseValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && responseValueLabels[key]?.[value]) {
    return responseValueLabels[key][value];
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatResponseValue(key, item)).join(", ");
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

function formatDiabetesStatus(status: DiabetesStatus) {
  return status === "diagnosed" ? "Diagnosed" : "Not diagnosed / not sure";
}

function formatClassification(classification: Classification | null) {
  if (!classification) {
    return "Pending result";
  }

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

function displayFactorLabel(id: string | undefined, fallback: string) {
  switch (id) {
    case "foot_wound_or_ulcer":
      return "Foot wound not healing";
    case "chest_pain_or_shortness_of_breath":
      return "Chest pain or trouble breathing";
    case "hba1c_control":
      return "HbA1c above 9%";
    case "neuropathy_symptoms":
      return "Numb or tingling feet";
    case "diabetes_duration":
      return "Diabetes for more than 10 years";
    case "medication_adherence":
      return "Misses medicine most weeks";
    default:
      return fallback;
  }
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

function formatScore(score: unknown, overridden: boolean, breakdown: ScoreBreakdownItem[] = []) {
  if (score === null || score === undefined) {
    const derivedScore = breakdown.reduce((total, factor) => total + (factor.override ? 0 : factor.points ?? 0), 0);

    return overridden && derivedScore > 0 ? `${derivedScore} · overridden` : overridden ? "Override" : "-";
  }

  const formattedScore = Number(score).toString();

  return overridden ? `${formattedScore} · overridden` : formattedScore;
}
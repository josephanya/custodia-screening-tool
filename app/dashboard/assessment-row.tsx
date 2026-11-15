"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

import type { ClinicalUrgency } from "@/lib/scoring";

type AssessmentRowProps = {
  classification: string;
  diabetesStatus: string;
  flagged: boolean;
  href: string;
  referenceCode: string;
  ruleVersion: string;
  score: string;
  submittedAt: string;
  urgency: ClinicalUrgency;
};

const urgencyLabels: Record<ClinicalUrgency, string> = {
  routine: "Routine",
  urgent: "URGENT",
  emergency: "EMERGENCY",
};

const noValue = "—";

export function AssessmentRow({
  classification,
  diabetesStatus,
  flagged,
  href,
  referenceCode,
  ruleVersion,
  score,
  submittedAt,
  urgency,
}: AssessmentRowProps) {
  const router = useRouter();

  function openAssessment() {
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAssessment();
    }
  }

  const rowLabel = [urgencyLabels[urgency], flagged ? "flagged" : null, classification, referenceCode]
    .filter(Boolean)
    .join(", ");

  return (
    <tr
      className={`assessmentTableRow urgencyRow-${urgency} clickableRow`}
      onClick={openAssessment}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Open assessment: ${rowLabel}. Submitted ${submittedAt}`}
    >
      <td>
        {flagged ? (
          <span className="flagBadge" aria-label="Diabetes high-risk follow-up">
            FLAG
          </span>
        ) : (
          <span className="mutedText">{noValue}</span>
        )}
      </td>
      <td>
        {urgency === "routine" ? (
          <span className="routineText">Routine</span>
        ) : (
          <span className={`urgencyBadge urgencyBadge-${urgency}`}>{urgencyLabels[urgency]}</span>
        )}
      </td>
      <td>
        <span className="mutedText numericText">{submittedAt}</span>
      </td>
      <td className="monospace queueReference">{referenceCode}</td>
      <td className="mutedText">{diabetesStatus}</td>
      <td className="queueClassification">{classification}</td>
      <td className="numericText queueScore">{score}</td>
      <td className="numericText mutedText">{ruleVersion}</td>
      <td className="rowChevron" aria-hidden="true">
        ›
      </td>
    </tr>
  );
}

export function AssessmentCard({
  classification,
  diabetesStatus,
  flagged,
  href,
  referenceCode,
  score,
  submittedAt,
  urgency,
}: AssessmentRowProps) {
  return (
    <a
      className={`assessmentCard urgencyCard-${urgency}`}
      href={href}
      aria-label={`Open assessment ${referenceCode} submitted ${submittedAt}`}
    >
      <span className="assessmentCardTopline">
        <span className="assessmentCardBadges">
          {urgency === "routine" ? (
            <span className="routineText">Routine</span>
          ) : (
            <span className={`urgencyBadge urgencyBadge-${urgency}`}>{urgencyLabels[urgency]}</span>
          )}
          {flagged ? <span className="flagBadge">FLAG</span> : null}
        </span>
        <span className="mutedText numericText">{submittedAt}</span>
      </span>
      <span className="assessmentCardTitle">{classification}</span>
      <span className="assessmentCardMeta">
        <span className="monospace queueReference">{referenceCode}</span>
        <span className="mutedText">
          {diabetesStatus} · {score}
        </span>
      </span>
    </a>
  );
}
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
  urgent: "Urgent",
  emergency: "Emergency",
};

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

  return (
    <tr
      className={`${flagged ? "flaggedRow" : ""} ${urgency !== "routine" ? "urgentRow" : ""} clickableRow`}
      onClick={openAssessment}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Open assessment ${referenceCode} submitted ${submittedAt}`}
    >
      <td>
        {flagged ? (
          <span className="flagBadge" aria-label="Diabetes high-risk follow-up">
            FLAG
          </span>
        ) : (
          <span className="mutedText">-</span>
        )}
      </td>
      <td>
        {urgency === "routine" ? (
          <span className="mutedText">-</span>
        ) : (
          <span className={`urgencyBadge urgencyBadge-${urgency}`}>{urgencyLabels[urgency]}</span>
        )}
      </td>
      <td>
        <span className="rowLinkText">{submittedAt}</span>
      </td>
      <td>{referenceCode}</td>
      <td>{diabetesStatus}</td>
      <td>{classification}</td>
      <td>{score}</td>
      <td>{ruleVersion}</td>
    </tr>
  );
}
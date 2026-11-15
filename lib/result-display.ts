import type { Classification, ClinicalUrgency } from "@/lib/scoring";

export const nonDiagnosticDisclaimer = "This tool does not diagnose. It estimates risk based on your answers.";

export type ResultContent = {
  actionLabel?: string;
  eyebrow: string;
  summary: string;
  tips: string[];
  title: string;
};

export type ResultDisplayState = {
  factorTitle: "Why this result appeared" | "Why you're seeing this";
  isEmergencyOverride: boolean;
  isHigherOutcome: boolean;
  isOverride: boolean;
  isUrgentOverride: boolean;
  referenceLabel: "Your reference code" | "Show this code to staff";
  showFactorCard: boolean;
  showNurseHandoff: boolean;
  showReferenceBox: boolean;
  showSummaryCard: boolean;
  showTips: boolean;
};

export const urgencyContent: Record<ClinicalUrgency, string | null> = {
  routine: null,
  urgent: "Some of your answers need clinical attention today. Please contact a clinic or nurse now.",
  emergency: "Your answers describe an emergency. Go to the nearest emergency department now.",
};

export const emergencySecondaryCopy = "If you can't get there safely, ask someone to take you or call emergency services.";

export function buildNurseWhatsAppLink(classification: Classification, referenceCode: string): string | null {
  if (classification !== "diabetes_high") {
    return null;
  }

  const normalizedNumber = process.env.NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER?.replace(/\D/g, "");

  if (!normalizedNumber) {
    return null;
  }

  const handoffMessage = `Hello, my screening reference is ${referenceCode}`;

  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(handoffMessage)}`;
}

export function getResultDisplayState({
  classification,
  contributingFactorCount,
  urgency,
}: {
  classification: Classification;
  contributingFactorCount: number;
  urgency: ClinicalUrgency;
}): ResultDisplayState {
  const isOverride = urgency !== "routine";
  const isEmergencyOverride = urgency === "emergency";
  const isUrgentOverride = urgency === "urgent";
  const isHigherOutcome = classification === "no_diabetes_high" || classification === "diabetes_high";
  const showNurseHandoff = classification === "diabetes_high" && !isOverride;

  return {
    factorTitle: isEmergencyOverride ? "Why you're seeing this" : "Why this result appeared",
    isEmergencyOverride,
    isHigherOutcome,
    isOverride,
    isUrgentOverride,
    referenceLabel: isEmergencyOverride ? "Show this code to staff" : "Your reference code",
    showFactorCard: isHigherOutcome && contributingFactorCount > 0,
    showNurseHandoff,
    showReferenceBox: !showNurseHandoff,
    showSummaryCard: !isEmergencyOverride,
    showTips: !isOverride,
  };
}

export const resultContent: Record<Classification, ResultContent> = {
  no_diabetes_low: {
    eyebrow: "Lower diabetes risk",
    title: "Your answers suggest a lower risk right now",
    summary: "That's good news. Small daily habits help keep it that way.",
    tips: [
      "Eat healthy meals with plenty of vegetables.",
      "Aim for at least 30 minutes of activity most days.",
      "Keep to a healthy weight.",
      "Screen again in a year, or sooner if things change.",
    ],
  },
  no_diabetes_high: {
    eyebrow: "Higher diabetes risk",
    title: "Please arrange clinical screening",
    summary:
      "Your answers suggest an elevated risk of diabetes. A hospital, clinic or pharmacy can check your blood glucose with a quick test.",
    actionLabel: "Plan a clinical screening visit →",
    tips: [
      "Ask for a blood glucose or HbA1c test in the next few weeks.",
      "Bring your reference code so staff can see this screening.",
    ],
  },
  diabetes_low: {
    eyebrow: "Lower complication risk",
    title: "Your answers suggest lower complication risk right now",
    summary: "Keep up your routine care. It protects you over the long term.",
    tips: [
      "Keep taking your medication as prescribed.",
      "Check your blood glucose as your care plan says.",
      "Protect your feet, eyes, kidneys and blood pressure with regular check-ups.",
      "Keep meals steady and stay active.",
    ],
  },
  diabetes_high: {
    eyebrow: "Higher complication risk",
    title: "Your answers suggest higher complication risk",
    summary:
      "You may need timely support for diabetes-related symptoms or possible complications. A nurse can help you decide what to do next.",
    actionLabel: "Chat with a nurse on WhatsApp",
    tips: ["Message a nurse today with your reference code.", "Keep taking your medication as prescribed."],
  },
};

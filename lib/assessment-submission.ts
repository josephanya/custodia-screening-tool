import type {
  Prisma,
} from "@/lib/generated/prisma/client";
import { redFlagIds } from "@/lib/scoring";
import type {
  BloodPressureControl,
  CheckupRecency,
  DiabetesDuration,
  DiagnosedScoringInput,
  EpisodeFrequency,
  FamilyHistory,
  HbA1cControl,
  NotDiagnosedScoringInput,
  RedFlagId,
  ScoringBranch,
  ScoringInput,
  Sex,
  SmokingStatus,
} from "@/lib/scoring";

type ValidationSuccess = {
  ok: true;
  input: ScoringInput;
  branch: ScoringBranch;
  responses: Prisma.InputJsonValue;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

export type AssessmentSubmissionValidation = ValidationSuccess | ValidationFailure;

type PlausibleRange = { min: number; max: number };

const plausibleRanges = {
  age: { min: 1, max: 120 },
  heightCm: { min: 50, max: 250 },
  weightKg: { min: 10, max: 400 },
  waistCircumferenceCm: { min: 30, max: 250 },
} satisfies Record<string, PlausibleRange>;

const sexes = ["male", "female"] as const;
const familyHistories = ["none", "extended", "immediate"] as const;
const hba1cControls = ["known_good", "known_elevated", "unknown"] as const;
const episodeFrequencies = ["rare", "monthly", "weekly_or_more"] as const;
const diabetesDurations = ["under_5_years", "5_to_10_years", "over_10_years"] as const;
const bloodPressureControls = ["controlled", "uncontrolled", "unknown"] as const;
const smokingStatuses = ["non_smoker", "former_smoker", "current_smoker"] as const;
const checkupRecencies = ["within_12_months", "over_12_months"] as const;

export function validateAssessmentSubmission(payload: unknown): AssessmentSubmissionValidation {
  if (!isRecord(payload)) {
    return { ok: false, errors: ["Submission must be an object."] };
  }

  const diabetesStatus = payload.diabetesStatus;
  const responses = payload.responses;

  if (diabetesStatus !== "diagnosed" && diabetesStatus !== "not_diagnosed") {
    return { ok: false, errors: ["diabetesStatus must be diagnosed or not_diagnosed."] };
  }

  if (!isRecord(responses)) {
    return { ok: false, errors: ["responses must be an object."] };
  }

  if (diabetesStatus === "not_diagnosed") {
    return validateNotDiagnosedResponses(responses);
  }

  return validateDiagnosedResponses(responses);
}

function validateNotDiagnosedResponses(responses: Record<string, unknown>): AssessmentSubmissionValidation {
  const errors: string[] = [];
  const waistCircumferenceCm = readWaistCircumference(responses, errors);
  const input: NotDiagnosedScoringInput = {
    diabetesStatus: "not_diagnosed",
    age: readNumber(responses, "age", plausibleRanges.age, errors),
    heightCm: readNumber(responses, "heightCm", plausibleRanges.heightCm, errors),
    weightKg: readNumber(responses, "weightKg", plausibleRanges.weightKg, errors),
    sex: readEnum(responses, "sex", sexes, errors) as Sex,
    waistCircumferenceCm,
    dailyPhysicalActivity: readBoolean(responses, "dailyPhysicalActivity", errors),
    dailyFruitOrVegetableIntake: readBoolean(responses, "dailyFruitOrVegetableIntake", errors),
    historyOfBloodPressureMedication: readBoolean(
      responses,
      "historyOfBloodPressureMedication",
      errors,
    ),
    historyOfHighBloodGlucose: readBoolean(responses, "historyOfHighBloodGlucose", errors),
    familyHistory: readEnum(responses, "familyHistory", familyHistories, errors) as FamilyHistory,
  };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    branch: "risk_of_diabetes",
    input,
    responses: normalizeResponses(input),
  };
}

function validateDiagnosedResponses(responses: Record<string, unknown>): AssessmentSubmissionValidation {
  const errors: string[] = [];
  const redFlags = redFlagIds.reduce(
    (flags, id) => ({ ...flags, [id]: readBoolean(responses, id, errors) }),
    {} as Record<RedFlagId, boolean>,
  );
  const input: DiagnosedScoringInput = {
    diabetesStatus: "diagnosed",
    redFlags,
    hba1cControl: readEnum(responses, "hba1cControl", hba1cControls, errors) as HbA1cControl,
    glucoseEpisodeFrequency: readEnum(
      responses,
      "glucoseEpisodeFrequency",
      episodeFrequencies,
      errors,
    ) as EpisodeFrequency,
    diabetesDuration: readEnum(
      responses,
      "diabetesDuration",
      diabetesDurations,
      errors,
    ) as DiabetesDuration,
    bloodPressureControl: readEnum(
      responses,
      "bloodPressureControl",
      bloodPressureControls,
      errors,
    ) as BloodPressureControl,
    smokingStatus: readEnum(responses, "smokingStatus", smokingStatuses, errors) as SmokingStatus,
    neuropathySymptoms: readBoolean(responses, "neuropathySymptoms", errors),
    retinopathySymptoms: readBoolean(responses, "retinopathySymptoms", errors),
    nephropathySignals: readBoolean(responses, "nephropathySignals", errors),
    medicationAdherence: readBoolean(responses, "medicationAdherence", errors),
    lastCheckup: readEnum(responses, "lastCheckup", checkupRecencies, errors) as CheckupRecency,
  };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    branch: "complication_risk",
    input,
    responses: normalizeResponses(input),
  };
}

function readNumber(
  responses: Record<string, unknown>,
  key: string,
  range: PlausibleRange,
  errors: string[],
): number {
  const value = responses[key];
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < range.min || numberValue > range.max) {
    errors.push(`${key} is required and must be between ${range.min} and ${range.max}.`);
    return range.min;
  }

  return numberValue;
}

function readBoolean(responses: Record<string, unknown>, key: string, errors: string[]): boolean {
  const value = responses[key];

  if (typeof value !== "boolean") {
    errors.push(`${key} is required.`);
    return false;
  }

  return value;
}

function readEnum<T extends readonly string[]>(
  responses: Record<string, unknown>,
  key: string,
  allowedValues: T,
  errors: string[],
): T[number] | "" {
  const value = responses[key];

  if (typeof value === "string" && allowedValues.includes(value)) {
    return value;
  }

  errors.push(`${key} is required.`);
  return "";
}

function readWaistCircumference(
  responses: Record<string, unknown>,
  errors: string[],
): number | "unknown" {
  const value = responses.waistCircumferenceCm;

  if (value === "unknown") {
    return "unknown";
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  const range = plausibleRanges.waistCircumferenceCm;

  if (!Number.isFinite(numberValue) || numberValue < range.min || numberValue > range.max) {
    errors.push(
      `waistCircumferenceCm is required and must be between ${range.min} and ${range.max}, or unknown.`,
    );
    return "unknown";
  }

  return numberValue;
}

function normalizeResponses(input: ScoringInput): Prisma.InputJsonValue {
  if (input.diabetesStatus === "not_diagnosed") {
    return { ...input };
  }

  return {
    diabetesStatus: input.diabetesStatus,
    ...input.redFlags,
    hba1cControl: input.hba1cControl,
    glucoseEpisodeFrequency: input.glucoseEpisodeFrequency,
    diabetesDuration: input.diabetesDuration,
    bloodPressureControl: input.bloodPressureControl,
    smokingStatus: input.smokingStatus,
    neuropathySymptoms: input.neuropathySymptoms,
    retinopathySymptoms: input.retinopathySymptoms,
    nephropathySignals: input.nephropathySignals,
    medicationAdherence: input.medicationAdherence,
    lastCheckup: input.lastCheckup,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
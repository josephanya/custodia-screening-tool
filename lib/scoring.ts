import {
  complicationRiskRules,
  QUESTIONNAIRE_VERSION,
  riskOfDiabetesRules,
  SCORING_ENGINE_VERSION,
  type BooleanRule,
  type ChoiceRule,
  type ClinicalUrgency,
  type NumericBand,
} from "./scoring-rules";

export type DiabetesStatus = "diagnosed" | "not_diagnosed";

export type ScoringBranch = "risk_of_diabetes" | "complication_risk";

export type Classification =
  | "no_diabetes_low"
  | "no_diabetes_high"
  | "diabetes_low"
  | "diabetes_high";

export type Sex = "male" | "female";

export type FamilyHistory = "none" | "extended" | "immediate";

export type HbA1cControl = "known_good" | "known_elevated" | "unknown";

export type EpisodeFrequency = "rare" | "monthly" | "weekly_or_more";

export type DiabetesDuration = "under_5_years" | "5_to_10_years" | "over_10_years";

export type BloodPressureControl = "controlled" | "uncontrolled" | "unknown";

export type SmokingStatus = "non_smoker" | "former_smoker" | "current_smoker";

export type CheckupRecency = "within_12_months" | "over_12_months";

export type RedFlagId =
  | "foot_wound_or_ulcer"
  | "sudden_vision_loss_or_blurring"
  | "ketoacidosis_symptoms"
  | "chest_pain_or_shortness_of_breath";

export type { ClinicalUrgency };

export type ContributingFactor = {
  id: string;
  label: string;
  points?: number;
};

export type RedFlagFactor = ContributingFactor & {
  urgency: Exclude<ClinicalUrgency, "routine">;
};

export type NotDiagnosedScoringInput = {
  diabetesStatus: "not_diagnosed";
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  waistCircumferenceCm: number | "unknown";
  dailyPhysicalActivity: boolean;
  dailyFruitOrVegetableIntake: boolean;
  historyOfBloodPressureMedication: boolean;
  historyOfHighBloodGlucose: boolean;
  familyHistory: FamilyHistory;
};

export type DiagnosedScoringInput = {
  diabetesStatus: "diagnosed";
  redFlags: Record<RedFlagId, boolean>;
  hba1cControl: HbA1cControl;
  glucoseEpisodeFrequency: EpisodeFrequency;
  diabetesDuration: DiabetesDuration;
  bloodPressureControl: BloodPressureControl;
  smokingStatus: SmokingStatus;
  neuropathySymptoms: boolean;
  retinopathySymptoms: boolean;
  nephropathySignals: boolean;
  medicationAdherence: boolean;
  lastCheckup: CheckupRecency;
};

export type ScoringInput = NotDiagnosedScoringInput | DiagnosedScoringInput;

export type ScoringResult = {
  branch: ScoringBranch;
  ruleVersion: number;
  questionnaireVersion: string;
  engineVersion: string;
  classification: Classification;
  score: number | null;
  contributingFactors: ContributingFactor[];
  redFlags: RedFlagFactor[];
  urgency: ClinicalUrgency;
  urgentCareRecommended: boolean;
};

export const scoringRuleVersions: Record<ScoringBranch, number> = {
  risk_of_diabetes: riskOfDiabetesRules.versionNumber,
  complication_risk: complicationRiskRules.versionNumber,
};

export const redFlagIds: RedFlagId[] = Object.keys(
  complicationRiskRules.redFlags,
) as RedFlagId[];

export function scoreAssessment(input: ScoringInput): ScoringResult {
  if (input.diabetesStatus === "not_diagnosed") {
    return scoreRiskOfDiabetes(input);
  }

  return scoreComplicationRisk(input);
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0) {
    throw new Error("heightCm must be greater than 0");
  }

  if (weightKg <= 0) {
    throw new Error("weightKg must be greater than 0");
  }

  const heightMeters = heightCm / 100;

  return weightKg / heightMeters ** 2;
}

function scoreRiskOfDiabetes(input: NotDiagnosedScoringInput): ScoringResult {
  const rules = riskOfDiabetesRules;
  const bmi = calculateBmi(input.heightCm, input.weightKg);
  const factors: ContributingFactor[] = [
    bandFactor("age", rules.bands.age, input.age),
    bandFactor("bmi", rules.bands.bmi, bmi),
    waistCircumferenceFactor(input.sex, input.waistCircumferenceCm),
    booleanFactor("daily_physical_activity", rules.booleanRules.daily_physical_activity, input.dailyPhysicalActivity),
    booleanFactor(
      "daily_fruit_or_vegetable_intake",
      rules.booleanRules.daily_fruit_or_vegetable_intake,
      input.dailyFruitOrVegetableIntake,
    ),
    booleanFactor(
      "blood_pressure_medication",
      rules.booleanRules.blood_pressure_medication,
      input.historyOfBloodPressureMedication,
    ),
    booleanFactor("high_blood_glucose", rules.booleanRules.high_blood_glucose, input.historyOfHighBloodGlucose),
    choiceFactor("family_history", rules.choiceRules.family_history, input.familyHistory),
  ];
  const score = totalPoints(factors);
  const isHighRisk = score >= rules.highRiskCutoff;

  return {
    branch: "risk_of_diabetes",
    ruleVersion: rules.versionNumber,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    engineVersion: SCORING_ENGINE_VERSION,
    classification: isHighRisk ? rules.classifications.atOrAboveCutoff : rules.classifications.belowCutoff,
    score,
    contributingFactors: applicableFactors(factors),
    redFlags: [],
    urgency: "routine",
    urgentCareRecommended: false,
  };
}

function scoreComplicationRisk(input: DiagnosedScoringInput): ScoringResult {
  const rules = complicationRiskRules;
  const redFlags = redFlagIds
    .filter((id) => input.redFlags[id])
    .map((id) => ({
      id,
      label: rules.redFlags[id].label,
      urgency: rules.redFlags[id].urgency,
    }));

  if (redFlags.length > 0) {
    const urgency = highestUrgency(redFlags.map((redFlag) => redFlag.urgency));

    return {
      branch: "complication_risk",
      ruleVersion: rules.versionNumber,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      engineVersion: SCORING_ENGINE_VERSION,
      classification: rules.classifications.atOrAboveCutoff,
      score: null,
      contributingFactors: redFlags.map(({ id, label }) => ({ id, label })),
      redFlags,
      urgency,
      urgentCareRecommended: true,
    };
  }

  const factors: ContributingFactor[] = [
    choiceFactor("hba1c_control", rules.choiceRules.hba1c_control, input.hba1cControl),
    choiceFactor("glucose_episodes", rules.choiceRules.glucose_episodes, input.glucoseEpisodeFrequency),
    choiceFactor("diabetes_duration", rules.choiceRules.diabetes_duration, input.diabetesDuration),
    choiceFactor("blood_pressure_control", rules.choiceRules.blood_pressure_control, input.bloodPressureControl),
    choiceFactor("smoking_status", rules.choiceRules.smoking_status, input.smokingStatus),
    booleanFactor("neuropathy_symptoms", rules.booleanRules.neuropathy_symptoms, input.neuropathySymptoms),
    booleanFactor("retinopathy_symptoms", rules.booleanRules.retinopathy_symptoms, input.retinopathySymptoms),
    booleanFactor("nephropathy_signals", rules.booleanRules.nephropathy_signals, input.nephropathySignals),
    booleanFactor("medication_adherence", rules.booleanRules.medication_adherence, input.medicationAdherence),
    choiceFactor("last_checkup", rules.choiceRules.last_checkup, input.lastCheckup),
  ];
  const score = totalPoints(factors);
  const isHighRisk = score >= rules.highRiskCutoff;

  return {
    branch: "complication_risk",
    ruleVersion: rules.versionNumber,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    engineVersion: SCORING_ENGINE_VERSION,
    classification: isHighRisk ? rules.classifications.atOrAboveCutoff : rules.classifications.belowCutoff,
    score,
    contributingFactors: applicableFactors(factors),
    redFlags: [],
    urgency: "routine",
    urgentCareRecommended: false,
  };
}

function waistCircumferenceFactor(
  sex: Sex,
  waistCircumferenceCm: number | "unknown",
): ContributingFactor {
  if (waistCircumferenceCm === "unknown") {
    const unknownAnswer = riskOfDiabetesRules.unknownAnswers.waist_circumference;

    return { id: "waist_circumference", label: unknownAnswer.label, points: unknownAnswer.points };
  }

  const bands =
    sex === "male"
      ? riskOfDiabetesRules.bands.waistCircumferenceMale
      : riskOfDiabetesRules.bands.waistCircumferenceFemale;

  return bandFactor("waist_circumference", bands, waistCircumferenceCm);
}

function bandFactor(id: string, bands: readonly NumericBand[], value: number): ContributingFactor {
  for (const band of bands) {
    if (band.lt !== undefined) {
      if (value < band.lt) {
        return { id, label: band.label, points: band.points };
      }

      continue;
    }

    if (band.lte !== undefined) {
      if (value <= band.lte) {
        return { id, label: band.label, points: band.points };
      }

      continue;
    }

    return { id, label: band.label, points: band.points };
  }

  throw new Error(`No band matched value ${value} for rule ${id}`);
}

function booleanFactor(id: string, rule: BooleanRule, answer: boolean): ContributingFactor {
  return { id, label: rule.label, points: answer === rule.appliesWhen ? rule.points : 0 };
}

function choiceFactor(id: string, rule: ChoiceRule, answer: string): ContributingFactor {
  const choice = rule[answer];

  if (!choice) {
    throw new Error(`Unknown answer "${answer}" for rule ${id}`);
  }

  return { id, label: choice.label, points: choice.points };
}

function highestUrgency(urgencies: Exclude<ClinicalUrgency, "routine">[]) {
  return urgencies.includes("emergency") ? "emergency" : "urgent";
}

function totalPoints(factors: ContributingFactor[]): number {
  return factors.reduce((score, factor) => score + (factor.points ?? 0), 0);
}

function applicableFactors(factors: ContributingFactor[]): ContributingFactor[] {
  return factors.filter((factor) => (factor.points ?? 0) > 0);
}

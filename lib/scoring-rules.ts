export const QUESTIONNAIRE_VERSION = "2026-08-01";

export const SCORING_ENGINE_VERSION = "1.0.0";

export type ClinicalUrgency = "routine" | "urgent" | "emergency";

export type NumericBand = {
  label: string;
  lt?: number;
  lte?: number;
  points: number;
};

export type BooleanRule = {
  label: string;
  appliesWhen: boolean;
  points: number;
};

export type ChoiceRule = Record<string, { label: string; points: number }>;

export type RedFlagRule = {
  label: string;
  urgency: Exclude<ClinicalUrgency, "routine">;
};

export const riskOfDiabetesRules = {
  branch: "risk_of_diabetes",
  versionNumber: 1,
  source: "FINDRISC",
  questionnaireVersion: QUESTIONNAIRE_VERSION,
  engineVersion: SCORING_ENGINE_VERSION,
  highRiskCutoff: 12,
  classifications: {
    belowCutoff: "no_diabetes_low",
    atOrAboveCutoff: "no_diabetes_high",
  },
  derivedFields: {
    bmi: {
      formula: "weightKg / (heightCm / 100) ** 2",
      inputs: ["heightCm", "weightKg"],
    },
  },
  bands: {
    age: [
      { label: "Age below 45", lt: 45, points: 0 },
      { label: "Age 45 to 54", lte: 54, points: 2 },
      { label: "Age 55 to 64", lte: 64, points: 3 },
      { label: "Age over 64", points: 4 },
    ],
    bmi: [
      { label: "BMI below 25", lt: 25, points: 0 },
      { label: "BMI 25 to 30", lte: 30, points: 1 },
      { label: "BMI over 30", points: 3 },
    ],
    waistCircumferenceMale: [
      { label: "Waist circumference below 94 cm", lt: 94, points: 0 },
      { label: "Waist circumference 94 to 102 cm", lte: 102, points: 3 },
      { label: "Waist circumference over 102 cm", points: 4 },
    ],
    waistCircumferenceFemale: [
      { label: "Waist circumference below 80 cm", lt: 80, points: 0 },
      { label: "Waist circumference 80 to 88 cm", lte: 88, points: 3 },
      { label: "Waist circumference over 88 cm", points: 4 },
    ],
  },
  unknownAnswers: {
    waist_circumference: { label: "Waist circumference unknown", points: 0 },
  },
  booleanRules: {
    daily_physical_activity: {
      label: "Less than 30 minutes of daily physical activity",
      appliesWhen: false,
      points: 2,
    },
    daily_fruit_or_vegetable_intake: {
      label: "Fruit or vegetable intake is not daily",
      appliesWhen: false,
      points: 1,
    },
    blood_pressure_medication: {
      label: "History of blood pressure medication",
      appliesWhen: true,
      points: 2,
    },
    high_blood_glucose: {
      label: "History of high blood glucose",
      appliesWhen: true,
      points: 5,
    },
  },
  choiceRules: {
    family_history: {
      none: { label: "No family history of diabetes", points: 0 },
      extended: { label: "Extended family history of diabetes", points: 3 },
      immediate: { label: "Immediate family history of diabetes", points: 5 },
    },
  },
} as const;

export const complicationRiskRules = {
  branch: "complication_risk",
  versionNumber: 1,
  source: "Custodia complication-risk checklist",
  questionnaireVersion: QUESTIONNAIRE_VERSION,
  engineVersion: SCORING_ENGINE_VERSION,
  highRiskCutoff: 6,
  classifications: {
    belowCutoff: "diabetes_low",
    atOrAboveCutoff: "diabetes_high",
  },
  evaluationOrder: ["redFlags", "weightedChecklist"],
  redFlags: {
    foot_wound_or_ulcer: {
      label: "Current unhealed foot wound or ulcer",
      urgency: "urgent",
    },
    sudden_vision_loss_or_blurring: {
      label: "Sudden vision loss or blurring",
      urgency: "urgent",
    },
    ketoacidosis_symptoms: {
      label: "Symptoms suggestive of ketoacidosis",
      urgency: "emergency",
    },
    chest_pain_or_shortness_of_breath: {
      label: "Chest pain or shortness of breath",
      urgency: "emergency",
    },
  },
  booleanRules: {
    neuropathy_symptoms: {
      label: "Neuropathy symptoms such as numbness, tingling, or sensation loss",
      appliesWhen: true,
      points: 2,
    },
    retinopathy_symptoms: {
      label: "Retinopathy symptoms such as blurred or impaired night vision",
      appliesWhen: true,
      points: 2,
    },
    nephropathy_signals: {
      label: "Nephropathy signals such as swelling, foamy urine, or fatigue",
      appliesWhen: true,
      points: 2,
    },
    medication_adherence: {
      label: "Difficulty taking medication as prescribed",
      appliesWhen: false,
      points: 2,
    },
  },
  choiceRules: {
    hba1c_control: {
      known_good: { label: "Self-reported HbA1c is in range", points: 0 },
      known_elevated: { label: "Self-reported HbA1c is elevated", points: 3 },
      unknown: { label: "HbA1c is unknown", points: 1 },
    },
    glucose_episodes: {
      rare: { label: "Hypo/hyperglycemic episodes are rare", points: 0 },
      monthly: { label: "Hypo/hyperglycemic episodes monthly", points: 1 },
      weekly_or_more: { label: "Hypo/hyperglycemic episodes weekly or more", points: 3 },
    },
    diabetes_duration: {
      under_5_years: { label: "Diabetes duration under 5 years", points: 0 },
      "5_to_10_years": { label: "Diabetes duration 5 to 10 years", points: 1 },
      over_10_years: { label: "Diabetes duration over 10 years", points: 2 },
    },
    blood_pressure_control: {
      controlled: { label: "Blood pressure is controlled", points: 0 },
      uncontrolled: { label: "Blood pressure is uncontrolled", points: 2 },
      unknown: { label: "Blood pressure control is unknown", points: 1 },
    },
    smoking_status: {
      non_smoker: { label: "Non-smoker", points: 0 },
      former_smoker: { label: "Former smoker", points: 1 },
      current_smoker: { label: "Current smoker", points: 2 },
    },
    last_checkup: {
      within_12_months: { label: "Last checkup was within 12 months", points: 0 },
      over_12_months: { label: "Last checkup was more than 12 months ago", points: 2 },
    },
  },
} as const;

export const scoringRulesByBranch = {
  risk_of_diabetes: riskOfDiabetesRules,
  complication_risk: complicationRiskRules,
} as const;

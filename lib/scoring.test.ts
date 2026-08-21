import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type DiagnosedScoringInput,
  type NotDiagnosedScoringInput,
  type RedFlagId,
  scoreAssessment,
} from "./scoring";

const noRedFlags: Record<RedFlagId, boolean> = {
  foot_wound_or_ulcer: false,
  sudden_vision_loss_or_blurring: false,
  ketoacidosis_symptoms: false,
  chest_pain_or_shortness_of_breath: false,
};

const clearBranchALowRisk: NotDiagnosedScoringInput = {
  diabetesStatus: "not_diagnosed",
  age: 32,
  heightCm: 175,
  weightKg: 68,
  sex: "male",
  waistCircumferenceCm: 82,
  dailyPhysicalActivity: true,
  dailyFruitOrVegetableIntake: true,
  historyOfBloodPressureMedication: false,
  historyOfHighBloodGlucose: false,
  familyHistory: "none",
};

const clearBranchBLowRisk: DiagnosedScoringInput = {
  diabetesStatus: "diagnosed",
  redFlags: noRedFlags,
  hba1cControl: "known_good",
  glucoseEpisodeFrequency: "rare",
  diabetesDuration: "under_5_years",
  bloodPressureControl: "controlled",
  smokingStatus: "non_smoker",
  neuropathySymptoms: false,
  retinopathySymptoms: false,
  nephropathySignals: false,
  medicationAdherence: true,
  lastCheckup: "within_12_months",
};

function pointsFor(input: NotDiagnosedScoringInput, factorId: string) {
  const result = scoreAssessment(input);
  const factor = result.contributingFactors.find((candidate) => candidate.id === factorId);

  return factor?.points ?? 0;
}

describe("Branch A: not diagnosed diabetes risk", () => {
  it("classifies a clear low-risk case", () => {
    const result = scoreAssessment(clearBranchALowRisk);

    assert.equal(result.branch, "risk_of_diabetes");
    assert.equal(result.classification, "no_diabetes_low");
    assert.equal(result.score, 0);
    assert.deepEqual(result.redFlags, []);
    assert.equal(result.urgency, "routine");
    assert.equal(result.urgentCareRecommended, false);
  });

  it("classifies a clear high-risk case", () => {
    const result = scoreAssessment({
      diabetesStatus: "not_diagnosed",
      age: 68,
      heightCm: 160,
      weightKg: 92,
      sex: "female",
      waistCircumferenceCm: 96,
      dailyPhysicalActivity: false,
      dailyFruitOrVegetableIntake: false,
      historyOfBloodPressureMedication: true,
      historyOfHighBloodGlucose: true,
      familyHistory: "immediate",
    });

    assert.equal(result.classification, "no_diabetes_high");
    assert.equal(result.score, 26);
  });

  it("keeps score 11 below the high-risk cutoff", () => {
    const result = scoreAssessment({
      ...clearBranchALowRisk,
      age: 50,
      weightKg: 78,
      waistCircumferenceCm: 98,
      dailyPhysicalActivity: false,
      familyHistory: "extended",
    });

    assert.equal(result.score, 11);
    assert.equal(result.classification, "no_diabetes_low");
  });

  it("classifies score 12 at the high-risk cutoff", () => {
    const result = scoreAssessment({
      ...clearBranchALowRisk,
      age: 50,
      weightKg: 78,
      waistCircumferenceCm: 98,
      dailyPhysicalActivity: false,
      dailyFruitOrVegetableIntake: false,
      familyHistory: "extended",
    });

    assert.equal(result.score, 12);
    assert.equal(result.classification, "no_diabetes_high");
  });

  it("scores an unknown waist circumference as zero", () => {
    assert.equal(pointsFor({ ...clearBranchALowRisk, waistCircumferenceCm: "unknown" }, "waist_circumference"), 0);
  });
});

describe("Branch A boundaries", () => {
  const ageCases: Array<[number, number]> = [
    [44, 0],
    [45, 2],
    [54, 2],
    [55, 3],
    [64, 3],
    [65, 4],
  ];

  for (const [age, points] of ageCases) {
    it(`scores age ${age} as ${points} points`, () => {
      assert.equal(pointsFor({ ...clearBranchALowRisk, age }, "age"), points);
    });
  }

  const bmiCases: Array<[number, number]> = [
    [24.99, 0],
    [25, 1],
    [30, 1],
    [30.01, 3],
  ];

  for (const [bmi, points] of bmiCases) {
    it(`scores BMI ${bmi} as ${points} points`, () => {
      const heightCm = 100;
      const weightKg = bmi;

      assert.equal(pointsFor({ ...clearBranchALowRisk, heightCm, weightKg }, "bmi"), points);
    });
  }

  const maleWaistCases: Array<[number, number]> = [
    [93.99, 0],
    [94, 3],
    [102, 3],
    [102.01, 4],
  ];

  for (const [waistCircumferenceCm, points] of maleWaistCases) {
    it(`scores male waist ${waistCircumferenceCm} cm as ${points} points`, () => {
      assert.equal(
        pointsFor({ ...clearBranchALowRisk, sex: "male", waistCircumferenceCm }, "waist_circumference"),
        points,
      );
    });
  }

  const femaleWaistCases: Array<[number, number]> = [
    [79.99, 0],
    [80, 3],
    [88, 3],
    [88.01, 4],
  ];

  for (const [waistCircumferenceCm, points] of femaleWaistCases) {
    it(`scores female waist ${waistCircumferenceCm} cm as ${points} points`, () => {
      assert.equal(
        pointsFor({ ...clearBranchALowRisk, sex: "female", waistCircumferenceCm }, "waist_circumference"),
        points,
      );
    });
  }
});

describe("Branch B: diagnosed complication risk", () => {
  it("classifies a clear low-risk case", () => {
    const result = scoreAssessment(clearBranchBLowRisk);

    assert.equal(result.branch, "complication_risk");
    assert.equal(result.classification, "diabetes_low");
    assert.equal(result.score, 0);
    assert.deepEqual(result.redFlags, []);
    assert.equal(result.urgency, "routine");
    assert.equal(result.urgentCareRecommended, false);
  });

  it("keeps score 5 below the high-risk cutoff", () => {
    const result = scoreAssessment({
      ...clearBranchBLowRisk,
      hba1cControl: "known_elevated",
      diabetesDuration: "over_10_years",
    });

    assert.equal(result.score, 5);
    assert.equal(result.classification, "diabetes_low");
  });

  it("classifies score 6 at the high-risk cutoff", () => {
    const result = scoreAssessment({
      ...clearBranchBLowRisk,
      hba1cControl: "known_elevated",
      glucoseEpisodeFrequency: "weekly_or_more",
    });

    assert.equal(result.classification, "diabetes_high");
    assert.equal(result.score, 6);
    assert.deepEqual(result.redFlags, []);
  });
});

describe("Branch B red flags", () => {
  const redFlagCases: Array<[RedFlagId, "urgent" | "emergency"]> = [
    ["foot_wound_or_ulcer", "urgent"],
    ["sudden_vision_loss_or_blurring", "urgent"],
    ["ketoacidosis_symptoms", "emergency"],
    ["chest_pain_or_shortness_of_breath", "emergency"],
  ];

  for (const [redFlagId, urgency] of redFlagCases) {
    it(`treats ${redFlagId} as high risk with ${urgency} urgency`, () => {
      const result = scoreAssessment({
        ...clearBranchBLowRisk,
        redFlags: { ...noRedFlags, [redFlagId]: true },
      });

      assert.equal(result.classification, "diabetes_high");
      assert.equal(result.score, null);
      assert.deepEqual(result.redFlags.map((factor) => factor.id), [redFlagId]);
      assert.equal(result.urgency, urgency);
      assert.equal(result.urgentCareRecommended, true);
    });
  }

  it("escalates to emergency when urgent and emergency flags are both reported", () => {
    const result = scoreAssessment({
      ...clearBranchBLowRisk,
      redFlags: { ...noRedFlags, foot_wound_or_ulcer: true, chest_pain_or_shortness_of_breath: true },
    });

    assert.equal(result.urgency, "emergency");
    assert.equal(result.redFlags.length, 2);
  });

  it("overrides an otherwise low weighted checklist score", () => {
    const result = scoreAssessment({
      ...clearBranchBLowRisk,
      redFlags: { ...noRedFlags, foot_wound_or_ulcer: true },
      hba1cControl: "known_good",
      lastCheckup: "within_12_months",
    });

    assert.equal(result.classification, "diabetes_high");
    assert.equal(result.score, null);
  });
});

describe("Scoring is monotonic", () => {
  it("never lowers the branch A score when a risk factor is added", () => {
    const baseline = scoreAssessment(clearBranchALowRisk).score ?? 0;
    const worseInputs: NotDiagnosedScoringInput[] = [
      { ...clearBranchALowRisk, age: 70 },
      { ...clearBranchALowRisk, weightKg: 110 },
      { ...clearBranchALowRisk, waistCircumferenceCm: 120 },
      { ...clearBranchALowRisk, dailyPhysicalActivity: false },
      { ...clearBranchALowRisk, dailyFruitOrVegetableIntake: false },
      { ...clearBranchALowRisk, historyOfBloodPressureMedication: true },
      { ...clearBranchALowRisk, historyOfHighBloodGlucose: true },
      { ...clearBranchALowRisk, familyHistory: "immediate" },
    ];

    for (const input of worseInputs) {
      assert.ok((scoreAssessment(input).score ?? 0) >= baseline);
    }
  });

  it("never lowers the branch B score when a risk factor is added", () => {
    const baseline = scoreAssessment(clearBranchBLowRisk).score ?? 0;
    const worseInputs: DiagnosedScoringInput[] = [
      { ...clearBranchBLowRisk, hba1cControl: "known_elevated" },
      { ...clearBranchBLowRisk, hba1cControl: "unknown" },
      { ...clearBranchBLowRisk, glucoseEpisodeFrequency: "weekly_or_more" },
      { ...clearBranchBLowRisk, diabetesDuration: "over_10_years" },
      { ...clearBranchBLowRisk, bloodPressureControl: "uncontrolled" },
      { ...clearBranchBLowRisk, smokingStatus: "current_smoker" },
      { ...clearBranchBLowRisk, neuropathySymptoms: true },
      { ...clearBranchBLowRisk, retinopathySymptoms: true },
      { ...clearBranchBLowRisk, nephropathySignals: true },
      { ...clearBranchBLowRisk, medicationAdherence: false },
      { ...clearBranchBLowRisk, lastCheckup: "over_12_months" },
    ];

    for (const input of worseInputs) {
      assert.ok((scoreAssessment(input).score ?? 0) >= baseline);
    }
  });
});

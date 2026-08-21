"use client";

import { FormEvent, useRef, useState } from "react";
import {
  buildNurseWhatsAppLink,
  nonDiagnosticDisclaimer,
  resultContent,
  urgencyContent,
} from "./result-content";
import type { Classification, ClinicalUrgency } from "@/lib/scoring";

type DiabetesStatus = "not_diagnosed" | "diagnosed";
type FieldValue = string | number | boolean;
type Responses = Record<string, FieldValue>;
type ScreenStage = "intro" | "quiz" | "result";
type QuestionOption = { label: string; value: string | boolean; helper?: string };
type Question = {
  id: string;
  label: string;
  helper?: string;
  kind: "number" | "height_imperial" | "yes_no" | "single_select" | "branch_select";
  options?: QuestionOption[];
  inputSuffix?: string;
};

type SubmissionResult = {
  assessmentId: string;
  referenceCode: string;
  result: {
    classification: Classification;
    score: number | null;
    contributingFactors: Array<{ id: string; label: string; points?: number }>;
    urgency: ClinicalUrgency;
    urgentCareRecommended: boolean;
  };
};

const notDiagnosedDefaults: Responses = {
  age: "",
  heightCm: "",
  heightFeet: "",
  heightInches: "",
  weightKg: "",
  sex: "",
  waistCircumferenceCm: "",
  dailyPhysicalActivity: "",
  dailyFruitOrVegetableIntake: "",
  historyOfBloodPressureMedication: "",
  historyOfHighBloodGlucose: "",
  familyHistory: "",
};

const diagnosedDefaults: Responses = {
  foot_wound_or_ulcer: "",
  sudden_vision_loss_or_blurring: "",
  ketoacidosis_symptoms: "",
  chest_pain_or_shortness_of_breath: "",
  hba1cControl: "",
  glucoseEpisodeFrequency: "",
  diabetesDuration: "",
  bloodPressureControl: "",
  smokingStatus: "",
  neuropathySymptoms: "",
  retinopathySymptoms: "",
  nephropathySignals: "",
  medicationAdherence: "",
  lastCheckup: "",
};

const branchQuestion: Question = {
  id: "diabetesStatus",
  kind: "branch_select",
  label: "Do you already have diabetes?",
  helper: "This helps us choose the right questions for you.",
  options: [
    { label: "No / I'm not sure", value: "not_diagnosed", helper: "Check my diabetes risk" },
    { label: "Yes, I have diabetes", value: "diagnosed", helper: "Check for possible complications" },
  ],
};

const notDiagnosedQuestions: Question[] = [
  { id: "age", kind: "number", label: "How old are you?", inputSuffix: "years" },
  { id: "heightCm", kind: "height_imperial", label: "How tall are you?" },
  { id: "weightKg", kind: "number", label: "How much do you weigh?", inputSuffix: "kg" },
  {
    id: "sex",
    kind: "single_select",
    label: "What is your sex?",
    options: [
      { label: "Male", value: "male" },
      { label: "Female", value: "female" },
    ],
  },
  {
    id: "waistCircumferenceCm",
    kind: "single_select",
    label: "What is your waist size?",
    helper: "Choose the closest option if you're not sure.",
    options: [
      { label: "I don't know", value: "unknown" },
      { label: "70 cm", value: "70" },
      { label: "80 cm", value: "80" },
      { label: "88 cm", value: "88" },
      { label: "94 cm", value: "94" },
      { label: "102 cm", value: "102" },
      { label: "110 cm", value: "110" },
    ],
  },
  {
    id: "dailyPhysicalActivity",
    kind: "yes_no",
    label: "Do you move or exercise for at least 30 minutes most days?",
  },
  {
    id: "dailyFruitOrVegetableIntake",
    kind: "yes_no",
    label: "Do you eat fruit or vegetables every day?",
  },
  {
    id: "historyOfBloodPressureMedication",
    kind: "yes_no",
    label: "Have you ever been prescribed medicine for high blood pressure?",
  },
  {
    id: "historyOfHighBloodGlucose",
    kind: "yes_no",
    label: "Have you ever been told your blood sugar was high?",
  },
  {
    id: "familyHistory",
    kind: "single_select",
    label: "Does diabetes run in your family?",
    options: [
      { label: "No", value: "none" },
      { label: "Grandparent, aunt, uncle, or cousin", value: "extended" },
      { label: "Parent, sibling, or child", value: "immediate" },
    ],
  },
];

const diagnosedQuestions: Question[] = [
  {
    id: "foot_wound_or_ulcer",
    kind: "yes_no",
    label: "Do you have a foot sore or wound that is not healing?",
  },
  {
    id: "sudden_vision_loss_or_blurring",
    kind: "yes_no",
    label: "Have you had sudden vision loss or blurry vision?",
  },
  {
    id: "ketoacidosis_symptoms",
    kind: "yes_no",
    label: "Do you have nausea, vomiting, fast breathing, or confusion?",
  },
  {
    id: "chest_pain_or_shortness_of_breath",
    kind: "yes_no",
    label: "Do you have chest pain or trouble breathing?",
  },
  {
    id: "hba1cControl",
    kind: "single_select",
    label: "Do you know if your average blood sugar, or HbA1c, is in range?",
    options: [
      { label: "Yes, it is in range", value: "known_good" },
      { label: "Yes, but it is high", value: "known_elevated" },
      { label: "I don't know", value: "unknown" },
    ],
  },
  {
    id: "glucoseEpisodeFrequency",
    kind: "single_select",
    label: "How often do you have very high or very low blood sugar?",
    options: [
      { label: "Rarely", value: "rare" },
      { label: "About once a month", value: "monthly" },
      { label: "Every week or more", value: "weekly_or_more" },
    ],
  },
  {
    id: "diabetesDuration",
    kind: "single_select",
    label: "How long have you been living with diabetes?",
    options: [
      { label: "Under 5 years", value: "under_5_years" },
      { label: "5 to 10 years", value: "5_to_10_years" },
      { label: "Over 10 years", value: "over_10_years" },
    ],
  },
  {
    id: "bloodPressureControl",
    kind: "single_select",
    label: "Is your blood pressure under control?",
    options: [
      { label: "Yes", value: "controlled" },
      { label: "No", value: "uncontrolled" },
      { label: "I don't know", value: "unknown" },
    ],
  },
  {
    id: "smokingStatus",
    kind: "single_select",
    label: "Do you smoke?",
    options: [
      { label: "No", value: "non_smoker" },
      { label: "I used to smoke", value: "former_smoker" },
      { label: "Yes, I smoke now", value: "current_smoker" },
    ],
  },
  {
    id: "neuropathySymptoms",
    kind: "yes_no",
    label: "Do you have numbness, tingling, or reduced feeling in your hands or feet?",
  },
  {
    id: "retinopathySymptoms",
    kind: "yes_no",
    label: "Do you have blurry vision or trouble seeing at night?",
  },
  {
    id: "nephropathySignals",
    kind: "yes_no",
    label: "Do you have swelling, foamy urine, or unusual tiredness?",
  },
  {
    id: "medicationAdherence",
    kind: "yes_no",
    label: "Do you take your diabetes medicine as prescribed?",
  },
  {
    id: "lastCheckup",
    kind: "single_select",
    label: "When was your last diabetes checkup?",
    options: [
      { label: "Within the past year", value: "within_12_months" },
      { label: "More than a year ago", value: "over_12_months" },
    ],
  },
];

export function QuestionnaireForm() {
  const [stage, setStage] = useState<ScreenStage>("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [diabetesStatus, setDiabetesStatus] = useState<DiabetesStatus | "">("");
  const [responses, setResponses] = useState<Responses>(notDiagnosedDefaults);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const branchQuestions = diabetesStatus === "diagnosed" ? diagnosedQuestions : notDiagnosedQuestions;
  const quizQuestions = diabetesStatus ? [branchQuestion, ...branchQuestions] : [branchQuestion];
  const currentQuestion = quizQuestions[currentQuestionIndex];
  const currentValue = getCurrentValue(currentQuestion, diabetesStatus, responses);
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;
  const progressPercent = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
  const canMoveForward = hasAnsweredQuestion(currentQuestion, currentValue);

  function selectBranch(nextStatus: DiabetesStatus) {
    setDiabetesStatus(nextStatus);
    setResponses(nextStatus === "not_diagnosed" ? notDiagnosedDefaults : diagnosedDefaults);
    setCurrentQuestionIndex(0);
    setSubmissionResult(null);
    setErrors([]);
    idempotencyKeyRef.current = null;
  }

  function updateResponse(key: string, value: FieldValue) {
    setResponses((currentResponses) => ({ ...currentResponses, [key]: value }));
    idempotencyKeyRef.current = null;
  }

  function startQuiz() {
    setStage("quiz");
    setCurrentQuestionIndex(0);
    setErrors([]);
    setSubmissionResult(null);
  }

  function goBack() {
    setErrors([]);

    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((index) => index - 1);
      return;
    }

    setStage("intro");
  }

  async function submitAssessment() {
    if (!diabetesStatus) {
      setErrors(["Please choose whether you have been diagnosed with diabetes."]);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);
    setSubmissionResult(null);
    idempotencyKeyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({ diabetesStatus, responses: normalizeResponses(responses) }),
      });
      const body = await response.json();

      if (!response.ok) {
        setErrors(Array.isArray(body.errors) ? body.errors : ["Assessment could not be submitted."]);
        return;
      }

      setSubmissionResult(body);
      setStage("result");
    } catch {
      setErrors(["Assessment could not be submitted. Please try again."]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMoveForward) {
      return;
    }

    if (isLastQuestion) {
      void submitAssessment();
      return;
    }

    setErrors([]);
    setCurrentQuestionIndex((index) => index + 1);
  }

  function startOver() {
    setStage("intro");
    setCurrentQuestionIndex(0);
    setHasConsented(false);
    setDiabetesStatus("");
    setResponses(notDiagnosedDefaults);
    setIsSubmitting(false);
    setErrors([]);
    setSubmissionResult(null);
    idempotencyKeyRef.current = null;
  }

  if (stage === "intro") {
    return (
      <section className="panel quizPanel" aria-labelledby="questionnaire-title">
        <div className="introScreen">
          <p className="eyebrow">Diabetes risk triage</p>
          <h1 id="questionnaire-title">Know Your Risk | Diabetes Screening</h1>
          <p className="introLead">
            Get a clearer picture of your current diabetes risk and identify signs that could point to future
            complications. Your results will help you understand what to do next, and you can also get a <strong>free
            nurse review</strong> for personalized guidance.
          </p>
          <p className="introNote">{nonDiagnosticDisclaimer}</p>

          <label className="consentField">
            <input
              checked={hasConsented}
              onChange={(event) => setHasConsented(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this is not a diagnosis and agree my answers may be used for screening and nurse review where
              appropriate.
            </span>
          </label>

          <button className="primaryButton startButton" disabled={!hasConsented} onClick={startQuiz} type="button">
            Start
          </button>
        </div>
      </section>
    );
  }

  if (stage === "result" && submissionResult) {
    return (
      <section className="panel quizPanel" aria-labelledby="result-title">
        <div className="resultTopbar">
          <div>
            <p className="eyebrow">Screening complete</p>
            <h1 id="result-title">Your screening result</h1>
          </div>
          <button className="secondaryButton" onClick={startOver} type="button">
            Start over
          </button>
        </div>
        <ResultSummary submissionResult={submissionResult} />
      </section>
    );
  }

  return (
    <section className="panel quizPanel" aria-labelledby="questionnaire-title">
      <div className="panelHeader quizHeader">
        <p className="eyebrow">Diabetes risk triage</p>
        <h1 id="questionnaire-title">Know Your Risk</h1>
      </div>

      <form onSubmit={handleSubmit} className="questionnaireForm quizForm">
        <div className="progressBlock" aria-label={`Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`}>
          <div className="progressMeta">
            <span>
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </span>
            {diabetesStatus ? (
              <span>{diabetesStatus === "diagnosed" ? "Diagnosed pathway" : "Risk estimate pathway"}</span>
            ) : null}
          </div>
          <div className="progressTrack">
            <div className="progressFill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <QuestionCard
          question={currentQuestion}
          responses={responses}
          value={currentValue}
          onBranchSelect={selectBranch}
          onChange={updateResponse}
        />

        {errors.length > 0 ? (
          <div className="errorBox" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        <div className="quizActions">
          <button type="button" className="secondaryButton" onClick={goBack}>
            Back
          </button>
          <button type="submit" className="primaryButton" disabled={!canMoveForward || isSubmitting}>
            {isSubmitting ? "Scoring..." : isLastQuestion ? "See my result" : "Next"}
          </button>
        </div>
      </form>

      <p className="disclaimer">{nonDiagnosticDisclaimer}</p>
    </section>
  );
}

function QuestionCard({
  question,
  responses,
  value,
  onBranchSelect,
  onChange,
}: {
  question: Question;
  responses: Responses;
  value: FieldValue | "";
  onBranchSelect: (diabetesStatus: DiabetesStatus) => void;
  onChange: (key: string, value: FieldValue) => void;
}) {
  return (
    <div className="questionCard">
      <div className="questionCopy">
        <p className="questionKicker">Diabetes check</p>
        <h2>{question.label}</h2>
        {question.helper ? <p>{question.helper}</p> : null}
      </div>

      {question.kind === "height_imperial" ? (
        <HeightQuestion responses={responses} onChange={onChange} />
      ) : question.kind === "number" ? (
        <NumberQuestion question={question} value={value} onChange={onChange} />
      ) : (
        <OptionQuestion question={question} value={value} onBranchSelect={onBranchSelect} onChange={onChange} />
      )}
    </div>
  );
}

function HeightQuestion({
  responses,
  onChange,
}: {
  responses: Responses;
  onChange: (key: string, value: FieldValue) => void;
}) {
  return (
    <div className="heightQuestion">
      <label className="heightUnitField">
        <input
          autoFocus
          inputMode="numeric"
          required
          min="1"
          type="number"
          value={String(responses.heightFeet ?? "")}
          onChange={(event) => onChange("heightFeet", event.target.value)}
        />
        <span>feet</span>
      </label>
      <label className="heightUnitField">
        <input
          inputMode="numeric"
          required
          min="0"
          max="11"
          type="number"
          value={String(responses.heightInches ?? "")}
          onChange={(event) => onChange("heightInches", event.target.value)}
        />
        <span>inches</span>
      </label>
    </div>
  );
}

function NumberQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: FieldValue | "";
  onChange: (key: string, value: FieldValue) => void;
}) {
  return (
    <label className="numberQuestion">
      <input
        autoFocus
        inputMode="numeric"
        required
        min="1"
        type="number"
        value={String(value)}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
      <span>{question.inputSuffix ?? "Value"}</span>
    </label>
  );
}

function OptionQuestion({
  question,
  value,
  onBranchSelect,
  onChange,
}: {
  question: Question;
  value: FieldValue | "";
  onBranchSelect: (diabetesStatus: DiabetesStatus) => void;
  onChange: (key: string, value: FieldValue) => void;
}) {
  const options = question.kind === "yes_no" ? yesNoOptions : question.options ?? [];

  return (
    <div className={`optionGrid optionGrid-${question.kind}`} role="group" aria-label={question.label}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            type="button"
            className={isSelected ? "optionTile selected" : "optionTile"}
            key={String(option.value)}
            onClick={() => {
              if (question.kind === "branch_select") {
                onBranchSelect(option.value as DiabetesStatus);
                return;
              }

              onChange(question.id, option.value);
            }}
          >
            <span>{option.label}</span>
            {option.helper ? <small>{option.helper}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

const yesNoOptions: QuestionOption[] = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

function ResultSummary({ submissionResult }: { submissionResult: SubmissionResult }) {
  const { result } = submissionResult;
  const content = resultContent[result.classification];
  const whatsappLink = buildNurseWhatsAppLink(result.classification, submissionResult.referenceCode);
  const showContributingFactors =
    result.classification === "no_diabetes_high" && result.contributingFactors.length > 0;
  const showWhatsAppHandoff = result.classification === "diabetes_high";

  return (
    <section className={`resultPanel resultPanel-${result.classification}`} aria-live="polite">
      <div className="resultHeader">
        <p className="eyebrow">{content.eyebrow}</p>
        <h2>{content.title}</h2>
        <p>{content.summary}</p>
      </div>

      {urgencyContent[result.urgency] ? (
        <p className={`urgent urgent-${result.urgency}`} role="alert">
          {urgencyContent[result.urgency]}
        </p>
      ) : null}

      {showContributingFactors ? (
        <div className="factorBox">
          <h3>Why this result appeared</h3>
          <ul>
            {result.contributingFactors.map((factor) => (
              <li key={factor.id}>{factor.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="tipsBlock">
        <h3>Next steps</h3>
        <ul>
          {content.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      {showWhatsAppHandoff ? (
        <div className="handoffBlock">
          {whatsappLink ? (
            <a
              className="resultAction"
              href={whatsappLink}
              rel="noreferrer"
              target="_blank"
            >
              {content.actionLabel}
            </a>
          ) : null}
        </div>
      ) : content.actionLabel ? (
        <p className="resultCallout">{content.actionLabel}</p>
      ) : null}

      <p className="disclaimer resultDisclaimer">{nonDiagnosticDisclaimer}</p>
    </section>
  );
}

function getCurrentValue(question: Question, diabetesStatus: DiabetesStatus | "", responses: Responses) {
  if (question.id === "diabetesStatus") {
    return diabetesStatus;
  }

  if (question.kind === "height_imperial") {
    return `${responses.heightFeet ?? ""}:${responses.heightInches ?? ""}`;
  }

  return responses[question.id];
}

function normalizeResponses(responses: Responses): Responses {
  return Object.fromEntries(
    Object.entries(responses).flatMap(([key, value]) => {
      if (key === "heightFeet" || key === "heightInches") {
        return [];
      }

      if (key === "age" || key === "heightCm" || key === "weightKg") {
        if (key === "heightCm") {
          return [[key, convertImperialHeightToCm(responses)]];
        }

        return [[key, Number(value)]];
      }

      if (key === "waistCircumferenceCm" && value !== "unknown") {
        return [[key, Number(value)]];
      }

      return [[key, value]];
    }),
  );
}

function convertImperialHeightToCm(responses: Responses) {
  const feet = Number(responses.heightFeet);
  const inches = Number(responses.heightInches);

  return Math.round((feet * 12 + inches) * 2.54);
}

function hasAnsweredQuestion(question: Question, value: FieldValue | "") {
  if (question.kind === "height_imperial") {
    const [feetValue, inchesValue] = String(value).split(":");
    const feet = Number(feetValue);
    const inches = Number(inchesValue);

    return (
      feetValue.trim() !== "" &&
      inchesValue.trim() !== "" &&
      Number.isFinite(feet) &&
      feet > 0 &&
      Number.isFinite(inches) &&
      inches >= 0 &&
      inches < 12
    );
  }

  if (question.kind === "number") {
    return String(value).trim() !== "" && Number(value) > 0;
  }

  return value !== "";
}

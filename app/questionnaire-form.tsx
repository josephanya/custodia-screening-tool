"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import {
  buildNurseWhatsAppLink,
  emergencySecondaryCopy,
  getResultDisplayState,
  nonDiagnosticDisclaimer,
  resultContent,
  urgencyContent,
} from "./result-content";
import { Button, NumberField, OptionTile, ProgressBar, Toast, YesNoTile } from "@/components/screening/ui";
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
  max?: number;
  min?: number;
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
  options: [
    { label: "No / I'm not sure", value: "not_diagnosed", helper: "Check my diabetes risk" },
    { label: "Yes, I have diabetes", value: "diagnosed", helper: "Check for possible complications" },
  ],
};

const notDiagnosedQuestions: Question[] = [
  { id: "age", kind: "number", label: "How old are you?", inputSuffix: "years", min: 18, max: 110 },
  { id: "heightCm", kind: "height_imperial", label: "How tall are you?", helper: "An estimate is fine.", min: 50, max: 250 },
  { id: "weightKg", kind: "number", label: "How much do you weigh?", inputSuffix: "kg", min: 30, max: 250 },
  {
    id: "sex",
    kind: "single_select",
    label: "What sex were you assigned at birth?",
    helper: "This changes how waist size is scored.",
    options: [
      { label: "Female", value: "female" },
      { label: "Male", value: "male" },
    ],
  },
  {
    id: "waistCircumferenceCm",
    kind: "number",
    label: "What is your waist size?",
    helper: "Measure around your belly, level with your belly button. An estimate is fine.",
    inputSuffix: "cm",
    min: 50,
    max: 200,
  },
  {
    id: "dailyPhysicalActivity",
    kind: "yes_no",
    label: "Do you get at least 30 minutes of physical activity most days?",
    helper: "This includes walking, work that keeps you moving, or exercise.",
  },
  {
    id: "dailyFruitOrVegetableIntake",
    kind: "yes_no",
    label: "Do you eat fruit or vegetables every day?",
  },
  {
    id: "historyOfBloodPressureMedication",
    kind: "yes_no",
    label: "Have you ever taken medicine for high blood pressure?",
  },
  {
    id: "historyOfHighBloodGlucose",
    kind: "yes_no",
    label: "Have you ever been told your blood sugar was high?",
  },
  {
    id: "familyHistory",
    kind: "single_select",
    label: "Has anyone in your family been diagnosed with diabetes?",
    options: [
      { label: "No", value: "none" },
      { label: "Yes, extended family", value: "extended", helper: "Grandparent, aunt, uncle, cousin" },
      { label: "Yes, close family", value: "immediate", helper: "Parent, brother, sister, child" },
    ],
  },
];

const diagnosedQuestions: Question[] = [
  {
    id: "foot_wound_or_ulcer",
    kind: "yes_no",
    label: "Do you have a wound or sore on your foot that is not healing?",
    helper: "This includes a blister, cut or ulcer that has lasted more than a week.",
  },
  {
    id: "sudden_vision_loss_or_blurring",
    kind: "yes_no",
    label: "Have you had sudden vision loss or blurry vision?",
  },
  {
    id: "ketoacidosis_symptoms",
    kind: "yes_no",
    label: "Do you have nausea, vomiting, fast breathing or confusion right now?",
  },
  {
    id: "chest_pain_or_shortness_of_breath",
    kind: "yes_no",
    label: "Do you have chest pain or trouble breathing right now?",
  },
  {
    id: "hba1cControl",
    kind: "single_select",
    label: "What was your most recent HbA1c result?",
    helper: "HbA1c is a blood test that shows your average sugar level over 3 months.",
    options: [
      { label: "Below 7%", value: "known_good" },
      { label: "7% to 9%", value: "known_elevated_7_to_9" },
      { label: "Above 9%", value: "known_elevated_above_9" },
      { label: "I don't know", value: "unknown" },
    ],
  },
  {
    id: "glucoseEpisodeFrequency",
    kind: "single_select",
    label: "How often do you have very high or very low blood sugar?",
    options: [
      { label: "Rarely or never", value: "rare" },
      { label: "Once or twice a month", value: "monthly" },
      { label: "Every week", value: "weekly_or_more" },
    ],
  },
  {
    id: "diabetesDuration",
    kind: "single_select",
    label: "How long have you had diabetes?",
    options: [
      { label: "Less than 5 years", value: "under_5_years" },
      { label: "5 to 10 years", value: "5_to_10_years" },
      { label: "More than 10 years", value: "over_10_years" },
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
      { label: "Never", value: "non_smoker" },
      { label: "I used to", value: "former_smoker" },
      { label: "Yes, I smoke now", value: "current_smoker" },
    ],
  },
  {
    id: "neuropathySymptoms",
    kind: "yes_no",
    label: "Do you have numbness, tingling or burning in your feet?",
  },
  {
    id: "retinopathySymptoms",
    kind: "yes_no",
    label: "Has a health worker told you diabetes is affecting your eyes?",
  },
  {
    id: "nephropathySignals",
    kind: "yes_no",
    label: "Has a health worker told you diabetes is affecting your kidneys?",
  },
  {
    id: "medicationAdherence",
    kind: "yes_no",
    label: "Do you take your diabetes medicine as prescribed?",
  },
  {
    id: "lastCheckup",
    kind: "single_select",
    label: "When did you last have a diabetes check-up?",
    options: [
      { label: "In the last 6 months", value: "within_6_months" },
      { label: "6 to 12 months ago", value: "six_to_12_months" },
      { label: "More than a year ago", value: "over_12_months" },
      { label: "Never, or I'm not sure", value: "never_or_unsure" },
    ],
  },
];

const responseValueAliases: Record<string, Record<string, string>> = {
  hba1cControl: {
    known_elevated_7_to_9: "known_elevated",
    known_elevated_above_9: "known_elevated",
  },
  lastCheckup: {
    within_6_months: "within_12_months",
    six_to_12_months: "within_12_months",
    never_or_unsure: "over_12_months",
  },
};

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
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const branchQuestions = diabetesStatus === "diagnosed" ? diagnosedQuestions : notDiagnosedQuestions;
  const quizQuestions = diabetesStatus ? [branchQuestion, ...branchQuestions] : [branchQuestion];
  const currentQuestion = quizQuestions[currentQuestionIndex];
  const currentValue = getCurrentValue(currentQuestion, diabetesStatus, responses);
  const isLastQuestion = Boolean(diabetesStatus) && currentQuestionIndex === quizQuestions.length - 1;
  const progressTotalQuestions = diabetesStatus
    ? quizQuestions.length
    : 1 + Math.max(notDiagnosedQuestions.length, diagnosedQuestions.length);
  const progressPercent = ((currentQuestionIndex + 1) / progressTotalQuestions) * 100;
  const canMoveForward = hasAnsweredQuestion(currentQuestion, currentValue);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });

    if (stage === "quiz") {
      questionHeadingRef.current?.focus();
    }

    if (stage === "result") {
      resultHeadingRef.current?.focus();
    }
  }, [currentQuestionIndex, stage]);

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
      setErrors(["We couldn't send your answers. Your answers are saved on this screen; check your connection and try again."]);
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
    setCurrentQuestionIndex((index) => Math.min(index + 1, quizQuestions.length - 1));
  }

  function moveForwardFromSelection() {
    setErrors([]);
    setCurrentQuestionIndex((index) => Math.min(index + 1, quizQuestions.length - 1));
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
      <>
        <PublicHeader onRestart={startOver} />
        <section className="publicIntro screenEnter" aria-labelledby="questionnaire-title">
          <div className="introHero">
            <div className="introChip" aria-label="Free diabetes risk triage">
              <span>Free</span>
              <span>Diabetes risk triage</span>
            </div>
            <h1 id="questionnaire-title">
              Know Your Risk
              <span>Diabetes Screening</span>
            </h1>
            <p className="introLead">
              Answer a few short questions to understand your risk of diabetes or, if you already have diabetes, your
              risk of complications.
            </p>
            <p className="introMeta">≈ 2 minutes · One question at a time</p>
          </div>

          <div className="introConsentCard">
            <div className="introInfoBox">
              <span aria-hidden="true">i</span>
              <p>{nonDiagnosticDisclaimer}</p>
            </div>

            <button
              aria-checked={hasConsented}
              className="consentField"
              onClick={() => setHasConsented((current) => !current)}
              role="checkbox"
              type="button"
            >
              <span className="consentBox" aria-hidden="true" />
              <span>
                I understand this is not a diagnosis and agree my answers may be used for screening and nurse review
                where appropriate.
              </span>
            </button>

            <div className="startBlock">
              <Button className="startButton" disabled={!hasConsented} onClick={startQuiz} type="button">
                Start →
              </Button>
              {!hasConsented ? <p className="startHelper">Tick the box above to start.</p> : null}
            </div>
          </div>
        </section>
      </>
    );
  }

  if (stage === "result" && submissionResult) {
    return (
      <>
        <PublicHeader onRestart={startOver} action={null} />
        <section className="panel quizPanel resultScreenPanel screenEnter" aria-labelledby="result-title">
          <div className="resultTopbar">
            <div>
              <p className="eyebrow">Screening complete</p>
              <h1 id="result-title" ref={resultHeadingRef} tabIndex={-1}>Your screening result</h1>
            </div>
          </div>
          <ResultSummary submissionResult={submissionResult} />
        </section>
      </>
    );
  }

  return (
    <>
      <PublicHeader onRestart={startOver} />
      <section className="questionStepShell" aria-labelledby="questionnaire-title">
        <form onSubmit={handleSubmit} className="questionnaireForm quizForm questionStepCard screenEnter">
          <div className="questionStepBody">
          <div className="progressBlock" aria-label={currentQuestionIndex === 0 ? "Question 1" : `Question ${currentQuestionIndex + 1} of ${progressTotalQuestions}`}>
            <div className="progressMeta">
              <span>
                {currentQuestionIndex === 0 ? "Question 1" : `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`}
              </span>
              {diabetesStatus && currentQuestionIndex > 0 ? (
                <span className="pathwayChip">{diabetesStatus === "diagnosed" ? "Diagnosed pathway" : "Risk estimate pathway"}</span>
              ) : null}
            </div>
            <ProgressBar label={`Question progress: ${currentQuestionIndex + 1} of ${progressTotalQuestions}`} value={progressPercent} />
          </div>

          <QuestionCard
            key={currentQuestion.id}
            headingRef={questionHeadingRef}
            question={currentQuestion}
            responses={responses}
            value={currentValue}
            onBranchSelect={selectBranch}
            onChange={updateResponse}
            onAutoAdvance={moveForwardFromSelection}
          />

          {errors.length > 0 ? (
            <div className="errorBox" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
          </div>

          <div className="quizActions">
            <Button type="button" variant="secondary" onClick={goBack} disabled={isSubmitting}>
              ← Back
            </Button>
            <Button type="submit" disabled={!canMoveForward || isSubmitting} loading={isSubmitting}>
              {isLastQuestion ? "See my result" : "Next →"}
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}

function PublicHeader({ action, onRestart }: { action?: ReactNode | null; onRestart: () => void }) {
  return (
    <header className="publicHeader">
      <div className="publicHeaderPill">
        <button className="wordmark" onClick={onRestart} type="button">
          <Image alt="Custodia" className="brandLogo" height={26} src="/custodia-logo.svg" width={132} />
        </button>
        <div className="publicHeaderAction">
          {action !== undefined ? action : (
            <span className="privateScreening">
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              PRIVATE SCREENING
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function QuestionCard({
  headingRef,
  question,
  responses,
  value,
  onAutoAdvance,
  onBranchSelect,
  onChange,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  question: Question;
  responses: Responses;
  value: FieldValue | "";
  onAutoAdvance: () => void;
  onBranchSelect: (diabetesStatus: DiabetesStatus) => void;
  onChange: (key: string, value: FieldValue) => void;
}) {
  return (
    <div className="questionCard">
      <div className="questionCopy">
        <h1 id="questionnaire-title" ref={headingRef} tabIndex={-1}>{question.label}</h1>
        {question.kind !== "branch_select" && question.helper ? <p>{question.helper}</p> : null}
      </div>

      {question.kind === "height_imperial" ? (
        <HeightQuestion responses={responses} onChange={onChange} />
      ) : question.kind === "number" ? (
        <NumberQuestion question={question} value={value} onChange={onChange} />
      ) : (
        <OptionQuestion question={question} value={value} onAutoAdvance={onAutoAdvance} onBranchSelect={onBranchSelect} onChange={onChange} />
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
  const heightCm = convertImperialHeightToCm(responses);
  const hasFeet = String(responses.heightFeet ?? "").trim() !== "";
  const hasInches = String(responses.heightInches ?? "").trim() !== "";
  const isOutsidePlausibleRange = hasFeet && hasInches && (heightCm < 50 || heightCm > 250);

  return (
    <div className="heightQuestion">
      <NumberField
        autoFocus
        error={isOutsidePlausibleRange ? "Enter a height between 1 ft 8 in and 8 ft 2 in" : undefined}
        label="Feet"
        max="8"
        min="1"
        name="heightFeet"
        required
        unit="feet"
        value={String(responses.heightFeet ?? "")}
        onChange={(event) => onChange("heightFeet", stripNumericInput(event.target.value))}
        helperText="Between 1 ft 8 in and 8 ft 2 in"
      />
      <NumberField
        label="Inches"
        max="11"
        min="0"
        name="heightInches"
        required
        unit="inches"
        value={String(responses.heightInches ?? "")}
        onChange={(event) => onChange("heightInches", stripNumericInput(event.target.value))}
        helperText="Between 0 and 11 inches"
      />
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
  const min = question.min ?? 1;
  const max = question.max;
  const unit = question.inputSuffix ?? "Value";
  const numericValue = Number(value);
  const hasValue = String(value).trim() !== "";
  const hasRangeError =
    hasValue && (!Number.isFinite(numericValue) || numericValue < min || (max !== undefined && numericValue > max));
  const rangeText = max === undefined ? `At least ${min} ${unit}` : `Between ${min} and ${max} ${unit}`;

  return (
    <NumberField
      autoFocus
      className="numberQuestion"
      error={hasRangeError ? `Enter a number ${rangeText.toLowerCase()}` : undefined}
      helperText={rangeText}
      label={getNumberFieldLabel(question)}
      max={max}
      min={min}
      name={question.id}
      required
      unit={unit}
      value={String(value)}
      onChange={(event) => onChange(question.id, stripNumericInput(event.target.value))}
    />
  );
}

function OptionQuestion({
  question,
  value,
  onAutoAdvance,
  onBranchSelect,
  onChange,
}: {
  question: Question;
  value: FieldValue | "";
  onAutoAdvance: () => void;
  onBranchSelect: (diabetesStatus: DiabetesStatus) => void;
  onChange: (key: string, value: FieldValue) => void;
}) {
  const options = question.kind === "yes_no" ? yesNoOptions : question.options ?? [];

  function selectOption(option: QuestionOption, shouldAutoAdvance = false) {
    if (question.kind === "branch_select") {
      onBranchSelect(option.value as DiabetesStatus);
      return;
    }

    onChange(question.id, option.value);

    if (shouldAutoAdvance && question.kind === "yes_no") {
      window.setTimeout(onAutoAdvance, 250);
    }
  }

  function handleRadioKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keyOffsets: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };

    if (!(event.key in keyOffsets) && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    const radioGroup = event.currentTarget;

    const currentIndex = options.findIndex((option) => option.value === value);
    const activeElementIndex = Array.from(radioGroup.querySelectorAll<HTMLElement>('[role="radio"]')).findIndex(
      (element) => element === document.activeElement,
    );
    const fallbackIndex = currentIndex >= 0 ? currentIndex : Math.max(0, activeElementIndex);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (fallbackIndex + keyOffsets[event.key] + options.length) % options.length;

    selectOption(options[nextIndex]);
    window.requestAnimationFrame(() => {
      radioGroup.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus();
    });
  }

  return (
    <div
      className={`optionGrid optionGrid-${question.kind}`}
      role="radiogroup"
      aria-label={question.label}
      onKeyDown={handleRadioKeyDown}
    >
      {options.map((option, optionIndex) => {
        const isSelected = value === option.value;
        const Tile = question.kind === "yes_no" ? YesNoTile : OptionTile;

        return (
          <Tile
            key={`${question.id}-${option.label}`}
            label={option.label}
            helper={option.helper}
            selected={isSelected}
            tabIndex={isSelected || (value === "" && optionIndex === 0) ? 0 : -1}
            onClick={() => {
              selectOption(option, true);
            }}
          />
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
  const display = getResultDisplayState({
    classification: result.classification,
    contributingFactorCount: result.contributingFactors.length,
    urgency: result.urgency,
  });
  const factorKind = display.isEmergencyOverride ? "emergency" : display.isUrgentOverride ? "urgent" : "scored";

  return (
    <section className={`resultStack resultPanel-${result.classification}`} aria-live="polite">
      {display.isEmergencyOverride ? <EmergencyBanner /> : null}

      {display.isUrgentOverride ? <UrgentBanner whatsappLink={whatsappLink} /> : null}

      {display.showSummaryCard ? (
        <div className="resultCard resultSummaryCard">
          <span className={`resultStatusChip ${display.isHigherOutcome ? "resultStatusChip-higher" : "resultStatusChip-lower"}`}>
            <span aria-hidden="true">{display.isHigherOutcome ? "↑" : "✓"}</span>
            {content.eyebrow}
          </span>
          <div className="resultHeader">
            <h2>{content.title}</h2>
            <p>{content.summary}</p>
          </div>
          {result.classification === "no_diabetes_high" && content.actionLabel ? (
            <p className="resultCallout">{content.actionLabel}</p>
          ) : null}
        </div>
      ) : null}

      {display.showNurseHandoff ? (
        <div className="resultHandoffCard">
          <div className="handoffCodeBlock">
            <span>YOUR REFERENCE CODE</span>
            <strong>{submissionResult.referenceCode}</strong>
          </div>
          <CopyReferenceButton referenceCode={submissionResult.referenceCode} variant="dark" />
          {whatsappLink ? (
            <a className="resultAction" href={whatsappLink} rel="noreferrer" target="_blank">
              {content.actionLabel}
            </a>
          ) : null}
          <p className="handoffPrivacy">
            <span aria-hidden="true">▣</span>
            Only this code is shared in the message. Your answers stay private.
          </p>
        </div>
      ) : null}

      {display.showFactorCard ? (
        <div className="resultCard factorBox">
          <h3>{display.factorTitle}</h3>
          <ul className="factorChipList">
            {result.contributingFactors.slice(0, 6).map((factor) => (
              <li className={`factorChip factorChip-${factorKind}`} key={factor.id}>{factor.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {display.showTips ? (
        <div className="resultCard tipsBlock">
          <h3>Next steps</h3>
          <ol>
            {content.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {display.showReferenceBox ? (
        <div className="referenceBox">
          <div>
            <span>{display.referenceLabel}</span>
            <strong>{submissionResult.referenceCode}</strong>
          </div>
          <CopyReferenceButton referenceCode={submissionResult.referenceCode} />
        </div>
      ) : null}

      <p className="resultDisclaimer">{nonDiagnosticDisclaimer}</p>
    </section>
  );
}

function EmergencyBanner() {
  return (
    <div className="emergencyResultBanner" role="alert">
      <div className="emergencyResultBannerHeader">
        <span className="emergencyIcon" aria-hidden="true">△</span>
        <span className="emergencyPill">EMERGENCY</span>
      </div>
      <h2>Your answers describe an emergency.</h2>
      <strong>Go to the nearest emergency department now.</strong>
      <p>{emergencySecondaryCopy}</p>
    </div>
  );
}

function UrgentBanner({ whatsappLink }: { whatsappLink: string | null }) {
  return (
    <div className="urgentResultBanner" role="alert">
      <span className="urgentIcon" aria-hidden="true">◷</span>
      <div>
        <span className="urgentLabel">URGENT · GET HELP TODAY</span>
        <p>{urgencyContent.urgent}</p>
      </div>
      {whatsappLink ? (
        <a className="urgentWhatsAppButton" href={whatsappLink} rel="noreferrer" target="_blank">
          Chat with a nurse on WhatsApp
        </a>
      ) : null}
    </div>
  );
}

function CopyReferenceButton({ referenceCode, variant = "light" }: { referenceCode: string; variant?: "dark" | "light" }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyReferenceCode() {
    if (!navigator.clipboard?.writeText) {
      setCopyState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(referenceCode);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2600);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="copyReferenceControl">
      <button className={`copyReferenceButton copyReferenceButton-${variant}`} onClick={copyReferenceCode} type="button">
        {copyState === "copied" ? "Copied" : "Copy"}
      </button>
      {copyState === "copied" ? <Toast>Reference code copied</Toast> : null}
      {copyState === "failed" ? <p className="copyReferenceError" role="alert">Reference code could not be copied.</p> : null}
    </div>
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
  const normalizedEntries: Array<[string, FieldValue]> = [];

  for (const [key, value] of Object.entries(responses)) {
    if (key === "heightFeet" || key === "heightInches") {
      continue;
    }

    if (key === "age" || key === "heightCm" || key === "weightKg") {
      if (key === "heightCm") {
        const heightCm = Number(value);
        const hasMetricHeight = Number.isFinite(heightCm) && heightCm > 0;

        normalizedEntries.push([key, hasMetricHeight ? heightCm : convertImperialHeightToCm(responses)]);
        continue;
      }

      normalizedEntries.push([key, Number(value)]);
      continue;
    }

    if (key === "waistCircumferenceCm" && value !== "unknown") {
      normalizedEntries.push([key, Number(value)]);
      continue;
    }

    if (typeof value === "string") {
      normalizedEntries.push([key, responseValueAliases[key]?.[value] ?? value]);
      continue;
    }

    normalizedEntries.push([key, value]);
  }

  return Object.fromEntries(normalizedEntries);
}

function convertImperialHeightToCm(responses: Responses) {
  const feet = Number(responses.heightFeet);
  const inches = Number(responses.heightInches);

  return Math.round((feet * 12 + inches) * 2.54);
}

function getNumberFieldLabel(question: Question) {
  const labels: Record<string, string> = {
    age: "Age",
    heightCm: "Height",
    waistCircumferenceCm: "Waist",
    weightKg: "Weight",
  };

  return labels[question.id] ?? question.inputSuffix ?? "Value";
}

function hasAnsweredQuestion(question: Question, value: FieldValue | "") {
  if (question.kind === "height_imperial") {
    const [feetValue, inchesValue] = String(value).split(":");
    const feet = Number(feetValue);
    const inches = Number(inchesValue);
    const heightCm = convertImperialHeightToCm({ heightFeet: feetValue, heightInches: inchesValue });

    return (
      feetValue.trim() !== "" &&
      inchesValue.trim() !== "" &&
      Number.isFinite(feet) &&
      feet > 0 &&
      Number.isFinite(inches) &&
      inches >= 0 &&
      inches < 12 &&
      heightCm >= 50 &&
      heightCm <= 250
    );
  }

  if (question.kind === "number") {
    const numberValue = Number(value);

    return (
      String(value).trim() !== "" &&
      Number.isFinite(numberValue) &&
      numberValue >= (question.min ?? 1) &&
      (question.max === undefined || numberValue <= question.max)
    );
  }

  return value !== "";
}

function stripNumericInput(value: string) {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

# Design handoff audit

This audit compares the current app against `design_handoff_screening_tool/README.md` and all images in `design_handoff_screening_tool/screenshots/`. No production code has been changed.

## Implementation decisions from review

- Keep the existing routes. Do not rename routes or add route migrations for the handoff paths.
- Keep the existing `CST-` reference format. Do not switch to the handoff `KYR-XXXX-XXXX` placeholder format.

## 1. Stack summary

| Area | Current app |
|---|---|
| Framework | Next.js App Router `16.3.0`, React `19.2.8`, TypeScript `^5`. |
| Styling approach | Plain global CSS classes in `app/globals.css`; no Tailwind, CSS Modules, Sass, or component-scoped styles. |
| Font loading | No `next/font`; body uses system stack: `"Avenir Next", Avenir, "Segoe UI", sans-serif`. Mono text uses `ui-monospace, SFMono-Regular, Menlo, monospace`. |
| Component library | None. Controls, tables, badges, cards, and form fields are hand-written React/HTML. |
| Global styles | `app/globals.css`, imported by `app/layout.tsx`. Design tokens are CSS custom properties under `:root`, but names and values do not match the handoff tokens. |
| Data/scoring | Server-side API in `app/api/assessments/route.ts`; scoring in `lib/scoring.ts` and `lib/scoring-rules.ts`; Prisma/Postgres models in `prisma/schema.prisma`. |
| Auth | Nurse dashboard is under `/dashboard`; login/session logic in `app/dashboard/actions.ts` and `lib/nurse-auth.ts`; rate limiting via `lib/rate-limit.ts`. |

## 2. Screen map

| Handoff screen | Handoff route | Current route | Existing component/files |
|---|---:|---:|---|
| Intro + consent | `/screening` | `/` | `app/page.tsx`, `app/questionnaire-form.tsx` (`QuestionnaireForm`, intro branch), `app/globals.css`. |
| Question step | `/screening` | `/` | `app/questionnaire-form.tsx` (`QuestionnaireForm`, `QuestionCard`, `NumberQuestion`, `HeightQuestion`, `OptionQuestion`), `app/globals.css`. |
| Result | `/screening` | `/` after submission | `app/questionnaire-form.tsx` (`ResultSummary`), `app/result-content.ts`, `app/api/assessments/route.ts`, `app/globals.css`. |
| Nurse login | `/nurse/login` | `/dashboard/login` | `app/dashboard/login/page.tsx`, `app/dashboard/actions.ts`, `lib/nurse-auth.ts`, `app/globals.css`. |
| Queue | `/nurse` | `/dashboard` | `app/dashboard/page.tsx`, `app/dashboard/assessment-row.tsx`, `app/dashboard/actions.ts`, `app/dashboard/require-session.ts`, `app/globals.css`. |
| Assessment detail | `/nurse/[ref]` | `/dashboard/assessments/[id]` | `app/dashboard/assessments/[id]/page.tsx`, `app/dashboard/require-session.ts`, `app/globals.css`. |

## 3. Component map

| Handoff component | Current equivalent |
|---|---|
| Primary button | `.primaryButton`, `.submitButton`, `.startButton` in `app/globals.css`; used across public and dashboard flows. |
| Secondary button | `.secondaryButton` in `app/globals.css`; used for Back, Start over, Clear, Sign out. |
| Option tile | `OptionQuestion` button with `.optionTile` / `.selected`. |
| Yes/no tile | Same `OptionQuestion` + `.optionGrid-yes_no`; not a distinct component. |
| Number field | `NumberQuestion`; height has separate `HeightQuestion`. |
| Progress bar | Inline markup in `QuestionnaireForm` using `.progressBlock`, `.progressTrack`, `.progressFill`. |
| Step controls | Inline `.quizActions` Back/Next buttons in `QuestionnaireForm`. |
| Urgency banners | Public: `<p className="urgent urgent-{urgency}">`; dashboard detail: `.urgencyBanner urgencyBanner-{urgency}`. |
| Status chip | Missing as a dedicated component. Current public result uses text eyebrow, not the handoff chip treatment. |
| `FLAG` badge | `.flagBadge`; current color is danger red, not handoff ink. |
| `URGENT` badge | `.urgencyBadge urgencyBadge-urgent`. |
| `EMERGENCY` badge | `.urgencyBadge urgencyBadge-emergency`. |
| Stat card | `dashboardStats` children in `app/dashboard/page.tsx`. |
| Queue row | `AssessmentRow` table row in `app/dashboard/assessment-row.tsx`. |
| Queue card | Missing; mobile uses the same table layout collapsed/scrolling, not separate cards. |
| Toast | Missing. Copy actions are not implemented, so there is no toast. |

## 4. Behaviour gaps

| Gap | Current behaviour | Classification |
|---|---|---|
| Routes differ | Handoff names `/screening`, `/nurse`, `/nurse/login`, `/nurse/[ref]`; app uses `/`, `/dashboard`, `/dashboard/login`, `/dashboard/assessments/[id]`. Review decision: keep current routes. | Touches logic/routes/auth; intentionally not a redesign target. |
| Public header | No Custodia sticky header; public flow is inside one centered panel. | Visual only, unless wordmark restart is added. |
| Wordmark restart | Handoff says clicking wordmark restarts the flow; current app has no wordmark in public flow. | Touches UI state logic. |
| Intro layout | Current intro is a single panel with gradient background; handoff is split hero + consent card with header. | Visual only. |
| Consent control semantics | Current consent is a native checkbox inside `<label>`; handoff wants whole-row `role="checkbox"` styling. | Mostly visual/accessibility. |
| Disabled start helper | Handoff shows “Tick the box above to start.”; current app only disables Start. | Visual/copy. |
| One breakpoint | Handoff uses 760px; current CSS uses 720px. | Visual only. |
| Question shell | Current desktop and mobile both use `.panel.quizPanel`; handoff wants desktop card and mobile no-card ground layout with sticky controls. | Visual only. |
| Sticky mobile controls | Current controls are inline, not sticky bottom. | Visual only. |
| Progress ARIA | Current progress is divs without `role="progressbar"`. | Accessibility. |
| Branch step label | Current always says “Question 1 of 1” until branch selected; handoff wants “Question 1” and later total path length. | Visual/copy/state display. |
| Branch help text | Current branch includes helper “This helps us choose the right questions for you.”; handoff says no live help text. | Visual/copy. |
| Focus management | Handoff moves focus to question heading per step and result H1 on mount; current app only auto-focuses some inputs. | Accessibility. |
| Option radio semantics | Current option groups use `role="group"` and buttons; handoff wants `role="radiogroup"` / `role="radio"`, `aria-checked`, and arrow-key movement. | Accessibility/interaction logic. |
| Yes/no auto-advance | Current yes/no selection does not auto-advance; user must press Next. | Touches UI flow logic. |
| Branch answer reset | Current branch changes reset downstream answers and idempotency state. | Already aligned. |
| Numeric validation timing | Current client only requires `> 0`; server enforces broader plausible ranges. Handoff wants per-question min/max, stripped non-numeric input, inline errors, and Enter submit. | Touches validation/UI logic. |
| Number draft state | Handoff separates `numberDraft` and `fieldError`; current stores responses directly. | Touches UI state logic. |
| Height input | Current asks height in feet/inches then converts to cm; handoff asks one cm field. | Touches question/input logic. |
| Waist input | Current is a single-select with preset values plus “I don't know”; handoff is numeric cm field. | Touches question/input logic and scoring input shape. |
| Submitting state | Current button says `Scoring...` and Back remains enabled; handoff wants spinner, `Scoring…`, and Back disabled. | Touches UI logic. |
| Submission error copy/persistence | Current catch says “Assessment could not be submitted. Please try again.”; handoff wants “We couldn't send your answers. Your answers are saved on this screen; check your connection and try again.” Current answers are retained. | Copy/UI. |
| Screen enter/motion | Handoff specifies transitions and reduced-motion behavior; current has hover transitions only. | Visual/accessibility. |
| Result card order | Current result is one panel with sections; handoff has separate ordered cards. | Visual only. |
| Emergency result | Current emergency is an alert paragraph inside normal result panel, not a replacement red emergency card. | Visual/copy. |
| Urgent result | Current urgent is an alert paragraph; handoff wants amber alert card with WhatsApp CTA. | Visual/UI logic. |
| Higher complication handoff | Current WhatsApp link appears for `diabetes_high` only if `NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER` exists, but no reference-code handoff card or privacy line is shown. | Touches UI/env behavior. |
| Reference code on public result | Current submission returns a code but `ResultSummary` does not display it. | Touches UI logic. |
| Copy-to-clipboard | Missing reference-code Copy button, copied label, and toast. | Touches UI logic. |
| WhatsApp message | Current message includes completed-screening text and request to chat; handoff wants `Hello, my screening reference is {REF}` only. | Touches external link behavior. |
| Plan clinical screening CTA | Current renders higher diabetes CTA as non-link paragraph; handoff wants a CTA link/button. | Touches UI/navigation when target is decided. |
| Nurse route auth guard | Current guard works under `/dashboard`, not `/nurse`. | Touches routes/auth. |
| Nurse login Show/Hide | Current password field has no Show/Hide toggle. | Touches UI logic. |
| Nurse login lockout UI | Current rate limit exists after 5 attempts per IP over 5 minutes, but message says “Wait a few minutes,” not “Try again in 15 minutes,” and input is not disabled. | Touches auth UX; lockout duration differs from handoff. |
| Login prototype hint | Current production page has no prototype password hint. | Already aligned. |
| Nurse header | Current dashboard header is inside the panel; handoff wants sticky top header with wordmark, title, sign out. | Visual/layout. |
| Queue search param | Current uses `?reference=`; handoff specifies nurse state in URL as `?ref=`. | Touches route/query behavior. |
| Search validation | Current invalid format replaces page contents with a generic invalid-reference empty state; no empty-input message because empty submits show all. Handoff wants empty and wrong-format validation messages near search. | Touches UI/search logic. |
| Exact reference format | Current supports `CST-` 12-char references and legacy 8-char hex references; handoff specifies `KYR-XXXX-XXXX`. Review decision: keep current `CST-` format. | Touches data/reference/search logic; intentionally not a redesign target. |
| Stat cards | Current has 2-column CSS by default and no emergency/urgent split text; handoff wants 3 columns and urgent card emphasis with counts split. | Visual and query aggregation. |
| Dashboard table columns | Current table has 8 columns and no chevron column; rule version includes branch text. Handoff wants 9-column grid/table with score right-aligned and separate rule. | Visual/UI. |
| Dashboard footer | Current only shows Next pagination when more than 50; no “Showing N of N”. | Visual/copy. |
| Mobile queue cards | Missing; current table remains table. | Visual/responsive behavior. |
| Queue row aria-label | Current says “Open assessment {ref} submitted {date}”; handoff wants urgency/flag/classification/reference included. | Accessibility. |
| Empty states | Current empty states are short text in `.emptyState`; handoff wants icon tile, title, description, and clear-search link for no match. | Visual/copy. |
| Detail URL by reference | Handoff detail is by `{ref}`; current opens by database UUID. Review decision: keep current routes. | Touches route/data lookup; intentionally not a redesign target. |
| Detail layout | Current summary and score breakdown are side-by-side equal-ish columns; provenance is embedded in summary, not separate side card. | Visual/layout. |
| Detail anonymized state | Current shows anonymized message, but not the dashed lock-icon box and exact copy. | Visual/copy. |
| Raw JSON label | Current says “Raw response JSON”; handoff says “Show raw JSON”. | Copy. |
| Provenance display | Current truncates ruleset hash; handoff shows full hash in a provenance card. | Touches UI/data display. |

## 5. Copy differences

### Public intro and shell

| Handoff copy | Current copy |
|---|---|
| Wordmark/header: `custodia` + `PRIVATE SCREENING` | Missing on public flow. |
| Chip: `Free` + `Diabetes risk triage` | Current only eyebrow `Diabetes risk triage`; no `Free` pill. |
| H1: `Know Your Risk` + separate `Diabetes Screening` | `Know Your Risk | Diabetes Screening`. |
| Lead: `Answer a few short questions to understand your risk of diabetes or, if you already have diabetes, your risk of complications.` | `Get a clearer picture of your current diabetes risk and identify signs that could point to future complications. Your results will help you understand what to do next, and you can also get a free nurse review for personalized guidance.` |
| Meta: `≈ 2 minutes · One question at a time` | Missing. |
| Start button: `Start →` | `Start`. |
| Helper: `Tick the box above to start.` | Missing. |
| Info/disclaimer copy | Same sentence, displayed differently. |
| Consent copy | Same sentence. |

### Question flow

| Handoff copy | Current copy |
|---|---|
| Progress branch first step: `Question 1` | `Question 1 of 1` before branch is selected. |
| Pathway chip: `Risk estimate pathway` / `Diagnosed pathway` | Same words, but plain progress meta text. |
| Branch help: none | `This helps us choose the right questions for you.` |
| Kicker: none in handoff question card | `Diabetes check`. |
| Back: `← Back` | `Back`. |
| Next: `Next →` | `Next`. |
| Final submit: `See my result` | Same. |
| Submitting: `Scoring…` | `Scoring...`. |
| Numeric helper: `Between {min} and {max} {unit}` | Missing. |
| Numeric error: `Enter a number between {min} and {max} {unit}` | Server/API errors use field ids, for example `waistCircumferenceCm is required and must be between 30 and 250, or unknown.` |
| Submission error: `We couldn't send your answers. Your answers are saved on this screen; check your connection and try again.` | `Assessment could not be submitted. Please try again.` |

### Public result

| Handoff copy | Current copy |
|---|---|
| `Lower diabetes risk` title summary: `That's good news. Small daily habits help keep it that way.` | `Keep reinforcing the habits that protect your long-term metabolic health, and repeat screening periodically as your circumstances change.` |
| Lower diabetes next step: `Eat healthy meals with plenty of vegetables.` | `Keep meals centered on vegetables, legumes, whole grains, and unsweetened drinks.` |
| Lower diabetes next step: `Aim for at least 30 minutes of activity most days.` | `Aim for at least 30 minutes of physical activity on most days.` |
| Lower diabetes next step: `Keep to a healthy weight.` | `Maintain a healthy weight and waist circumference where possible.` |
| Lower diabetes next step: `Screen again in a year, or sooner if things change.` | `Re-screen in 12 months, or sooner if a clinician advises it.` |
| Higher diabetes summary: `Your answers suggest an elevated risk of diabetes. A hospital, clinic or pharmacy can check your blood glucose with a quick test.` | `Your answers suggest elevated diabetes risk. A hospital, clinic, or pharmacy can check your blood glucose and advise you on next steps.` |
| Higher diabetes CTA: `Plan a clinical screening visit →` | `Plan a clinical screening visit` shown as callout text, not a link. |
| Higher diabetes next steps: `Ask for a blood glucose or HbA1c test in the next few weeks.` / `Bring your reference code so staff can see this screening.` | `Ask for a blood glucose or HbA1c test rather than relying on symptoms alone.` / `Take note of any family history, previous high glucose readings, or blood pressure medication before the visit.` / `Keep up daily movement and balanced meals while you arrange screening.` |
| Lower complication summary: `Keep up your routine care. It protects you over the long term.` | `Keep following your diabetes care routine and stay connected with routine checkups so changes are caught early.` |
| Higher complication summary: `You may need timely support for diabetes-related symptoms or possible complications. A nurse can help you decide what to do next.` | `This means you may need timely support for diabetes-related symptoms or possible complications. Chat with a nurse so they can review your answers and guide your next steps.` |
| Higher complication next steps: `Message a nurse today with your reference code.` / `Keep taking your medication as prescribed.` | `Keep taking prescribed medication unless a clinician tells you otherwise.` / `Seek urgent care now...` / `Have your recent symptoms... ready for the nurse.` |
| Emergency title: `Your answers describe an emergency.` | Included in combined alert text, not a title. |
| Emergency strong line: `Go to the nearest emergency department now.` | Included in same alert sentence. |
| Emergency secondary line: `If you can't get there safely, ask someone to take you or call emergency services.` | Missing on current public result. |
| Urgent label: `URGENT · GET HELP TODAY` | Current alert has no label; text only. |
| Urgent copy | Same sentence. |
| Reference labels: `Your reference code` / `Show this code to staff` | Missing on public result. |
| Copy toast: `Reference code copied` | Missing. |
| Privacy line: `Only this code is shared in the message. Your answers stay private.` | Missing. |
| WhatsApp message: `Hello, my screening reference is {REF}` | `Hello, I completed the diabetes screening. My reference code is {REF}, and I would like to chat with a nurse.` |

### Nurse login

| Handoff copy | Current copy |
|---|---|
| Empty error: `Enter your password.` | `Enter the nurse dashboard password.` |
| Wrong password: `That password isn't right. Try again.` | `That password did not match the nurse dashboard password.` |
| Lockout: `Too many attempts. Try again in 15 minutes.` | `Too many sign-in attempts. Wait a few minutes and try again.` |
| Link: `← Return to screening` | `Return to screening`. |
| `Show` / `Hide` toggle | Missing. |
| Prototype hint removed in production | Current app has no prototype hint. |
| Footer note | Same sentence. |

### Queue

| Handoff copy | Current copy |
|---|---|
| Description: `Every submitted assessment is visible here, newest first. High-risk diabetes cases are flagged for follow-up, and red-flag cases are marked urgent or emergency.` | Same except line wrapping only. |
| Search placeholder: `Enter full reference code` | Same. |
| Empty search error: `Enter a reference code to search.` | Missing. |
| Format error: `Enter the full code, e.g. KYR-7F3K-92QD` | Current invalid state: `"{query}" is not a valid reference code.` |
| No assessments: `No assessments yet` + `New screenings will appear here as soon as they're submitted, newest first.` | `No assessments have been submitted yet.` |
| No match: `No assessment matches {REF}` + `Check each character and try again. Search needs the full reference code.` + `Clear search and show all` | `No assessment matches reference {REF}.` |
| Footer: `Showing N of N` | Missing. |
| No flag glyph: `—` | Current uses `-`. |
| Score override: `Override` | Same. |
| Statuses: `Routine`, `URGENT`, `EMERGENCY`, `FLAG` | Current has `Routine`, `Urgent`, `Emergency`, `FLAG`; table displays `-` for routine urgency. |

### Assessment detail

| Handoff copy | Current copy |
|---|---|
| Link: `← Back to all assessments` | `Back to all assessments`. |
| Header meta labels: `Reference`, `Submitted` | Current sentence: `Reference {ref} · Submitted {date}`. |
| Emergency banner copy | Same sentence. |
| Urgent banner copy | Same sentence. |
| Summary score override format: `{n} · overridden` | Current score is `Override` when null; otherwise number only. |
| Raw JSON summary: `Show raw JSON` | `Raw response JSON`. |
| Anonymized box title/body | Current: `Responses were anonymised on {date} under the data retention policy. The clinical result above is retained.` |
| Provenance labels | Current labels exist but are inside Summary and hash is truncated. |

## 6. Question/scoring differences

The README scoring weights are placeholders; current scoring rules are treated as source of truth for implementation. Differences to preserve/handle carefully:

### Reference code

| Area | Handoff | Current app |
|---|---|---|
| Prefix/format | `KYR-` + 4 + `-` + 4 from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. | `CST-` + 12 chars from `0123456789ABCDEFGHJKMNPQRSTVWXYZ`; search also accepts legacy `CST-` + 8 hex. |

### Branch and Path A questions

| Handoff | Current app |
|---|---|
| Branch id `diabetesStatus`; option values `no` / `yes` in README prose. | Uses `diabetesStatus`; values `not_diagnosed` / `diagnosed`. |
| Branch has no help text. | Branch helper: “This helps us choose the right questions for you.” |
| `age`, number years 18–110. | `age`, number; client min > 0, server range 1–120. |
| `height`, number cm 100–250. | `heightCm` is generated from `heightFeet` + `heightInches`; server range 50–250. |
| `weight`, number kg 30–250. | `weightKg`; server range 10–400. |
| `sex`, question “What sex were you assigned at birth?”, options Female / Male, help “This changes how waist size is scored.” | `sex`, question “What is your sex?”, options Male / Female, no help. |
| `waist`, number cm 50–200. | `waistCircumferenceCm`, single-select options `unknown`, `70`, `80`, `88`, `94`, `102`, `110`; server accepts number 30–250 or `unknown`. |
| `activity`, yes/no, “Do you get at least 30 minutes of physical activity most days?” with help. | `dailyPhysicalActivity`, yes/no, “Do you move or exercise for at least 30 minutes most days?”, no help. |
| `veg`, yes/no, “Do you eat vegetables or fruit every day?” | `dailyFruitOrVegetableIntake`, “Do you eat fruit or vegetables every day?” |
| `bpmed`, yes/no, “Have you ever taken medicine for high blood pressure?” | `historyOfBloodPressureMedication`, “Have you ever been prescribed medicine for high blood pressure?” |
| `glucose`, yes/no with example help. | `historyOfHighBloodGlucose`, same question, no example help. |
| `family`, options: No / Yes, extended family (Grandparent, aunt, uncle, cousin) / Yes, close family (Parent, brother, sister, child). | `familyHistory`, options: No / Grandparent, aunt, uncle, or cousin / Parent, sibling, or child. |

### Path B questions

| Handoff | Current app |
|---|---|
| `foot`, “Do you have a wound or sore on your foot that is not healing?” with help. | `foot_wound_or_ulcer`, “Do you have a foot sore or wound that is not healing?”, no help. |
| `vision`, “Have you had sudden vision loss or blurry vision?” | `sudden_vision_loss_or_blurring`, same wording. |
| `dka`, “Do you have nausea, vomiting, fast breathing or confusion right now?” | `ketoacidosis_symptoms`, “Do you have nausea, vomiting, fast breathing, or confusion?” (no “right now”). |
| `chest`, “Do you have chest pain or trouble breathing right now?” | `chest_pain_or_shortness_of_breath`, “Do you have chest pain or trouble breathing?” (no “right now”). |
| `hba1c`, options Below 7% / 7% to 9% / Above 9% / I don't know. | `hba1cControl`, options `known_good`, `known_elevated`, `unknown`; labels “Yes, it is in range” / “Yes, but it is high” / “I don't know”. |
| `highlow`, options Rarely or never / Once or twice a month / Every week. | `glucoseEpisodeFrequency`, labels “Rarely” / “About once a month” / “Every week or more”. |
| `duration`, labels Less than 5 years / 5 to 10 years / More than 10 years. | `diabetesDuration`, labels “Under 5 years” / “5 to 10 years” / “Over 10 years”. |
| `bp`, labels Yes / No / I don't know. | `bloodPressureControl`, labels same, values `controlled` / `uncontrolled` / `unknown`. |
| `smoke`, labels Never / I used to / Yes, I smoke now. | `smokingStatus`, labels “No” / “I used to smoke” / “Yes, I smoke now”. |
| `neuro`, “Do you have numbness, tingling or burning in your feet?” | `neuropathySymptoms`, “Do you have numbness, tingling, or reduced feeling in your hands or feet?” |
| `retino`, “Has a health worker told you diabetes is affecting your eyes?” | `retinopathySymptoms`, “Do you have blurry vision or trouble seeing at night?” |
| `nephro`, “Has a health worker told you diabetes is affecting your kidneys?” | `nephropathySignals`, “Do you have swelling, foamy urine, or unusual tiredness?” |
| `adherence`, choice Rarely or never / A few times a month / Most weeks. | `medicationAdherence`, yes/no “Do you take your diabetes medicine as prescribed?”; scoring applies when false. |
| `checkup`, choices In the last 6 months / 6 to 12 months ago / More than a year ago / Never, or I'm not sure. | `lastCheckup`, only “Within the past year” / “More than a year ago”. |

### Scoring/rule differences

| Area | Handoff placeholder | Current app |
|---|---|---|
| Path A source | Placeholder structure similar to FINDRISC. | `riskOfDiabetesRules.source = "FINDRISC"`, high-risk cutoff `12`. |
| Path A age minimum | 18 years. | Server accepts age `1–120`; bands start below 45. |
| Waist unknown | Not listed. | Supported as `unknown`, scores 0. |
| Path B high-risk cutoff | Placeholder threshold not specified in README text. | `complicationRiskRules.highRiskCutoff = 6`. |
| Red flag overrides | Chest/dka emergency; foot/vision urgent; any override forces higher complication risk. | Same override structure and precedence. |
| Override score | README stored record has `score`; table shows `Override` when urgency is not routine. | Current stores `score: null` for red-flag overrides and displays `Override`. |
| Stored record fields | README includes `ref`, `submittedAt`, `diagnosed`, `classification`, `urgency`, `flag`, `score`, `factors[]`, `responses[]`, `rawAnswers`, `ruleVersion`, `questionnaireVersion`, `rulesetHash`, `anonymizedAt?`. | Database stores reference, createdAt, diabetesStatus, classification, urgency, score, contributingFactors, redFlags, raw normalized `responses`, scoring rule relation, questionnaireVersion, rulesetHash, engineVersion, anonymizedAt. No separate preformatted `responses[]` or stored `flag`; flag is derived. |
| Rule versions shown in screenshots | Example `v2.3`, questionnaire `q-2026.10`. | Code has `versionNumber: 1`, `QUESTIONNAIRE_VERSION = "2026-08-01"`, `SCORING_ENGINE_VERSION = "1.0.0"`. Seed/database may map version display from stored rule rows. |

## 7. Risks

| Risk | Notes |
|---|---|
| Shared global CSS | `app/globals.css` styles public flow, auth, queue, and detail with shared classes (`.panel`, `.primaryButton`, `.secondaryButton`, `.errorBox`, `.disclaimer`). Visual changes can unintentionally affect multiple screens. |
| Shared buttons | The same button classes are used by public questionnaire and dashboard auth/search/sign-out. Updating to handoff dimensions/radii needs screen-specific wrappers or variants. |
| Route rename risk | Moving `/dashboard` to `/nurse` or `/` to `/screening` affects auth redirects, form actions, links, middleware/headers, tests, and any bookmarked nurse links. |
| Detail key change | Handoff detail by reference conflicts with current UUID detail route. Changing lookup must preserve audit logging and avoid exposing invalid reference behavior. |
| Reference format | Switching `CST-` to `KYR-XXXX-XXXX` affects DB uniqueness, search normalization, tests, existing records, nurse workflows, and any generated WhatsApp/reference copy. |
| Scoring inputs tied to UI | `validateAssessmentSubmission`, `scoreAssessment`, and stored response normalization expect current keys and values. UI-only redesign must not silently rename payload fields unless server mapping is preserved. |
| Height/waist redesign | Handoff cm fields differ from current imperial height and waist presets. Changing inputs can alter normalized values and therefore scoring if not mapped carefully. |
| Red-flag overrides | Public result redesign must preserve urgent/emergency precedence and `score: null`/Override semantics for dashboard rows and detail. |
| Rate-limit/auth behavior | Login lockout copy/design differs from current 5-minute IP window. Extending to 15 minutes or disabling inputs changes auth behavior and tests. |
| Audit hooks | Dashboard list/detail and searches call `recordAuditEvent`. Redesigns must keep audit events, actor session IDs, resource IDs, IP hash, and user agent behavior intact. |
| Idempotency | Public submission uses `Idempotency-Key` and replay handling. Refactoring submit state or retry behavior must preserve this. |
| Rate limits | Assessment submit and nurse login rate limits are server-side. UI retry/auto-submit changes must not cause accidental extra submissions. |
| Tests | Existing tests cover scoring, hashing, password hashing, idempotency, reference codes, and rate-limit windows. Design work touching reference-code format, scoring input keys, or auth lockout will require test updates. |
| No snapshots found | No current snapshot tests were found in the inspected file list, but DOM/class changes can still affect CSS assumptions and accessibility tests if added later. |
| CSP | `next.config.ts` uses strict headers; adding external fonts, icon libraries, WhatsApp links, or analytics may need CSP review. `next/font` is safe if self-hosted by Next. |
| Environment-dependent WhatsApp | Current nurse WhatsApp link is absent unless `NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER` is set; handoff prototype uses no number. Design implementation must define launch behavior. |
| Anonymization | Retention script clears responses but keeps classification/provenance. Detail redesign must render anonymized records safely without assuming response JSON exists. |
| Mobile dashboard | Replacing table with cards may duplicate row/link logic; keep keyboard/focus behavior and exact navigation consistent. |
| Accessibility semantics | Replacing native inputs/buttons with tile roles can regress keyboard and screen-reader behavior unless implemented deliberately. |

## Proposed phase order

1. **Foundation without behavior changes**: add design tokens, Geist `next/font`, global body/header primitives, button/card/badge variants, and responsive breakpoint scaffolding while preserving routes and payloads.
2. **Public screening visual shell**: rebuild intro, header, question card/mobile layout, progress, tiles, number-field presentation, and result cards against existing state and submission logic.
3. **Public interaction/accessibility pass**: add focus management, radiogroup semantics/arrow keys, numeric draft validation messages, submit spinner/back disabling, copy-to-clipboard toast, and WhatsApp/reference UI without changing scoring.
4. **Nurse visual shell**: rebuild login, sticky nurse header, queue stats/table, mobile cards, empty states, badges, and detail/provenance/anonymized layouts around current auth/data queries.
5. **Preserve route/reference compatibility**: keep existing routes (`/`, `/dashboard`, `/dashboard/login`, `/dashboard/assessments/[id]`) and existing `CST-` reference codes while applying only visual/copy/layout changes around them.
6. **Copy and final QA**: align approved copy, update targeted tests for any intentional behavior changes, run typecheck/tests/build, then cross-check at 390, 820, and 1280 widths.

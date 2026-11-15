# Handoff: Custodia — Know Your Risk Diabetes Screening (Next.js)

## Overview
A free, mobile-first diabetes risk triage tool with two audiences:

1. **Public screening**: consent, then one question per screen. The first question ("Do you already have diabetes?") sends the person down one of two paths:
   - **Risk estimate pathway** (not diagnosed): 10 questions, scores the risk of type 2 diabetes.
   - **Diagnosed pathway**: 14 questions, scores the risk of complications and checks for red flags (urgent and emergency overrides).
   The person then sees a result with next steps and a reference code (`KYR-XXXX-XXXX`).
2. **Nurse dashboard**: password-protected. Shows a shared queue of every submitted assessment (newest first), lets nurses search by full reference code, and opens a detail view with the score breakdown, full responses and provenance.

The tool uses the **same design tokens as the Custodia landing page** (`design_handoff_custodia_landing/`). If both live in one Next.js app, share one token file and one `next/font` setup.

## About the design files
Everything in `reference/` is a **design reference built in HTML**. It shows the intended look and behaviour; it is not production code.
- `Custodia Screening Prototype.dc.html` is the full interactive prototype. It works at any width: below 760px it uses the phone layout. Serve the folder (`npx serve reference`) and open it.
  - Add `?view=nurse` to the URL to open nurse sign-in (prototype password: `nurse`). Add `?view=dash` to skip sign-in.
  - In the browser console, `__screening.demo('<state>')` jumps to a state. States: `intro`, `branch`, `yesno`, `number`, `error`, `result-lower`, `result-higher`, `result-urgent`, `result-emergency`, `login`, `dash`, `detail`.
- `Custodia Screening Tool.dc.html` is the static design board: tokens, components, states and accessibility notes.

Recreate the tool in **Next.js (App Router) + TypeScript**. Recommended: Tailwind CSS (or CSS Modules), `next/font` for Geist / Geist Mono, a server-side scoring module, and a database for submissions. Don't port the prototype's runtime (`support.js`, `{{ }}` template holes, `localStorage` persistence, `__screening` hook); those exist only to make the prototype run.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy, states and responsive behaviour are final. **Exceptions (placeholders, must be replaced before launch):**
- **Scoring weights and thresholds** (see *Scoring*): they are stand-ins for demonstration only. Replace them with the clinically approved ruleset.
- "Plan a clinical screening visit" link target.
- WhatsApp number (the prototype opens `wa.me/?text=…` with no number).
- Nurse authentication (the prototype uses a single hard-coded password).

## Screenshots
`screenshots/`: desktop at 1280 wide (1×) and phone at 390 wide (2×), full-page captures.

| # | State | Desktop | Mobile |
|---|---|---|---|
| 01 | Intro + consent (ticked) | `desktop-01-intro.png` | `mobile-01-intro.png` |
| 02 | Branch question, option selected | `desktop-02-question.png` | `mobile-02-question.png` |
| 03 | Number question with validation error | `desktop-03-number-error.png` | `mobile-03-number-error.png` |
| 04 | Result: higher diabetes risk | `desktop-04-result-higher-risk.png` | `mobile-04-result-higher-risk.png` |
| 05 | Result: emergency | `desktop-05-result-emergency.png` | `mobile-05-result-emergency.png` |
| 06 | Nurse sign-in | `desktop-06-nurse-login.png` | `mobile-06-nurse-login.png` |
| 07 | Nurse queue (comfortable density) | `desktop-07-nurse-queue.png` | `mobile-07-nurse-queue.png` |
| 08 | Assessment detail (emergency) | `desktop-08-assessment-detail.png` | `mobile-08-assessment-detail.png` |

---

## Suggested structure
```
app/
  layout.tsx                    // Geist + Geist Mono via next/font, base body styles
  screening/
    page.tsx                    // client: <ScreeningFlow/> (intro → questions → result)
    actions.ts                  // server action: submitAssessment(answers) → record
  nurse/
    login/page.tsx              // sign-in form
    page.tsx                    // queue (server component, auth-guarded)
    [ref]/page.tsx              // assessment detail
  middleware.ts                 // protect /nurse/* (session cookie)
components/screening/
  PublicHeader.tsx  Intro.tsx  QuestionStep.tsx  OptionTile.tsx  YesNoTiles.tsx
  NumberField.tsx  ProgressBar.tsx  StepControls.tsx  Result.tsx  UrgencyBanner.tsx
components/nurse/
  NurseHeader.tsx  StatCards.tsx  QueueTable.tsx  QueueCard.tsx  SearchByRef.tsx
  Badges.tsx (Flag, Emergency, Urgent)  AssessmentDetail.tsx
lib/screening/
  questions.ts                  // BRANCH, PATH_A, PATH_B (data below)
  score.ts                      // pure function, versioned (rule + questionnaire versions, ruleset hash)
  results.ts                    // result copy per outcome
  ref.ts                        // reference-code generator
```
Run scoring **on the server** so the stored classification, rule version and ruleset hash can be trusted.

---

## Design tokens
These match the landing page. Names are suggestions.

### Colours
| Token | Hex | Use |
|---|---|---|
| ink | `#112D50` | Headings, body ink, FLAG badge, nurse-handoff card bg, toast |
| primary | `#236DAD` | Primary buttons, selected tile border/check, progress fill, eyebrows, links |
| primary-hover | `#1B5A90` | Primary button hover |
| accent | `#4F9EEA` | Wordmark, focus ring, WhatsApp button on navy, option-tile hover border |
| accent-hover-on-navy | `#7DB7F0` | Hover for accent button on navy |
| soft-blue | `#DBEBFB` | Pathway chip bg, step-number circles, empty-state icon bg |
| line-blue | `#A8CCF2` | Unselected radio ring, unticked checkbox, dashed reference box |
| ground | `#F0F7FF` | Page background (public + nurse), info boxes, factor chips |
| surface | `#FFFFFF` | Cards, tiles, inputs |
| table-head | `#F7FAFE` | Queue header row, raw JSON box, hash box |
| row-hover | `#EFF2FA` | Queue row hover |
| border | `#E3E9F2` | Card borders, dividers, control-bar top border |
| border-strong | `#D6E2F0` | Inputs, unselected tiles, outline buttons, progress track |
| disabled-bg | `#E3E9F2` | Disabled button bg |
| disabled-text | `#8597AA` | Disabled text, placeholders, "—" no-flag |
| text-body | `#4B5D70` | Paragraphs, labels, meta |
| on-navy-1 | `#B5C3D3` | Small text on navy card |
| on-navy-2 | `#93A3B8` | Eyebrow on navy card |
| navy-line | `#2E4F78` | Copy button border on navy card |

**Clinical status:** always pair colour with an icon and a word.
| Status | Text | Bg | Line / solid |
|---|---|---|---|
| Lower risk | `#1E6B47` | `#E6F4EC` | — |
| Higher risk / Urgent | `#8A4B08` (strong text `#5C3205`) | `#FFF4E3` (row tint `#FFF7EA`) | line `#E59A2F`, icon disc `#C26A0A` |
| Emergency | `#fff` on `#B42318` | tint `#FDEDEB` | solid `#B42318`, text-on-tint `#8F1D13`, soft border `#F1B5AE`, on-red secondary text `#FFE3DF` |
| Error | `#8F1D13` | `#FDEDEB` | field border `#B42318`, box border `#F1B5AE` |

### Typography
Geist 400/500/600/700; Geist Mono 500/600. Body `-webkit-font-smoothing: antialiased`; `text-wrap: pretty` on headings and paragraphs.

| Role | Desktop | Mobile |
|---|---|---|
| Intro H1 "Know Your Risk" | 600 80px / .98, ls −0.05em | 46px |
| Intro H1 sub "Diabetes Screening" (primary colour, block, mt 12) | 48px, ls −0.04em | 30px |
| Intro lead | 400 20px / 1.55, `#4B5D70`, max-width 520 | 18px |
| Question heading | 600 36px / 1.12, ls −0.035em | 30px |
| Question help | 400 17px / 1.5, `#4B5D70` | same |
| Result page H1 | 600 40px / 1.1, ls −0.04em | 30px |
| Result card title | 600 26px / 1.15, ls −0.03em | same |
| Emergency title | 600 30px / 1.1 | same |
| Card H3 | 600 20px / 1.2, ls −0.02em | same |
| Nurse H1 | 600 40px / 1.05, ls −0.04em | 30px |
| Option label | 600 18px; sub-label 400 15px `#4B5D70` | same |
| Yes/No label | 600 22px, ls −0.02em | same |
| Number input value | 600 34px, ls −0.03em, tabular-nums | same |
| Body / list | 16–17px / 1.5 | same |
| Eyebrow | Geist Mono 500 12px, ls .06em, uppercase, primary | same |
| Badge text | Geist Mono 600 11px, ls .08em, uppercase | same |
| Reference code | Geist Mono 500 14–22px, ls .02–.04em | same |
| Queue cell | 14px; score/rule Geist Mono 13px | — |

### Spacing, radii, shadows
- 4px base. Gutters: 20px phone (public), 16px phone (nurse), 32–40px desktop. Card padding 24. Tile gap 12. Section gap 16–28.
- Radii: buttons / chips / pills `999px`; option tiles and inputs `20px`; result cards `28px`; question card (desktop) and intro card `32px` (mobile intro card 24); nurse cards `24px`; stat cards 24 (16 mobile); FLAG badge `6px`; password input 16.
- Shadows: primary button `0 10px 24px rgba(35,109,173,.25)`; selected tile `0 6px 18px rgba(35,109,173,.14)`; floating cards `0 24px 60px rgba(17,45,80,.08)`; desktop header pill `0 8px 30px rgba(0,0,0,.06)`; toast `0 12px 30px rgba(17,45,80,.25)`.
- Focus: `outline: 3px solid #4F9EEA; outline-offset: 3px` on every control. Inputs on focus: `box-shadow: 0 0 0 4px rgba(79,158,234,.25)`. Queue rows on focus: `inset 0 0 0 3px #4F9EEA`.

---

## Responsive rule
One breakpoint at **760px**. Below it the phone layout is used; at 760px and wider the desktop layout is used. Test at 390, 820 and 1280.

---

## Screens: public

### Header
- **Desktop:** sticky, 14px top / 40px side outer padding. White pill (`radius 999`, 1px `rgba(0,0,0,.06)` border, header shadow), max-width 1200, padding `10px 10px 10px 22px`. Wordmark "custodia" (Geist 700 22px, ls −0.04em, `#4F9EEA`) on the left. On the right: "PRIVATE SCREENING" (Geist Mono 500 11px, uppercase, `#4B5D70`) with a 12px lock icon. On the result screen this is replaced by an outline button **"Start over"** (40px tall, radius 999, 1.5px `#D6E2F0` border, 600 14px).
- **Mobile:** sticky full-width bar on `#F0F7FF`, padding 14px 20px, no pill.
- Clicking the wordmark restarts the flow.

### 1. Intro + consent
- **Desktop:** 2-column grid `1.15fr / 1fr`, gap 72, max-width 1200, padding `64px 40px 32px`, vertically centred.
  - Left: chip (white, 1px `#D6E2F0`, radius 999) containing a **"Free"** pill (primary bg, white 600 13px) and "Diabetes risk triage" (500 14px `#4B5D70`). Then the H1 "Know Your Risk", the block subline "Diabetes Screening", the lead copy and a mono meta row "≈ 2 minutes · One question at a time".
  - Right: white card (radius 32, padding 32, 1px `#E3E9F2`, floating shadow), gap 16:
    1. Info box (`#F0F7FF`, radius 18, padding 16, 16px/1.5 `#4B5D70`, 20px info icon in primary): "This tool does not diagnose. It estimates risk based on your answers."
    2. Consent checkbox row: a whole-row button with `role="checkbox"`, padding 18, radius 18. Border 1.5px `#D6E2F0` when unticked, 2px `#236DAD` when ticked. Box 26×26 radius 8 (unticked: 2px `#A8CCF2` ring; ticked: primary fill + white check). Copy: "I understand this is not a diagnosis and agree my answers may be used for screening and nurse review where appropriate."
    3. **Start →** primary button, 58px tall, full width. Disabled until consent is ticked (disabled bg/text tokens), with the helper text "Tick the box above to start." (14px, centred) below it.
- **Mobile:** single column, gap 28, padding `28px 20px 16px`; card radius 24, padding 20.
- Copy (lead): "Answer a few short questions to understand your risk of diabetes or, if you already have diabetes, your risk of complications."

### 2. Question step
- **Desktop:** centred white card 640 wide (radius 32, 1px border, floating shadow), page padding `32px 40px 56px`. Inner padding `40px 40px 28px`, gap 28. The control bar sits inside the card bottom: padding `20px 40px 28px`, 1px top border. Back is on the left; Next is on the right at its natural width (padding 0 30).
- **Mobile:** no card; the content sits on the ground colour, padding `16px 20px 28px`, min-height fills the viewport. The control bar is **sticky at the bottom** (`#F0F7FF` bg, 1px top border, padding `16px 20px 24px`), and Next stretches (`flex:1`).
- **Progress block** (gap 10):
  - Label in Geist Mono 12px uppercase: "Question 1" on the branch step, then "Question N of T", where T = path length + 1 (11 for the risk pathway, 15 for the diagnosed pathway).
  - Pathway chip from step 2 on (600 12px primary on `#DBEBFB`, radius 999, padding 4×10): "Risk estimate pathway" or "Diagnosed pathway".
  - Bar: 6px track `#D6E2F0`, primary fill, radius 999, `transition: width .3s ease-out`. `role="progressbar"`.
- **Heading** (question) + optional help text.
- **Answer types:**
  - **Choice** (`role="radiogroup"`): stacked tiles, gap 12. Tile min-height 64 (84 with a sub-label), padding 16×18, white, radius 20, 1.5px `#D6E2F0`. Hover: border `#4F9EEA`. **Selected:** 2px `#236DAD` border (reduce padding by 0.5px to avoid shift), selected shadow, and a 24px filled primary circle with a white check. Unselected: 24px ring, 2px `#A8CCF2`.
  - **Yes/No**: 2-column grid, gap 12. Tiles min-height 112, column layout with the indicator top-left and the label (22px) bottom-left. **Auto-advance 250ms after selection.**
  - **Number**: label (600 15px) above a 76px input (radius 20, 2px border `#D6E2F0`, 34px value) with the unit absolutely positioned on the right (500 18px `#4B5D70`). `inputMode="decimal"`, non-numeric characters are stripped, Enter submits. Helper text below: "Between {min} and {max} {unit}". On error: 2px `#B42318` border, `aria-invalid`, and an error line with an icon (500 15px `#8F1D13`, `role="alert"`): "Enter a number between {min} and {max} {unit}".
- **Controls:** "← Back" outline button (56px, padding 0 22, 1.5px `#D6E2F0`, hover border ink). "Next →" primary button (56px), disabled (aria-disabled) until answered. On the last step the label becomes **"See my result"**. While submitting, the button shows a white 18px spinner and **"Scoring…"**, and Back is disabled (text `#8597AA`).
- On each step, move focus to the question heading (`tabIndex=-1`).
- Changing the branch answer after progressing clears all later answers.

### 3. Result
- Layout: column, gap 16. Desktop max-width 720, padding `40px 40px 64px`; mobile padding `16px 20px 40px`. It starts with the eyebrow "Screening complete" and the H1 "Your screening result" (H1 receives focus on mount). Cards: white, radius 28, padding 24, 1px `#E3E9F2`.
- **Card order:**
  1. **Emergency banner** (emergency only, `role="alert"`): solid `#B42318`, white text, radius 28, padding 28×24. 52px white circle with a red triangle icon, plus a mono pill "EMERGENCY" (1.5px `rgba(255,255,255,.6)` border). Title "Your answers describe an emergency." Strong line (600 20px) "Go to the nearest emergency department now." Secondary line (`#FFE3DF`) "If you can't get there safely, ask someone to take you or call emergency services." **It replaces the summary card.**
  2. **Urgent banner** (urgent only, `role="alert"`): `#FFF4E3`, 2px `#E59A2F`, radius 24, padding 20. 40px `#C26A0A` circle with a clock icon. Label "URGENT · GET HELP TODAY" (mono, `#8A4B08`). Copy (600 18px `#5C3205`): "Some of your answers need clinical attention today. Please contact a clinic or nurse now." Ink button **"Chat with a nurse on WhatsApp"** (hover primary).
  3. **Summary card** (not shown for emergency): a status chip (lower: green tick-circle; higher: amber up-arrow circle), the title and the summary. CTA "Plan a clinical screening visit →" appears only for *higher diabetes risk*.
  4. **Nurse handoff card** (only for *higher complication risk* with no override): ink bg, radius 28. Shows "YOUR REFERENCE CODE" + the code (mono 22px) and a "Copy" pill (border `#2E4F78`). Accent button "Chat with a nurse on WhatsApp" (text `#0B2240`). Privacy line with a lock icon: "Only this code is shared in the message. Your answers stay private."
  5. **Why this result appeared** (higher outcomes only; titled "Why you're seeing this" for emergency): wrap of up to 6 factor chips. Scored factors: `#F0F7FF` / `#D6E2F0` / ink 500. Urgent overrides: `#FFF4E3` / `#E59A2F` / `#5C3205` 600. Emergency overrides: `#FDEDEB` / `#F1B5AE` / `#8F1D13` 600.
  6. **Next steps** (hidden for urgent and emergency): ordered list with 26px `#DBEBFB` number circles (mono 13px primary).
  7. **Reference code box** (when the handoff card isn't shown): dashed 1px `#A8CCF2`, radius 18. Label "Your reference code" ("Show this code to staff" for emergency), code in mono 18px, Copy button. Copying shows the toast "Reference code copied" and the button label changes to "Copied".
  8. **Disclaimer box**: "This tool does not diagnose. It estimates risk based on your answers."
- **WhatsApp message**: `Hello, my screening reference is {REF}` (no answers included). Add the real number before launch.

**Result copy**
| Outcome | Chip | Title | Summary | Next steps |
|---|---|---|---|---|
| Lower diabetes risk | Lower diabetes risk | Your answers suggest a lower risk right now | That's good news. Small daily habits help keep it that way. | Eat healthy meals with plenty of vegetables. · Aim for at least 30 minutes of activity most days. · Keep to a healthy weight. · Screen again in a year, or sooner if things change. |
| Higher diabetes risk | Higher diabetes risk | Please arrange clinical screening | Your answers suggest an elevated risk of diabetes. A hospital, clinic or pharmacy can check your blood glucose with a quick test. | Ask for a blood glucose or HbA1c test in the next few weeks. · Bring your reference code so staff can see this screening. |
| Lower complication risk | Lower complication risk | Your answers suggest lower complication risk right now | Keep up your routine care. It protects you over the long term. | Keep taking your medication as prescribed. · Check your blood glucose as your care plan says. · Protect your feet, eyes, kidneys and blood pressure with regular check-ups. · Keep meals steady and stay active. |
| Higher complication risk | Higher complication risk | Your answers suggest higher complication risk | You may need timely support for diabetes-related symptoms or possible complications. A nurse can help you decide what to do next. | Message a nurse today with your reference code. · Keep taking your medication as prescribed. |

---

## Questions

**Branch (step 1):** "Do you already have diabetes?" Help text: none on the live tool. Options: `no` "No / I'm not sure" (sub-label "Check my diabetes risk"); `yes` "Yes, I have diabetes" (sub-label "Check for possible complications").

**Path A: Risk estimate (10)**
| id | Type | Question | Help / options |
|---|---|---|---|
| age | number years 18–110 | How old are you? | placeholder "e.g. 45" |
| height | feet and inches | How tall are you? | An estimate is fine. |
| weight | number kg 30–250 | How much do you weigh? | An estimate is fine. |
| sex | choice | What sex were you assigned at birth? | This changes how waist size is scored. · Female / Male |
| waist | number cm 50–200 | What is your waist size? | Measure around your belly, level with your belly button. An estimate is fine. |
| activity | yes/no | Do you get at least 30 minutes of physical activity most days? | This includes walking, work that keeps you moving, or exercise. |
| veg | yes/no | Do you eat vegetables or fruit every day? | — |
| bpmed | yes/no | Have you ever taken medicine for high blood pressure? | — |
| glucose | yes/no | Have you ever been told your blood sugar was high? | For example at a check-up, during an illness or in pregnancy. |
| family | choice | Has anyone in your family been diagnosed with diabetes? | No · Yes, extended family (Grandparent, aunt, uncle, cousin) · Yes, close family (Parent, brother, sister, child) |

**Path B: Diagnosed (14).** Red-flag questions come first.
| id | Type | Question | Help / options |
|---|---|---|---|
| foot | yes/no | Do you have a wound or sore on your foot that is not healing? | This includes a blister, cut or ulcer that has lasted more than a week. |
| vision | yes/no | Have you had sudden vision loss or blurry vision? | — |
| dka | yes/no | Do you have nausea, vomiting, fast breathing or confusion right now? | — |
| chest | yes/no | Do you have chest pain or trouble breathing right now? | — |
| hba1c | choice | What was your most recent HbA1c result? | HbA1c is a blood test that shows your average sugar level over 3 months. · Below 7% / 7% to 9% / Above 9% / I don't know |
| highlow | choice | How often do you have very high or very low blood sugar? | Rarely or never / Once or twice a month / Every week |
| duration | choice | How long have you had diabetes? | Less than 5 years / 5 to 10 years / More than 10 years |
| bp | choice | Is your blood pressure under control? | Yes / No / I don't know |
| smoke | choice | Do you smoke? | Never / I used to / Yes, I smoke now |
| neuro | yes/no | Do you have numbness, tingling or burning in your feet? | — |
| retino | yes/no | Has a health worker told you diabetes is affecting your eyes? | — |
| nephro | yes/no | Has a health worker told you diabetes is affecting your kidneys? | — |
| adherence | choice | How often do you miss your diabetes medicine? | Rarely or never / A few times a month / Most weeks |
| checkup | choice | When did you last have a diabetes check-up? | In the last 6 months / 6 to 12 months ago / More than a year ago / Never, or I'm not sure |

---

## Scoring (⚠ placeholder values; replace with the approved ruleset)
The prototype's logic is in `score()` in the reference file. Structure to keep:
- **Path A** sums points: age band, BMI (from height and weight), sex-specific waist band, inactivity, no daily vegetables or fruit, blood-pressure medicine, past high glucose, family history. Threshold → *Higher* / *Lower diabetes risk*.
- **Path B** sums points for HbA1c, high/low frequency, duration, blood-pressure control, smoking, neuropathy, retinopathy, nephropathy, adherence and check-up recency.
  - **Overrides:** `chest` or `dka` = yes → urgency **emergency**. `foot` or `vision` = yes → urgency **urgent** (unless already emergency).
  - Any override forces *Higher complication risk*. Otherwise a score threshold decides higher or lower.
- **FLAG** = diagnosed AND higher complication risk.
- **Stored record:** `ref`, `submittedAt`, `diagnosed`, `classification`, `urgency` (routine/urgent/emergency), `flag`, `score`, `factors[] {label, points | override}`, `responses[] {question, answerLabel}`, `rawAnswers`, `ruleVersion`, `questionnaireVersion`, `rulesetHash`, `anonymizedAt?`.
- **Reference code:** `KYR-` + 4 + `-` + 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no confusable characters). Make sure it is unique.

---

## Screens: nurse

### Sign-in (`/nurse/login`)
- Centred column 440 wide. Wordmark 24px above a white card (radius 28, padding 32, floating shadow), gap 22.
- Eyebrow "Nurse access", H1 "Diabetes dashboard" (30px).
- Password input: 52px, radius 16, with a Show/Hide text toggle (600 14px primary).
- Primary button "Sign in" (52px).
- Footer note: "This dashboard shows all submitted assessments to authenticated nurses. It does not assign, claim, or filter cases by nurse."
- Link "← Return to screening".
- Errors (below the field, `role="alert"`):
  - Empty field: "Enter your password."
  - Wrong password: "That password isn't right. Try again."
  - After 5 failed attempts: "Too many attempts. Try again in 15 minutes." The input is disabled.
- Remove the prototype's "Prototype password" hint in production.

### Nurse header
White, sticky, 1px bottom border, padding 14px × gutter. Wordmark, plus on desktop a 1px divider and "Diabetes dashboard" (600 15px). "Sign out" outline button on the right.

### Queue (`/nurse`)
- Max-width 1280, padding `36px 32px 48px` (mobile `24px 16px 40px`), gap 24.
- **Title block:** eyebrow "Shared nurse queue", H1 "Assessments", description "Every submitted assessment is visible here, newest first. High-risk diabetes cases are flagged for follow-up, and red-flag cases are marked urgent or emergency."
- **Search** (right on desktop, 480 wide; full width on mobile):
  - Label "Search by reference" (600 13px).
  - 44px pill input with a search icon, mono uppercase, placeholder "Enter full reference code".
  - "Search" primary pill button; a "Clear" outline pill appears while a query or text is present.
  - Validation: empty input → "Enter a reference code to search."; wrong format → "Enter the full code, e.g. KYR-7F3K-92QD". Matching is exact.
- **Stat cards:** 3-column grid, gap 16 (8 on mobile).
  - "Total assessments" (becomes "Matching assessments" during a search), "Diabetes high risk", "Urgent or emergency".
  - Numbers in 600 40px (24 on mobile).
  - The urgent card gets a 2px `#E59A2F` border when the count is above 0. On desktop it also shows "N EMERGENCY · N URGENT" (mono 12px, red / amber).
- **Desktop table** (comfortable density, the chosen default): white, radius 24, 1px border, horizontal scroll under 1000px.
  - Columns (`grid-template-columns: 64px 128px 160px 150px 120px minmax(0,1fr) 70px 50px 16px`, gap 16): Flag · Urgency · Submitted · Reference · Diabetes status · Classification · Score (right-aligned) · Rule · chevron.
  - Header row: `#F7FAFE`, mono 11px uppercase.
  - Rows: **15px vertical padding** (comfortable; compact = 9px), 20px sides, 1px bottom border.
  - Each row has a 4px left bar: emergency `#B42318`, urgent `#E59A2F`, otherwise transparent. Row tint: emergency `#FDEDEB`, urgent `#FFF7EA`.
  - Hover `#EFF2FA`; focus inset ring. The whole row is a link (`role="link"`, Enter or Space opens it) with an aria-label like "emergency, flagged, Higher complication risk, KYR-…".
  - Score shows "Override" when urgency isn't routine. Classification is 600 weight.
  - Footer: "Showing N of N".
- **Badges:**
  - FLAG: ink bg, white mono 11px, radius 6, flag icon.
  - EMERGENCY: `#B42318` pill, white, triangle icon.
  - URGENT: `#FFF4E3` pill, 1.5px `#E59A2F` border, `#8A4B08` text, clock icon.
  - Routine: plain `#4B5D70` text. No flag: "—" in `#8597AA`.
- **Mobile cards** (replace the table): radius 20, padding 16, gap 10.
  - Border: emergency 2px `#B42318`, urgent 2px `#E59A2F`, otherwise 1px `#E3E9F2`. Same tints as the table.
  - Content: urgency badge + FLAG on the top-left, submitted time on the right, classification (600 16px), then reference (mono 13px) and "status · score".
- **Empty states:**
  - No assessments: icon tile, "No assessments yet", "New screenings will appear here as soon as they're submitted, newest first."
  - No match: "No assessment matches {REF}", "Check each character and try again. Search needs the full reference code.", link "Clear search and show all".
- **Order:** newest first. Don't hide or sort out routine cases; the queue is shared and unassigned.

### Assessment detail (`/nurse/[ref]`)
- "← Back to all assessments" link, then the header: eyebrow "Assessment detail", H1 = classification. Meta: Reference (mono), Submitted, and a FLAG badge if flagged.
- Urgency banner (`role="alert"`):
  - Emergency (solid red): "Emergency red flags were reported. This person was told to seek emergency care now."
  - Urgent (amber): "Red flags were reported. This person needs same-day clinical review."
- **Desktop:** 2-column grid `1fr 340px`, gap 20. **Mobile:** one column, with Provenance below.
  - **Summary card:** `dl` grid with 3 columns (2 on mobile). Fields: Diabetes status, Classification, Clinical urgency (coloured text), Score ("{n} · overridden" when there's an override), Reference.
  - **Score breakdown:** rows with the factor on the left and the points on the right (mono). Overrides show as pills: "EMERGENCY OVERRIDE" (red solid, white) or "URGENT OVERRIDE" (amber tint).
  - **Full responses:** a 2-column Question / Answer list, then a `<details>` "Show raw JSON" (mono 12px in `#F7FAFE`). If the record is anonymized, show a dashed `#A8CCF2` box with a lock icon: "Responses anonymized" / "Individual answers for this assessment were removed under the data retention policy. Classification, score and provenance are kept for reporting."
  - **Provenance card:** Rule version, Questionnaire version, Ruleset hash (mono 12px, word-break).

---

## Interactions & motion
- Screen enter: `opacity 0 → 1, translateY(8px) → 0`, 350ms ease (300ms for nurse screens).
- Progress width 300ms ease-out. Tile border and shadow 150ms.
- Spinner: 18px ring, 2.5px border `rgba(255,255,255,.35)` with a white top, rotating 0.8s linear.
- Toast: fixed, bottom 24, centred, ink pill, auto-hides after 2.6s, `role="status"`.
- Scroll to top on every screen change.
- Respect `prefers-reduced-motion` (turn off translate and spinner rotation, keep the label).

## State
- **Public:** `view` (intro | question | result), `consent`, `step`, `answers`, `numberDraft`, `fieldError`, `submitting`, `submitError`, `record`.
- **Nurse:** server-rendered list; `searchInput`, `query`, `searchError` in the URL (`?ref=`).
- **Submission error** (design board 2f): keep the answers on screen and show above the controls: "We couldn't send your answers. Your answers are saved on this screen; check your connection and try again."

## Accessibility
- Every control is at least 44px tall; public buttons are 56px and tiles 64px or taller.
- Tiles use `role="radiogroup"` / `role="radio"` with `aria-checked`, and arrow keys move between them.
- Colour is never the only signal: badges carry an icon and a word, and the selected state has a border and a check.
- Text contrast is at least 4.5:1 throughout.

## Assets
No images. Icons are inline SVG with a 24px viewBox and 2.2–3px round strokes: lock, info, check, alert circle, clock, triangle, flag, search, chat bubble, inbox. Swap for `lucide-react` equivalents if you prefer (Lock, Info, Check, AlertCircle, Clock, TriangleAlert, Flag, Search, MessageCircle, Inbox). Wordmark: the text "custodia" (stand-in logo, same as the landing page).

## Files
- `reference/Custodia Screening Prototype.dc.html`: interactive prototype (source of truth for behaviour and copy).
- `reference/Custodia Screening Tool.dc.html`: design board (tokens, components, states, accessibility notes).
- `reference/support.js`: prototype runtime (needed only to open the HTML files).
- `screenshots/`: 8 desktop + 8 mobile captures (see table above).

# Custodia Screening Tool

Custodia Screening Tool is a Next.js application for collecting short diabetes screening assessments, scoring submissions, and surfacing high-risk cases for nurse follow-up.

The public experience is titled **Know Your Risk | Diabetes Screening**. It guides a visitor through either a diabetes-risk questionnaire or a complication-risk questionnaire, stores the assessment in Postgres, returns plain-language guidance, and can hand high-risk diagnosed users to a nurse contact flow.

## Features

- Public diabetes screening flow for people who are diagnosed, not diagnosed, or unsure.
- Two scoring branches: diabetes risk and diabetes complication risk.
- Reference codes for each submitted assessment, generated as `CST-XXXXXXXXXXXX`.
- Postgres persistence for assessments, responses, scoring rule versions, and results.
- Nurse dashboard at `/dashboard` with password-protected access.
- Dashboard search by reference code and detail pages with full responses and scoring breakdowns.
- Optional WhatsApp handoff for diagnosed high-risk results.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 7
- PostgreSQL 16 through Docker Compose
- ESLint and Node's built-in test runner

## Getting Started

### Prerequisites

- Node.js 22 or newer (required by Prisma 7 and by the glob support the test script uses)
- npm
- Docker Desktop or another Docker Compose-compatible runtime

### Install Dependencies

```bash
npm install
```

The `postinstall` script runs `prisma generate` and writes the generated Prisma client to [lib/generated/prisma](lib/generated/prisma).

### Configure Environment

Copy the environment template:

```bash
cp .env.example .env
```

Default local database URL:

```text
postgresql://postgres:postgres@localhost:5433/custodia_screening_tool?schema=public
```

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma and the app. |
| `NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER` | No | Nurse WhatsApp number in international format, digits only. Enables the WhatsApp handoff for diagnosed high-risk results. The handoff message contains only the reference code. |
| `NURSE_DASHBOARD_PASSWORD` | Local only | Plaintext password for `/dashboard/login`. Use `NURSE_DASHBOARD_PASSWORD_HASH` in any deployed environment. |
| `NURSE_DASHBOARD_PASSWORD_HASH` | Deployments | scrypt hash of the dashboard password, generated with `npm run auth:hash -- "<password>"`. Takes precedence over the plaintext variable. |
| `NURSE_DASHBOARD_SESSION_SECRET` | No | Fallback secret for hashing audit identifiers. Session tokens are random and stored hashed, so this no longer signs the session cookie. |
| `AUDIT_HASH_SECRET` | Recommended | Dedicated HMAC key for hashing IP addresses in `nurse_sessions` and `audit_events`. |
| `ASSESSMENT_RETENTION_DAYS` | No | Age at which `npm run db:retention` anonymises assessment responses. Defaults to 365. |
| `AUDIT_RETENTION_DAYS` | No | Age at which `npm run db:retention` deletes audit events. Defaults to 730. |
| `SCORING_RULE_APPROVER` | No | Recorded as `approved_by` on seeded scoring rule versions. |

### Start the Database

```bash
npm run db:up
```

Apply migrations and seed the scoring rule versions:

```bash
npx prisma migrate dev
npm run db:seed
```

The seed script writes version 1 rules for both scoring branches, taken from the same
[lib/scoring-rules.ts](lib/scoring-rules.ts) objects the scoring engine executes, and stores a
SHA-256 hash of each ruleset.

Submissions fail closed with a 503 unless the database holds an `active` rule version for the branch
whose stored hash matches the engine's hash, so **you must run the seed after every migration and
every change to the scoring rules**.

### Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public screening flow.

Useful local URLs:

- Public screening: [http://localhost:3000](http://localhost:3000)
- Nurse dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Development Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Next.js development server. |
| `npm run build` | Build the production app. |
| `npm run start` | Start the production server after a build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm test` | Run tests in [lib](lib). |
| `npm run db:up` | Start the local Postgres container. |
| `npm run db:down` | Stop and remove the local Docker Compose services. |
| `npm run db:seed` | Seed scoring rule versions. |
| `npm run db:retention` | Anonymise expired assessments and prune expired sessions, audit events, and rate-limit counters. |
| `npm run auth:hash -- "<password>"` | Print a scrypt hash for `NURSE_DASHBOARD_PASSWORD_HASH`. |

## Application Flow

1. A visitor completes the public questionnaire.
2. The client posts the normalized payload to `POST /api/assessments`.
3. The API rate limits the caller, checks the idempotency key, validates responses, scores the assessment, verifies the active ruleset inside the write transaction, stores the assessment and result, and returns the classification, urgency, and reference code.
4. The result screen shows user-facing guidance, plus an urgent or emergency banner when red flags were reported. Diagnosed high-risk results can show a WhatsApp nurse handoff when configured, carrying only the reference code.
5. Nurses sign in at `/dashboard`, review submitted assessments, search by reference code, and open detail pages for full responses. Every view is audited.

## Scoring

Every clinical threshold, weight, label, and cutoff lives in
[lib/scoring-rules.ts](lib/scoring-rules.ts). [lib/scoring.ts](lib/scoring.ts) is a deterministic
evaluator over those definitions, and [prisma/seed.ts](prisma/seed.ts) writes the same objects into
the database. There is one source of truth, so the persisted rule version can never describe rules
other than the ones that produced the score.

Two branches are supported:

- `risk_of_diabetes` for users who are not diagnosed or are unsure.
- `complication_risk` for users who report an existing diabetes diagnosis.

### Integrity

Each submission resolves its rule row inside the write transaction, by exact branch and version
number, and compares the stored `ruleset_hash` against a SHA-256 hash of the canonicalised in-code
ruleset. A mismatch, a non-`active` status, or a future `effective_from` fails the request with a
503 and a `ruleset_mismatch` audit event rather than storing a mislabelled result. `GET /api/health`
reports the same comparison.

Every result records `ruleset_hash` and `engine_version`; every assessment records
`questionnaire_version` and `responses_hash`, so any historic result can be reproduced and proven.

### Risk and urgency are separate

`classification` describes risk. `urgency` (`routine`, `urgent`, `emergency`) describes clinical
escalation and is derived from red flags, which override the weighted checklist entirely. A red flag
sets the classification to high risk with a null score and an urgency that the nurse dashboard shows
as a banner. `urgent_care_recommended` is stored alongside it.

Changing any weight changes the ruleset hash, which fails a pinned test in
[lib/hashing.test.ts](lib/hashing.test.ts) until the constant is updated deliberately.

## Database

The Prisma schema is defined in [prisma/schema.prisma](prisma/schema.prisma). Main models:

- `Assessment`: responses snapshot, questionnaire version, responses hash, session id, idempotency
  key, reference code, and anonymisation timestamp.
- `Result`: classification, urgency, score, contributing factors, red flags, ruleset hash, and
  engine version.
- `ScoringRuleVersion`: versioned rules with a hash and an approval lifecycle
  (`draft`, `in_clinical_review`, `approved`, `active`, `retired`).
- `NurseSession`: hashed session tokens with expiry, revocation, and last-seen tracking.
- `AuditEvent`: who did what to which record, with hashed IPs.
- `RateLimitCounter`: fixed-window counters shared across instances.

Local Postgres runs on host port `5433` and container port `5432`.

## Security

- **Nurse sessions** are random 256-bit tokens. Only the SHA-256 hash is stored, so a database read
  cannot mint a session, and sign-out revokes the row immediately.
- **Login throttling** allows 5 attempts per IP per 5 minutes and 30 globally per hour, checked
  before the password is verified.
- **Public rate limits** allow 30 submissions per IP per hour and 5 per assessment session per hour.
  Both are needed because CGNAT puts many legitimate mobile users behind one address.
- **Idempotency** is keyed on the `Idempotency-Key` header, so retries and double-clicks return the
  original result rather than duplicating a record. Replay is scoped to the submitter: the caller
  must match the original assessment session or resend identical answers, otherwise the request is
  rejected with a `409` so a reused key cannot read back someone else's result.
- **Reference codes** are 60 bits of CSPRNG output in an unambiguous base32 alphabet, and dashboard
  search requires an exact normalised match rather than a substring.
- **Audit events** are recorded for every login, list view, search, and record view.
- **Security headers**, including a CSP, are set in [next.config.ts](next.config.ts).
- **Retention**: `npm run db:retention` anonymises assessment responses past
  `ASSESSMENT_RETENTION_DAYS` while retaining the clinical result. Schedule it in the deployment
  platform.

Outstanding work, including per-nurse identity, MFA, RBAC, and a nonce-based CSP, is tracked in
[docs/hardening-checklist.md](docs/hardening-checklist.md).

## Nurse Dashboard

Set `NURSE_DASHBOARD_PASSWORD_HASH` (or `NURSE_DASHBOARD_PASSWORD` locally) before using the
dashboard. Access is still a single shared password, not per-nurse identity.

Dashboard capabilities:

- View newest assessments first, 50 per page with keyset pagination.
- See total, high-risk, and urgent counts computed in the database.
- Search by full reference code.
- Flag diagnosed high-risk results and mark urgent or emergency red-flag cases.
- Open assessment detail pages with response data, score breakdowns, and ruleset provenance.

## API Routes

- `POST /api/assessments`: validate, score, persist, and return a new assessment result. Honours
  `Idempotency-Key`; returns 400, 409, 413, 429, 500, or 503 with a generic message and no internal
  detail.
- `GET /api/assessments/:id/result`: return a result for the current assessment session.
- `GET /api/health`: database connectivity plus active-ruleset hash verification.

### Dependency overrides

`package.json` pins `deepmerge-ts@^8.0.1` through `overrides`. `@prisma/config` depends on `7.1.5`,
which carries GHSA-ggr8-5vv4-36mx, and no Prisma release has picked up the fix yet. Drop the
override once Prisma bumps the dependency upstream.

## Deployment Notes

- Provide a production Postgres database through `DATABASE_URL`, with encryption at rest enabled.
- Run `npx prisma migrate deploy`, then `npm run db:seed`, before serving traffic. Submissions fail
  closed until the seed marks a matching ruleset `active`.
- Set `NURSE_DASHBOARD_PASSWORD_HASH` and `AUDIT_HASH_SECRET` to strong generated values.
- Schedule `npm run db:retention` daily.
- Ensure the platform sets `X-Forwarded-For`, since rate limiting and audit identifiers derive from
  it.
- Configure `NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER` only when the nurse line is ready to receive
  follow-up messages.

-- CreateEnum
CREATE TYPE "clinical_urgency" AS ENUM ('routine', 'urgent', 'emergency');

-- CreateEnum
CREATE TYPE "scoring_rule_status" AS ENUM ('draft', 'in_clinical_review', 'approved', 'active', 'retired');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('public', 'nurse', 'system');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "assessments" ADD COLUMN "questionnaire_version" TEXT NOT NULL DEFAULT '2026-08-01';
ALTER TABLE "assessments" ADD COLUMN "responses_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "assessments" ADD COLUMN "anonymized_at" TIMESTAMP(3);
ALTER TABLE "assessments" ALTER COLUMN "questionnaire_version" DROP DEFAULT;
ALTER TABLE "assessments" ALTER COLUMN "responses_hash" DROP DEFAULT;

-- AlterTable
ALTER TABLE "results" ADD COLUMN "urgency" "clinical_urgency" NOT NULL DEFAULT 'routine';
ALTER TABLE "results" ADD COLUMN "urgent_care_recommended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "results" ADD COLUMN "red_flags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "results" ADD COLUMN "ruleset_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "results" ADD COLUMN "engine_version" TEXT NOT NULL DEFAULT '';
ALTER TABLE "results" ALTER COLUMN "red_flags" DROP DEFAULT;
ALTER TABLE "results" ALTER COLUMN "ruleset_hash" DROP DEFAULT;
ALTER TABLE "results" ALTER COLUMN "engine_version" DROP DEFAULT;

-- Historical red-flag results were stored with a null score on the complication-risk branch and no
-- urgency column, so backfill them as urgent rather than leaving them as routine.
UPDATE "results"
SET "urgency" = 'urgent', "urgent_care_recommended" = true
WHERE "score" IS NULL AND "classification" = 'diabetes_high';

-- AlterTable
ALTER TABLE "scoring_rule_versions" ADD COLUMN "ruleset_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scoring_rule_versions" ADD COLUMN "status" "scoring_rule_status" NOT NULL DEFAULT 'draft';
ALTER TABLE "scoring_rule_versions" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "scoring_rule_versions" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "scoring_rule_versions" ADD COLUMN "retired_at" TIMESTAMP(3);
ALTER TABLE "scoring_rule_versions" ALTER COLUMN "ruleset_hash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "nurse_sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "nurse_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_session_id" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_idempotency_key_key" ON "assessments"("idempotency_key");

-- CreateIndex
CREATE INDEX "assessments_created_at_id_idx" ON "assessments"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "results_classification_idx" ON "results"("classification");

-- CreateIndex
CREATE INDEX "results_urgency_idx" ON "results"("urgency");

-- CreateIndex
CREATE INDEX "scoring_rule_versions_branch_status_idx" ON "scoring_rule_versions"("branch", "status");

-- CreateIndex
CREATE UNIQUE INDEX "nurse_sessions_token_hash_key" ON "nurse_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "nurse_sessions_expires_at_idx" ON "nurse_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_idx" ON "audit_events"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_counters_bucket_identifier_window_start_key" ON "rate_limit_counters"("bucket", "identifier", "window_start");

-- CreateIndex
CREATE INDEX "rate_limit_counters_window_start_idx" ON "rate_limit_counters"("window_start");
import { createHash } from "node:crypto";

import { complicationRiskRules, riskOfDiabetesRules } from "./scoring-rules";
import type { ScoringBranch } from "./scoring";

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`);

  return `{${entries.join(",")}}`;
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export const rulesetHash = canonicalHash;

export function hashForBranch(branch: ScoringBranch): string {
  return canonicalHash(branch === "risk_of_diabetes" ? riskOfDiabetesRules : complicationRiskRules);
}
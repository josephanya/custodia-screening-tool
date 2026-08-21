import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalHash, canonicalize, hashForBranch } from "./hashing";
import { complicationRiskRules, riskOfDiabetesRules } from "./scoring-rules";

const RISK_OF_DIABETES_RULESET_HASH =
  "28dc04204e152c6c435e82e9b058af75dabde0a5174605011dc6d51a0c47297c";
const COMPLICATION_RISK_RULESET_HASH =
  "7748acd837df1b9521ad5e79aada285e09ce01e9e62dd8f96029011a28f47c4c";

describe("canonicalize", () => {
  it("is insensitive to key order", () => {
    assert.equal(canonicalize({ a: 1, b: 2 }), canonicalize({ b: 2, a: 1 }));
  });

  it("is sensitive to values, arrays order, and nesting", () => {
    assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: 2 }));
    assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]));
    assert.notEqual(canonicalize({ a: { b: 1 } }), canonicalize({ a: 1 }));
  });
});

describe("ruleset hashes", () => {
  it("pins the diabetes risk ruleset", () => {
    assert.equal(hashForBranch("risk_of_diabetes"), RISK_OF_DIABETES_RULESET_HASH);
    assert.equal(canonicalHash(riskOfDiabetesRules), RISK_OF_DIABETES_RULESET_HASH);
  });

  it("pins the complication risk ruleset", () => {
    assert.equal(hashForBranch("complication_risk"), COMPLICATION_RISK_RULESET_HASH);
    assert.equal(canonicalHash(complicationRiskRules), COMPLICATION_RISK_RULESET_HASH);
  });

  it("changes when a clinical weight changes", () => {
    const tampered = {
      ...riskOfDiabetesRules,
      highRiskCutoff: riskOfDiabetesRules.highRiskCutoff + 1,
    };

    assert.notEqual(canonicalHash(tampered), RISK_OF_DIABETES_RULESET_HASH);
  });
});

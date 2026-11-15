import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNurseWhatsAppLink, getResultDisplayState, resultContent } from "@/lib/result-display";

describe("result display rules", () => {
  it("hides next steps and keeps the nurse handoff hidden for urgent overrides", () => {
    const state = getResultDisplayState({
      classification: "diabetes_high",
      contributingFactorCount: 1,
      urgency: "urgent",
    });

    assert.equal(state.showSummaryCard, true);
    assert.equal(state.showTips, false);
    assert.equal(state.showNurseHandoff, false);
    assert.equal(state.showReferenceBox, true);
    assert.equal(state.factorTitle, "Why this result appeared");
  });

  it("replaces the summary card and retitles factors for emergency overrides", () => {
    const state = getResultDisplayState({
      classification: "diabetes_high",
      contributingFactorCount: 2,
      urgency: "emergency",
    });

    assert.equal(state.showSummaryCard, false);
    assert.equal(state.showTips, false);
    assert.equal(state.showNurseHandoff, false);
    assert.equal(state.showReferenceBox, true);
    assert.equal(state.referenceLabel, "Show this code to staff");
    assert.equal(state.factorTitle, "Why you're seeing this");
  });

  it("shows the nurse handoff only for higher complication risk with no override", () => {
    const higherComplication = getResultDisplayState({
      classification: "diabetes_high",
      contributingFactorCount: 2,
      urgency: "routine",
    });
    const higherDiabetes = getResultDisplayState({
      classification: "no_diabetes_high",
      contributingFactorCount: 2,
      urgency: "routine",
    });

    assert.equal(higherComplication.showNurseHandoff, true);
    assert.equal(higherComplication.showReferenceBox, false);
    assert.equal(higherComplication.showTips, true);
    assert.equal(higherDiabetes.showNurseHandoff, false);
    assert.equal(higherDiabetes.showReferenceBox, true);
  });
});

describe("result copy", () => {
  it("uses the approved README next-step copy for higher complication risk", () => {
    assert.deepEqual(resultContent.diabetes_high.tips, [
      "Message a nurse today with your reference code.",
      "Keep taking your medication as prescribed.",
    ]);
  });

  it("uses the README WhatsApp handoff message", () => {
    const previousNumber = process.env.NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER;
    process.env.NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER = "+254 700 000 111";

    try {
      assert.equal(
        buildNurseWhatsAppLink("diabetes_high", "KYR-7F3K-92QD"),
        "https://wa.me/254700000111?text=Hello%2C%20my%20screening%20reference%20is%20KYR-7F3K-92QD",
      );
      assert.equal(buildNurseWhatsAppLink("no_diabetes_high", "KYR-7F3K-92QD"), null);
    } finally {
      if (previousNumber === undefined) {
        delete process.env.NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER;
      } else {
        process.env.NEXT_PUBLIC_NURSE_WHATSAPP_NUMBER = previousNumber;
      }
    }
  });
});

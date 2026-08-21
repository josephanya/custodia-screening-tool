import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createReferenceCode, normalizeReferenceCode } from "./reference-code";

describe("createReferenceCode", () => {
  it("produces a prefixed 12 character code", () => {
    const code = createReferenceCode();

    assert.match(code, /^CST-[0-9A-HJKMNP-TV-Z]{12}$/);
  });

  it("never emits ambiguous characters", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      assert.doesNotMatch(createReferenceCode(), /[ILOU]/);
    }
  });

  it("does not repeat within a large sample", () => {
    const codes = new Set(Array.from({ length: 2000 }, createReferenceCode));

    assert.equal(codes.size, 2000);
  });
});

describe("normalizeReferenceCode", () => {
  it("accepts a canonical code", () => {
    const code = createReferenceCode();

    assert.equal(normalizeReferenceCode(code), code);
  });

  it("accepts lowercase, spaced, and prefix-less input", () => {
    assert.equal(normalizeReferenceCode("cst-abcdef234567"), "CST-ABCDEF234567");
    assert.equal(normalizeReferenceCode("  ABCDEF234567 "), "CST-ABCDEF234567");
    assert.equal(normalizeReferenceCode("ABCD EF23 4567"), "CST-ABCDEF234567");
  });

  it("corrects ambiguous characters", () => {
    assert.equal(normalizeReferenceCode("CST-ILOU23456789"), "CST-110V23456789");
  });

  it("accepts legacy eight character hex codes", () => {
    assert.equal(normalizeReferenceCode("CST-1A2B3C4D"), "CST-1A2B3C4D");
    assert.equal(normalizeReferenceCode("1a2b3c4d"), "CST-1A2B3C4D");
  });

  it("rejects partial codes so the reference space cannot be scanned", () => {
    assert.equal(normalizeReferenceCode("CST-1A2B"), null);
    assert.equal(normalizeReferenceCode("CST"), null);
    assert.equal(normalizeReferenceCode(""), null);
    assert.equal(normalizeReferenceCode("CST-ABCDEF23456789"), null);
  });

  it("rejects characters outside the alphabet", () => {
    assert.equal(normalizeReferenceCode("CST-ABCDEF23456!"), null);
  });
});

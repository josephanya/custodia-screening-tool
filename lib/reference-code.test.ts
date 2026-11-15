import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createReferenceCode, normalizeReferenceCode } from "./reference-code";

describe("createReferenceCode", () => {
  it("produces a KYR code with two four-character groups", () => {
    const code = createReferenceCode();

    assert.match(code, /^KYR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("never emits characters omitted from the handoff alphabet", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      assert.doesNotMatch(createReferenceCode(), /[IO01]/);
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
    assert.equal(normalizeReferenceCode("kyr-7f3k-92qd"), "KYR-7F3K-92QD");
    assert.equal(normalizeReferenceCode("  7F3K92QD "), "KYR-7F3K-92QD");
    assert.equal(normalizeReferenceCode("7F3K 92QD"), "KYR-7F3K-92QD");
  });

  it("rejects characters omitted from new KYR codes", () => {
    assert.equal(normalizeReferenceCode("KYR-ILOU-2345"), null);
  });

  it("accepts legacy eight character hex codes", () => {
    assert.equal(normalizeReferenceCode("CST-1A2B3C4D"), "CST-1A2B3C4D");
    assert.equal(normalizeReferenceCode("1a2b3c4d"), "CST-1A2B3C4D");
  });

  it("rejects partial codes so the reference space cannot be scanned", () => {
    assert.equal(normalizeReferenceCode("KYR-1A2B"), null);
    assert.equal(normalizeReferenceCode("KYR"), null);
    assert.equal(normalizeReferenceCode(""), null);
    assert.equal(normalizeReferenceCode("KYR-ABCDEF23456789"), null);
  });

  it("rejects characters outside the alphabet", () => {
    assert.equal(normalizeReferenceCode("KYR-7F3K-92Q!"), null);
  });
});

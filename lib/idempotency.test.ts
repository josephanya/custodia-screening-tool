import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidIdempotencyKey, resolveIdempotentReplay } from "./idempotency";

const stored = {
  sessionId: "session-of-the-original-submitter",
  responsesHash: "a".repeat(64),
};

describe("isValidIdempotencyKey", () => {
  it("accepts URL-safe keys of a usable length", () => {
    assert.ok(isValidIdempotencyKey("01234567"));
    assert.ok(isValidIdempotencyKey(crypto.randomUUID()));
    assert.ok(isValidIdempotencyKey("a".repeat(128)));
  });

  it("rejects keys that are too short, too long, or unsafe", () => {
    assert.equal(isValidIdempotencyKey("short"), false);
    assert.equal(isValidIdempotencyKey("a".repeat(129)), false);
    assert.equal(isValidIdempotencyKey("has spaces here"), false);
    assert.equal(isValidIdempotencyKey("has/slash/chars"), false);
    assert.equal(isValidIdempotencyKey(""), false);
  });
});

describe("resolveIdempotentReplay", () => {
  it("replays for the original session sending the same answers", () => {
    const decision = resolveIdempotentReplay(stored, { ...stored });

    assert.equal(decision.outcome, "replay");
    assert.equal(decision.sessionMatched, true);
    assert.equal(decision.responsesMatched, true);
  });

  it("replays a retry that lost its session cookie but resent identical answers", () => {
    const decision = resolveIdempotentReplay(stored, {
      sessionId: "a-freshly-generated-session",
      responsesHash: stored.responsesHash,
    });

    assert.equal(decision.outcome, "replay");
    assert.equal(decision.sessionMatched, false);
    assert.equal(decision.responsesMatched, true);
  });

  it("replays for the original session even if the answers were edited", () => {
    const decision = resolveIdempotentReplay(stored, {
      sessionId: stored.sessionId,
      responsesHash: "b".repeat(64),
    });

    assert.equal(decision.outcome, "replay");
  });

  it("refuses a stranger reusing the key, which would disclose another person's result", () => {
    const decision = resolveIdempotentReplay(stored, {
      sessionId: "an-unrelated-session",
      responsesHash: "b".repeat(64),
    });

    assert.equal(decision.outcome, "conflict");
    assert.equal(decision.sessionMatched, false);
    assert.equal(decision.responsesMatched, false);
  });

  it("does not treat an empty stored hash as matching an empty caller hash by accident", () => {
    const decision = resolveIdempotentReplay(
      { sessionId: "original", responsesHash: "" },
      { sessionId: "stranger", responsesHash: "b".repeat(64) },
    );

    assert.equal(decision.outcome, "conflict");
  });

  it("does not let a prefix of the session or hash pass", () => {
    assert.equal(
      resolveIdempotentReplay(stored, {
        sessionId: stored.sessionId.slice(0, 10),
        responsesHash: stored.responsesHash.slice(0, 10),
      }).outcome,
      "conflict",
    );
  });
});

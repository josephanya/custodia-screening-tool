import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createScryptHash, safeEquals, verifyScryptHash } from "./password-hash";

describe("scrypt password hashing", () => {
  it("verifies the password it was created from", () => {
    const encoded = createScryptHash("correct horse battery staple");

    assert.ok(verifyScryptHash("correct horse battery staple", encoded));
  });

  it("rejects a wrong password", () => {
    const encoded = createScryptHash("correct horse battery staple");

    assert.equal(verifyScryptHash("Correct horse battery staple", encoded), false);
    assert.equal(verifyScryptHash("", encoded), false);
  });

  it("salts every hash", () => {
    assert.notEqual(createScryptHash("same"), createScryptHash("same"));
  });

  it("rejects malformed encodings instead of throwing", () => {
    assert.equal(verifyScryptHash("password", "not-a-hash"), false);
    assert.equal(verifyScryptHash("password", "bcrypt$1$2$3$salt$digest"), false);
    assert.equal(verifyScryptHash("password", ""), false);
  });
});

describe("safeEquals", () => {
  it("compares equal strings", () => {
    assert.ok(safeEquals("token", "token"));
  });

  it("rejects different strings and lengths without throwing", () => {
    assert.equal(safeEquals("token", "other"), false);
    assert.equal(safeEquals("token", "token-longer"), false);
    assert.equal(safeEquals("", "x"), false);
  });
});

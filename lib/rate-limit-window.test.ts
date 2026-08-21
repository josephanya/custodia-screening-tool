import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { retryAfterSeconds, windowStartFor } from "./rate-limit-window";

describe("windowStartFor", () => {
  it("floors to the start of the window", () => {
    const now = new Date("2026-08-13T10:37:41.500Z");

    assert.equal(windowStartFor(now, 3600).toISOString(), "2026-08-13T10:00:00.000Z");
    assert.equal(windowStartFor(now, 300).toISOString(), "2026-08-13T10:35:00.000Z");
    assert.equal(windowStartFor(now, 60).toISOString(), "2026-08-13T10:37:00.000Z");
  });

  it("returns the same window for every instant inside it", () => {
    const early = windowStartFor(new Date("2026-08-13T10:00:00.000Z"), 300);
    const late = windowStartFor(new Date("2026-08-13T10:04:59.999Z"), 300);

    assert.equal(early.getTime(), late.getTime());
  });
});

describe("retryAfterSeconds", () => {
  it("counts down to the end of the window", () => {
    const now = new Date("2026-08-13T10:04:00.000Z");
    const windowStart = windowStartFor(now, 300);

    assert.equal(retryAfterSeconds(now, windowStart, 300), 60);
  });

  it("never returns less than one second", () => {
    const now = new Date("2026-08-13T10:04:59.999Z");
    const windowStart = windowStartFor(now, 300);

    assert.equal(retryAfterSeconds(now, windowStart, 300), 1);
  });
});

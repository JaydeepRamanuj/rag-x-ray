import { describe, expect, it } from "vitest";

import { dayIn, lastDays } from "./days";

const PT = "America/Los_Angeles";

describe("dayIn", () => {
  it("uses the wall-clock date in the time zone, not UTC", () => {
    // 06:26 UTC on 31 Oct is still 30 Oct in California.
    expect(dayIn(new Date("2026-10-31T06:26:00Z"), PT)).toBe("2026-10-30");
    expect(dayIn(new Date("2026-10-31T08:00:00Z"), PT)).toBe("2026-10-31");
  });
});

describe("lastDays", () => {
  it("ends today and lists every day, oldest first", () => {
    expect(lastDays(3, new Date("2026-10-31T20:00:00Z"), PT)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  it("crosses a DST change without skipping or repeating a day", () => {
    // US clocks go back on 1 Nov 2026.
    expect(lastDays(3, new Date("2026-11-02T20:00:00Z"), PT)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

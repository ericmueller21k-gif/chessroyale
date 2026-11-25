import { describe, expect, it } from "vitest";
import { AGE_GATE, ageInMonths, birthYears, oldEnough } from "../src/index.ts";

/** A day, in local time (as the app's clock reads it). */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("the age gate's rule (docs/decisions/2026-10-16-age-gate-and-real-money.md)", () => {
  it("is 13, in whole months: 12 years 11 months is refused, 13 exactly passes", () => {
    expect(AGE_GATE.minAge).toBe(13);
    const today = day(2026, 10, 16);
    expect(ageInMonths(10, 2013, today)).toBe(13 * 12);
    expect(oldEnough(10, 2013, today)).toBe(true); // 13 exactly: born this month, 13 years ago
    expect(ageInMonths(11, 2013, today)).toBe(13 * 12 - 1);
    expect(oldEnough(11, 2013, today)).toBe(false); // 12 years 11 months
    expect(oldEnough(9, 2013, today)).toBe(true); // 13 years 1 month
    expect(oldEnough(10, 2014, today)).toBe(false); // 12 exactly
    expect(oldEnough(1, 1950, today)).toBe(true);
  });

  it("goes by the month, not the day: the first and last day of a month answer alike", () => {
    for (const d of [1, 16, 31]) {
      expect(oldEnough(10, 2013, day(2026, 10, d)), `Oct ${d}`).toBe(true);
      expect(oldEnough(11, 2013, day(2026, 10, d)), `Oct ${d}`).toBe(false);
    }
    // The next month, the one born in November turns 13.
    expect(oldEnough(11, 2013, day(2026, 11, 1))).toBe(true);
    expect(oldEnough(12, 2013, day(2026, 11, 30))).toBe(false);
  });

  it("across the turn of the year", () => {
    // January: born January 13 years ago passes, February doesn't yet; December of the year before has.
    expect(oldEnough(1, 2014, day(2027, 1, 5))).toBe(true);
    expect(oldEnough(2, 2014, day(2027, 1, 5))).toBe(false);
    expect(oldEnough(12, 2013, day(2027, 1, 5))).toBe(true);
    // December: born December 13 years ago passes; January of the next year is 12 years 11 months.
    expect(oldEnough(12, 2013, day(2026, 12, 31))).toBe(true);
    expect(oldEnough(1, 2014, day(2026, 12, 31))).toBe(false);
    expect(ageInMonths(1, 2014, day(2026, 12, 31))).toBe(13 * 12 - 1);
  });

  it("a birth month still to come (a slip) is too young, never old enough", () => {
    expect(oldEnough(12, 2026, day(2026, 10, 16))).toBe(false);
    expect(ageInMonths(12, 2026, day(2026, 10, 16))).toBeLessThan(0);
  });

  it("offers every year from this one back AGE_GATE.years, newest first, with no gap at the cutoff", () => {
    const years = birthYears(day(2026, 10, 16));
    expect(years).toHaveLength(AGE_GATE.years + 1);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(2026 - AGE_GATE.years);
    expect(years.every((y, i) => i === 0 || y === years[i - 1]! - 1)).toBe(true);
  });
});

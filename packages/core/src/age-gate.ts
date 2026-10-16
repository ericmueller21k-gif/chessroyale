import { AGE_GATE } from "./settings.ts";

/**
 * The age gate's rule, shared by the app and the server (docs/decisions/2026-10-16-age-gate-and-real-money.md). The
 * question asks only for a birth month and year, so age is counted in whole months: you're 13 from the start of the
 * month you turn 13. The app works the answer out on the device and sends only that, never the date.
 */

/** Whole months from a birth month (1-12) and year to `today`'s month: born this month, 0. */
export function ageInMonths(month: number, year: number, today: Date): number {
  return (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
}

/** Old enough to make an account: AGE_GATE.minAge years or more, in whole months (so 12 years 11 months is not). */
export function oldEnough(month: number, year: number, today: Date): boolean {
  return ageInMonths(month, year, today) >= AGE_GATE.minAge * 12;
}

/** The years the question offers, newest first: this year back AGE_GATE.years. */
export function birthYears(today: Date): number[] {
  const now = today.getFullYear();
  return Array.from({ length: AGE_GATE.years + 1 }, (_, i) => now - i);
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/**
 * Shown where sign-in would be, once this device has answered "too young": friendly, and nothing to fix. (The question
 * itself never mentions an age.)
 */
export const TOO_YOUNG_LINE = `Accounts are for players ${AGE_GATE.minAge} and older, so you'll play as a guest. Bots and bosses are all yours.`;

/**
 * A sign-in refused because this device's "old enough" answer ran out (or another tab's sign-in used it up): shown on
 * the question when it comes back.
 */
export const ASK_AGE_LINE = "Please answer again before you sign in.";

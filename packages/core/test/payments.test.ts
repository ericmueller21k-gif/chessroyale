import { describe, expect, it } from "vitest";
import {
  BUY_BANDS,
  BUY_LINES,
  PAYMENTS,
  XP,
  bandAfter,
  bandAskAgainAt,
  bandDue,
  boughtOf,
  buyAnswer,
  buyBandOf,
  buyMonthStart,
  capLine,
  checkoutLine,
  dollars,
  heldAt,
  inRefundWindow,
  isBuyBand,
  packOf,
  pausedLine,
  refundableCoins,
  spendPlan,
  type BuyFacts,
  type BuyStatus,
  type Unspent,
} from "../src/index.ts";

/**
 * Bought coins' rules (Nov 26, payments PR 5; core's payments.ts; docs/decisions/2026-11-26-purchases-storage.md): the packs as Eric
 * approved them, earned coins spent first and then the oldest purchase's, and the refundable amount's window and cap. The server's side
 * (the ledger, the guards, races): packages/server/test/purchases.test.ts.
 */
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 26, 12, 0);
const u = (ref: string, remaining: number, paidAt: number): Unspent => ({ ref, remaining, paidAt });

describe("the coin packs", () => {
  it("are the five Eric approved (Nov 17): $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000, in USD", () => {
    expect(PAYMENTS.packs.map((p) => [p.cents, p.coins])).toEqual([
      [199, 200],
      [499, 520],
      [999, 1100],
      [1999, 2300],
      [4999, 6000],
    ]);
    expect(PAYMENTS.currency).toBe("usd");
    expect(new Set(PAYMENTS.packs.map((p) => p.id)).size).toBe(PAYMENTS.packs.length);
    // (100 coins = $1 or better: a bigger pack never gives fewer coins a dollar.)
    const perDollar = PAYMENTS.packs.map((p) => (p.coins * 100) / p.cents);
    for (const [i, r] of perDollar.entries()) {
      expect(r).toBeGreaterThan(100);
      if (i) expect(r).toBeGreaterThanOrEqual(perDollar[i - 1]!);
    }
  });

  it("packOf knows each by id, and nothing else", () => {
    for (const p of PAYMENTS.packs) expect(packOf(p.id)).toBe(p);
    expect(packOf("coins-999")).toBeUndefined();
    expect(packOf(undefined)).toBeUndefined();
    expect(packOf({ id: "coins-200" })).toBeUndefined();
  });
});

describe("spending: earned coins first, then the oldest purchase's", () => {
  const twoBought = [u("cs_B", 520, T0 + 5 * DAY), u("cs_A", 200, T0)];

  it("earned covers it: no purchase is touched", () => {
    expect(spendPlan(750, twoBought, 30)).toEqual({ price: 30, coins: 750, earned: 30, fromEarned: 30, draws: [] });
    expect(spendPlan(750, twoBought, 0)).toEqual({ price: 0, coins: 750, earned: 30, fromEarned: 0, draws: [] });
  });

  it("past earned: the oldest purchase next (whatever order they come in), then the next", () => {
    expect(spendPlan(750, twoBought, 100)).toEqual({ price: 100, coins: 750, earned: 30, fromEarned: 30, draws: [{ ref: "cs_A", take: 70, was: 200 }] });
    expect(spendPlan(750, twoBought, 300)).toEqual({
      price: 300,
      coins: 750,
      earned: 30,
      fromEarned: 30,
      draws: [
        { ref: "cs_A", take: 200, was: 200 },
        { ref: "cs_B", take: 70, was: 520 },
      ],
    });
    // (Everything: earned, then all of both.)
    expect(spendPlan(750, twoBought, 750)!.draws).toEqual([
      { ref: "cs_A", take: 200, was: 200 },
      { ref: "cs_B", take: 520, was: 520 },
    ]);
  });

  it("not enough coins: no plan", () => {
    expect(spendPlan(750, twoBought, 751)).toBeNull();
    expect(spendPlan(0, [], 1)).toBeNull();
    expect(spendPlan(-20, [], 0)).toBeNull();
  });

  it("purchases paid at the same moment go by their id; one with nothing left is passed over", () => {
    const same = [u("cs_Z", 100, T0), u("cs_M", 100, T0), u("cs_E", 0, T0 - DAY)];
    expect(spendPlan(200, same, 150)!.draws).toEqual([
      { ref: "cs_M", take: 100, was: 100 },
      { ref: "cs_Z", take: 50, was: 100 },
    ]);
  });

  it("earned below zero (a purchase's coins taken back): nothing from earned, all from what's bought", () => {
    // 50 coins, 200 of them bought: earned -150.
    expect(spendPlan(50, [u("cs_A", 200, T0)], 50)).toEqual({ price: 50, coins: 50, earned: -150, fromEarned: 0, draws: [{ ref: "cs_A", take: 50, was: 200 }] });
    expect(spendPlan(50, [u("cs_A", 200, T0)], 51)).toBeNull();
  });

  it("a price that isn't whole coins, or below 0, is a mistake", () => {
    expect(() => spendPlan(100, [], 1.5)).toThrow();
    expect(() => spendPlan(100, [], -1)).toThrow();
  });

  it("drawing on more than PAYMENTS.maxDraws (20) purchases is refused: D1's 100 values a statement (review n3)", () => {
    expect(PAYMENTS.maxDraws).toBe(20);
    const many = Array.from({ length: 21 }, (_, i) => u(`r${String(i).padStart(2, "0")}`, 10, T0 + i));
    // 200 coins: all bought, 10 in each of 21 purchases. 20 of them: planned; all 21: refused.
    expect(spendPlan(210, many, 200)!.draws.map((d) => d.ref)).toEqual(many.slice(0, 20).map((m) => m.ref));
    expect(() => spendPlan(210, many, 201)).toThrow(/maxDraws/);
    // (Earned pays first: with 50 earned, 250 draws on the same 20, and one coin more on the 21st.)
    expect(spendPlan(260, many, 250)).toMatchObject({ fromEarned: 50, draws: many.slice(0, 20).map((m) => ({ ref: m.ref, take: 10, was: 10 })) });
    expect(() => spendPlan(260, many, 251)).toThrow(/maxDraws/);
  });

  it("bought is what the purchases hold unspent", () => {
    expect(boughtOf(twoBought)).toBe(720);
    expect(boughtOf([])).toBe(0);
  });
});

describe("refundable: unspent coins of purchases paid in the last 14 days, never more than the coins", () => {
  it("the window is 14 days of 24 hours from the payment", () => {
    expect(PAYMENTS.refundDays).toBe(14);
    expect(inRefundWindow(T0, T0)).toBe(true);
    expect(inRefundWindow(T0, T0 + 14 * DAY - 1)).toBe(true);
    expect(inRefundWindow(T0, T0 + 14 * DAY)).toBe(false);
    const both = [u("cs_A", 200, T0), u("cs_B", 520, T0 + 5 * DAY)];
    expect(refundableCoins(1000, both, T0 + 10 * DAY)).toBe(720);
    expect(refundableCoins(1000, both, T0 + 14 * DAY - 1)).toBe(720);
    expect(refundableCoins(1000, both, T0 + 14 * DAY)).toBe(520);
    expect(refundableCoins(1000, both, T0 + 19 * DAY)).toBe(0);
  });

  it("never more than the coins, never below 0", () => {
    expect(refundableCoins(300, [u("cs_A", 520, T0)], T0)).toBe(300);
    expect(refundableCoins(-40, [u("cs_A", 520, T0)], T0)).toBe(0);
    expect(refundableCoins(500, [], T0)).toBe(0);
  });
});

/**
 * Who may buy (Nov 26, payments PR 6; docs/decisions/2026-11-26-who-may-buy.md; the design's section 9): the band of a birth month and
 * year, when it's asked again and how far it may move, the buying month, every refusal's line, and the rule's order. The server's side
 * (stored, guarded, the API): packages/server/test/who-buys.test.ts.
 */
describe("who may buy: the age band", () => {
  // (Local noon: the device counts by its own date, so each date is the intended day in whatever time zone the tests run in; noon UTC
  // was the next day east of UTC+12. Delta review, n1.)
  const nov26 = new Date(2026, 10, 26, 12);
  it("counts the birth month as not yet complete: 16 from the 1st of the month after the one you turn 16 in, 18 likewise", () => {
    expect([PAYMENTS.buyers.minAge, PAYMENTS.buyers.adultAge]).toEqual([16, 18]);
    expect(buyBandOf(12, 2010, nov26)).toBe("under-16"); // 15 years 11 months
    // (Born in November 2010: 16 sometime this month, maybe not yet (born the 30th, 15 until then). Not 16 until December 1.)
    expect(buyBandOf(11, 2010, nov26)).toBe("under-16"); // 16 exactly, by month
    expect(buyBandOf(11, 2010, new Date(2026, 11, 1, 12))).toBe("16-17");
    expect(buyBandOf(10, 2010, nov26)).toBe("16-17"); // 16 years 1 month
    expect(buyBandOf(12, 2008, nov26)).toBe("16-17"); // 17 years 11 months
    expect(buyBandOf(11, 2008, nov26)).toBe("16-17"); // 18 exactly, by month
    expect(buyBandOf(10, 2008, nov26)).toBe("18+"); // 18 years 1 month
    expect(buyBandOf(1, 1970, nov26)).toBe("18+");
    expect(buyBandOf(5, 2020, nov26)).toBe("under-16");
    // (Across the turn of the year: born December 2010, 16 from January 1, 2027; born January 2011, from February 1.)
    expect(buyBandOf(12, 2010, new Date(2026, 11, 31, 12))).toBe("under-16");
    expect(buyBandOf(12, 2010, new Date(2027, 0, 1, 12))).toBe("16-17");
    expect(buyBandOf(1, 2011, new Date(2027, 0, 1, 12))).toBe("under-16");
    expect(buyBandOf(1, 2011, new Date(2027, 0, 31, 12))).toBe("under-16");
    expect(buyBandOf(1, 2011, new Date(2027, 1, 1, 12))).toBe("16-17");
    expect(BUY_BANDS).toEqual(["under-16", "16-17", "18+"]);
    expect([isBuyBand("18+"), isBuyBand("18"), isBuyBand(null)]).toEqual([true, false, false]);
  });

  it("is asked once: again only for an under-18 band, 6 months after its answer; never for 18+", () => {
    expect(PAYMENTS.buyers.askAgainMonths).toBe(6);
    const at = Date.UTC(2026, 10, 26, 12);
    const sixMonths = Date.UTC(2027, 4, 26, 12);
    expect(bandDue(null, null, at)).toBe(true);
    for (const band of ["under-16", "16-17"] as const) {
      expect(bandAskAgainAt(band, at)).toBe(sixMonths);
      expect(bandDue(band, at, at)).toBe(false);
      expect(bandDue(band, at, sixMonths - 1)).toBe(false);
      expect(bandDue(band, at, sixMonths)).toBe(true);
    }
    expect(bandAskAgainAt("18+", at)).toBeNull();
    expect(bandDue("18+", at, at + 100 * 365 * DAY)).toBe(false);
    // (A 31st runs into the next month, as Date does: Aug 31 + 6 months is March 3 in a year whose February has 28 days.)
    expect(bandAskAgainAt("16-17", Date.UTC(2026, 7, 31))).toBe(Date.UTC(2027, 2, 3));
  });

  it("asked again, it goes up one band at most; a lower answer is kept as given; the first answer as given", () => {
    expect(bandAfter(null, "under-16")).toBe("under-16");
    expect(bandAfter(null, "18+")).toBe("18+");
    expect(bandAfter("under-16", "18+")).toBe("16-17");
    expect(bandAfter("under-16", "16-17")).toBe("16-17");
    expect(bandAfter("under-16", "under-16")).toBe("under-16");
    expect(bandAfter("16-17", "18+")).toBe("18+");
    expect(bandAfter("16-17", "under-16")).toBe("under-16");
  });
});

describe("who may buy: the month, the lines, the rule", () => {
  it("the buying month turns when the XP day does: the 1st at 08:00 UTC (midnight Pacific), across the year's turn too", () => {
    expect(XP.dayStartUtcHour).toBe(8);
    const dec1 = Date.UTC(2026, 11, 1, 8);
    expect(buyMonthStart(dec1 - 1)).toBe(Date.UTC(2026, 10, 1, 8)); // Nov 30, 23:59:59.999 Pacific: still November
    expect(buyMonthStart(dec1)).toBe(dec1);
    expect(buyMonthStart(Date.UTC(2026, 11, 31, 23))).toBe(dec1);
    expect(buyMonthStart(Date.UTC(2027, 0, 1, 7, 59))).toBe(dec1); // New Year's Eve, 11:59 pm Pacific
    expect(buyMonthStart(Date.UTC(2027, 0, 1, 8))).toBe(Date.UTC(2027, 0, 1, 8));
  });

  it("every refusal's line is the design's (section 9; the pause's, section 1; a hold's, section 3; closed, section 4); money as the packs show it", () => {
    expect(BUY_LINES).toMatchObject({
      guest: "Sign in to buy coins.",
      paused: "Buying is paused for a moment.",
      young: "Buying coins is for players 16 and older.",
      country: "Coin packs aren't sold in your country yet. You can still earn coins by playing.",
      held: "Purchasing isn't available on this account.",
      closed: "This account is closed. Questions: support@hunchess.com",
    });
    expect(capLine(5000)).toBe("Monthly limit for players under 18: $50 left.");
    expect(capLine(4501)).toBe("Monthly limit for players under 18: $45.01 left.");
    expect(capLine(1)).toBe("Monthly limit for players under 18: $0.01 left.");
    expect(capLine(-3)).toBe("Monthly limit for players under 18: $0 left.");
    expect([dollars(199), dollars(5000), dollars(4990), dollars(0)]).toEqual(["$1.99", "$50", "$49.90", "$0"]);
  });

  const now = Date.UTC(2026, 10, 26, 12);
  const adult: BuyFacts = { signedIn: true, paused: false, closed: false, holdUntil: null, country: "US", band: "18+", bandAt: now - DAY, spentCents: 0 };
  const lines = (s: BuyStatus) => s.packs.map((p) => p.line);
  const all = (line: string | null) => PAYMENTS.packs.map(() => line);

  it("an adult in the US or Canada buys every pack, whatever this month's spend", () => {
    const s = buyAnswer({ ...adult, spentCents: 100_000 }, now);
    expect(s).toEqual({ line: null, askBand: false, held: false, leftCents: null, packs: PAYMENTS.packs.map((p) => ({ ...p, line: null })) });
    expect(buyAnswer({ ...adult, country: "CA" }, now).line).toBeNull();
    expect(PAYMENTS.buyers.countries).toEqual(["US", "CA"]);
  });

  it("refuses in order: a guest, paused, closed, held, the country, then under 16; the band is asked only when nothing before refuses", () => {
    const none: BuyFacts = { ...adult, band: null, bandAt: null };
    const cases: [Partial<BuyFacts>, string][] = [
      [{ signedIn: false, paused: true, closed: true, holdUntil: now + DAY, country: "FR" }, BUY_LINES.guest],
      [{ paused: true, closed: true, holdUntil: now + DAY, country: "FR" }, BUY_LINES.paused],
      [{ paused: true }, BUY_LINES.paused],
      [{ closed: true, holdUntil: now + DAY, country: "FR" }, BUY_LINES.closed],
      [{ holdUntil: now + DAY, country: "FR" }, BUY_LINES.held],
      [{ country: "FR" }, BUY_LINES.country],
      [{ country: null }, BUY_LINES.country],
      [{ country: "XX" }, BUY_LINES.country],
    ];
    for (const [f, line] of cases) {
      // (With no band answered: no age is asked of someone who couldn't buy anyway.)
      const s = buyAnswer({ ...none, ...f }, now);
      expect(s, line).toMatchObject({ line, askBand: false, held: line === BUY_LINES.held, leftCents: null });
      expect(lines(s)).toEqual(all(line));
    }
    // Nothing refuses: the band question comes first, every pack tappable.
    expect(buyAnswer(none, now)).toMatchObject({ line: null, askBand: true, leftCents: null });
    expect(lines(buyAnswer(none, now))).toEqual(all(null));
    expect(checkoutLine(buyAnswer(none, now), "coins-200")).toBe(BUY_LINES.band);
    // Under 16: every Buy greyed with its line, until the band's time to ask again (then the question comes first again).
    const young: BuyFacts = { ...adult, band: "under-16", bandAt: now };
    expect(buyAnswer(young, now)).toMatchObject({ line: BUY_LINES.young, askBand: false });
    expect(checkoutLine(buyAnswer(young, now), "coins-200")).toBe(BUY_LINES.young);
    expect(buyAnswer(young, bandAskAgainAt("under-16", now)!)).toMatchObject({ line: null, askBand: true });
    expect(checkoutLine(buyAnswer(adult, now), "coins-7")).toBe("That coin pack isn't sold.");
    // Paused: an under-16 band or a 16-17 band past its cap says the pause's line (it comes first), and a band answered 18+ too.
    for (const f of [{ ...adult, paused: true }, { ...young, paused: true }, { ...adult, band: "16-17" as const, spentCents: 6000, paused: true }])
      expect(lines(buyAnswer(f, now))).toEqual(all(BUY_LINES.paused));
    expect(pausedLine("payments")).toBe(BUY_LINES.paused);
  });

  it("a hold ends at its hold_until: held until the moment before, buying from that moment", () => {
    expect(heldAt(now + 1, now)).toBe(true);
    expect(heldAt(now, now)).toBe(false);
    expect(heldAt(null, now)).toBe(false);
    expect(buyAnswer({ ...adult, holdUntil: now + 1 }, now)).toMatchObject({ line: BUY_LINES.held, held: true });
    expect(buyAnswer({ ...adult, holdUntil: now }, now)).toMatchObject({ line: null, held: false });
  });

  it("16-17: $50 a month on the packs' prices, each pack greyed with what's left once it no longer fits, to the cent", () => {
    expect(PAYMENTS.buyers.minorCapCents).toBe(5000);
    const teen: BuyFacts = { ...adult, band: "16-17", bandAt: now };
    expect(buyAnswer(teen, now)).toMatchObject({ line: null, askBand: false, leftCents: 5000 });
    expect(lines(buyAnswer(teen, now))).toEqual(all(null)); // $49.99 fits under $50
    // 1¢ spent: $49.99 still fits exactly; 2¢: it doesn't.
    expect(lines(buyAnswer({ ...teen, spentCents: 1 }, now))).toEqual(all(null));
    expect(lines(buyAnswer({ ...teen, spentCents: 2 }, now))).toEqual([null, null, null, null, capLine(4998)]);
    // $45.01 spent ($4.99 left): the $4.99 fits exactly, the dearer ones don't; then 1¢ more and only the $1.99 does.
    expect(lines(buyAnswer({ ...teen, spentCents: 501 }, now))).toEqual([null, null, null, null, capLine(4499)]);
    expect(lines(buyAnswer({ ...teen, spentCents: 4501 }, now))).toEqual([null, null, capLine(499), capLine(499), capLine(499)]);
    expect(lines(buyAnswer({ ...teen, spentCents: 4502 }, now))).toEqual([null, capLine(498), capLine(498), capLine(498), capLine(498)]);
    expect(lines(buyAnswer({ ...teen, spentCents: 4801 }, now))).toEqual([null, ...all(capLine(199)).slice(1)]);
    expect(lines(buyAnswer({ ...teen, spentCents: 4802 }, now))).toEqual(all(capLine(198)));
    expect(buyAnswer({ ...teen, spentCents: 6000 }, now)).toMatchObject({ line: null, leftCents: 0, packs: PAYMENTS.packs.map((p) => ({ ...p, line: capLine(0) })) });
    expect(checkoutLine(buyAnswer({ ...teen, spentCents: 4802 }, now), "coins-200")).toBe("Monthly limit for players under 18: $1.98 left.");
    // Due to be asked again: the question first, every pack tappable (an 18+ answer would lift the cap).
    expect(buyAnswer({ ...teen, spentCents: 4802 }, bandAskAgainAt("16-17", now)!)).toMatchObject({ askBand: true, leftCents: null, packs: PAYMENTS.packs.map((p) => ({ ...p, line: null })) });
  });
});

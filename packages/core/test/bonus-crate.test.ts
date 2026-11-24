import { describe, expect, it, vi } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_CRATES, CRATES, CRATE_BONUS, WELCOME_CRATE_ID, bonusOddsLine, bonusPool, mulberry32, opensWithKey, rollBonus } from "@chessroyale/core";

/**
 * The bonus crate (Eric, Nov 24; docs/decisions/2026-11-24-bonus-crate.md): 25% of openings also give a crate, any crate evenly (retired
 * ones too; not the Welcome Crate; not an admins-first boss's, except to an admin), and its key when it opens with one.
 */
describe("the bonus crate: the rule", () => {
  it("CRATE_BONUS.chance is 0.25, Eric's number, from the settings", () => {
    expect(CRATE_BONUS.chance).toBe(0.25);
  });

  it("the pool is built from the lists: every series crate and every boss's crate, but not an admins-first boss's (except to an admin), never the Welcome Crate", () => {
    const ids = bonusPool().map((c) => c.id);
    const live = BOSS_CRATES.filter((c) => !BOSS_ADMIN_FIRST.includes(c.boss));
    expect(ids).toEqual([...CRATES.map((c) => c.id), ...live.map((c) => c.id)]);
    // (Today: Beta and Winter, and the boss crates of every boss out for everyone; Timber's, Dash's and Birdie's are admins first.)
    for (const id of ["beta-001", "winter-1", "boss-tiger", "boss-clown", "boss-gingerbread"]) expect(ids).toContain(id);
    for (const id of ["boss-timber", "boss-dash", "boss-birdie", WELCOME_CRATE_ID]) expect(ids).not.toContain(id);
    // An admin's: every crate there is.
    expect(bonusPool(true).map((c) => c.id)).toEqual([...CRATES, ...BOSS_CRATES].map((c) => c.id));
    expect(bonusPool(true).map((c) => c.id)).not.toContain(WELCOME_CRATE_ID);
    // No crate twice.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the key: a series crate comes with one, a boss crate doesn't", () => {
    for (const c of CRATES) expect(opensWithKey(c.id)).toBe(true);
    for (const c of BOSS_CRATES) expect(opensWithKey(c.id)).toBe(false);
    expect(opensWithKey(WELCOME_CRATE_ID)).toBe(false);
    expect(opensWithKey("nonsense")).toBe(false);
  });
});

describe("the bonus crate: the odds", () => {
  it("about 25% over many seeded rolls, each crate in the pool about as likely as the others, and the key exactly when it opens with one", () => {
    const N = 40_000;
    const pool = bonusPool().map((c) => c.id);
    const counts = new Map<string, number>(pool.map((id) => [id, 0]));
    let hits = 0;
    for (let s = 1; s <= N; s++) {
      const b = rollBonus(mulberry32(s * 2654435761));
      if (!b) continue;
      hits++;
      expect(pool).toContain(b.crate);
      expect(b.key).toBe(opensWithKey(b.crate));
      counts.set(b.crate, counts.get(b.crate)! + 1);
    }
    // 40,000 at 0.25: 10,000 expected, sd about 87; within 4 sd.
    expect(Math.abs(hits - N * CRATE_BONUS.chance)).toBeLessThan(350);
    // Each crate: hits / pool size expected, sd about sqrt(hits/k); within 5 sd.
    const each = hits / pool.length;
    for (const [id, n] of counts) expect(Math.abs(n - each), id).toBeLessThan(5 * Math.sqrt(each));
  });

  it("an admin's pool has the admins-first crates too, each as likely", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 4000; s++) {
      const b = rollBonus(mulberry32(s), { admin: true, force: true });
      seen.add(b!.crate);
    }
    expect([...seen].sort()).toEqual(bonusPool(true).map((c) => c.id).sort());
  });

  it("the test switch: `true` always gives one (its crate rolled); a crate's id gives that one; an id outside the pool is as `true`", () => {
    for (let s = 1; s <= 200; s++) expect(rollBonus(mulberry32(s), { force: true })).not.toBeNull();
    expect(rollBonus(mulberry32(7), { force: "winter-1" })).toEqual({ crate: "winter-1", key: true });
    expect(rollBonus(mulberry32(7), { force: "boss-tiger" })).toEqual({ crate: "boss-tiger", key: false });
    // (Birdie's crate is admins first: a player's switch can't name it; an admin's can.)
    expect(rollBonus(mulberry32(7), { force: "boss-birdie" })!.crate).not.toBe("boss-birdie");
    expect(rollBonus(mulberry32(7), { force: "boss-birdie", admin: true })).toEqual({ crate: "boss-birdie", key: false });
  });

  it("the same seed rolls the same bonus (the server's roll is the item's own stream, so a seed replays the whole opening)", () => {
    for (let s = 1; s <= 50; s++) expect(rollBonus(mulberry32(s))).toEqual(rollBonus(mulberry32(s)));
  });
});

describe("the bonus crate: edges and its words (the review, Nov 25)", () => {
  it("an empty pool gives no bonus, never a throw (even forced)", async () => {
    vi.resetModules();
    vi.doMock("../src/crates.ts", async (orig) => ({ ...(await orig<typeof import("../src/crates.ts")>()), CRATES: [], BOSS_CRATES: [] }));
    try {
      const empty = await import("../src/bonus-crate.ts");
      expect(empty.bonusPool(true)).toEqual([]);
      for (let s = 1; s <= 50; s++) expect(empty.rollBonus(mulberry32(s))).toBeNull();
      expect(empty.rollBonus(mulberry32(1), { force: true })).toBeNull();
      expect(empty.rollBonus(mulberry32(1), { force: "winter-1", admin: true })).toBeNull();
      expect(empty.bonusOddsLine()).toBe("Opening a crate gives no bonus crate for now.");
    } finally {
      vi.doUnmock("../src/crates.ts");
      vi.resetModules();
    }
  });

  it("the odds line is exact: which openings, the chance, how many crates and each one's share, the key, what's left out", () => {
    const n = bonusPool().length;
    const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
    expect(bonusOddsLine()).toBe(
      `Opening a series or boss crate: 25% chance of a bonus crate, one of ${n} crates chosen evenly (about ${pct(1 / n)} each, so about ${pct(0.25 / n)} of openings for each), with its key if it needs one. The Welcome Crate and crates of bosses not yet released aren't in it. Opening a bonus crate never gives another.`,
    );
    // (Not "every opening": the Welcome Crate's gives none.)
    expect(bonusOddsLine()).not.toMatch(/every opening|any crate/i);
    expect(bonusOddsLine(0.3, 10)).toContain("30% chance of a bonus crate, one of 10 crates chosen evenly (about 10% each, so about 3% of openings for each)");
    expect(bonusOddsLine(0.25, 1)).toContain("25% chance of a bonus crate, that one crate, with its key");
    expect(bonusOddsLine(0)).toBe("Opening a crate gives no bonus crate for now.");
  });
});

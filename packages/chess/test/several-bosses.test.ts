import { describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_POWERS, mulberry32 } from "@chessroyale/core";
import { MatchRunner, crowdAllowed, legalMoves, rageOf, sideRates } from "../src/index.ts";
import { KIT_OPENING, fakeEngine, kitSettings, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * Several bosses on one side (Battle Tower PR 6; docs/decisions/2026-11-18-several-bosses.md): the deal, the turn order, the
 * merged layer, one ultimate a turn change, the meters at BATTLE_TOWER.rageScale, and the design's out-of-turn rules. The boss
 * kit over every pair and a sample of threes is boss-kit-side.test.ts.
 */

const runner = (bosses: readonly string[], test = "", seed = 5) =>
  new MatchRunner({ settings: kitSettings({ boss: bosses[0]!, bosses, test, maxMoves: 30 }), rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });

const battle = (bosses: string[], test = "", triggerFrom = 99, maxMoves = 24): KitBattle => ({ boss: bosses[0]!, bosses, seed: 11, side: "w", test, triggerFrom, strikes: [], maxMoves, opening: KIT_OPENING });

describe("several bosses: the deal", () => {
  it("deals every boss in the order given, from the starting position, the first to reply; their own seeds, strengths and powers", () => {
    const r = runner(["gingerbread", "clown", "moo"]);
    expect(r.state.bosses!.map((o) => o.id)).toEqual(["gingerbread", "clown", "moo"]);
    expect(r.boss!.id).toBe("gingerbread");
    expect(r.state.focus).toBe(0);
    expect(r.state.moved).toBe(2);
    expect(r.sideBosses().map((b) => b.id)).toEqual(["gingerbread", "clown", "moo"]);
    expect(new Set(r.state.bosses!.map((o) => o.powers!.seed)).size).toBe(3);
    expect(r.boss!.crowdMoves).toBe(0);
    expect(legalMoves(r.boards.get(0)!.fen).length).toBe(20);
  });

  it("never Hollow with Smudgy (BATTLE_TOWER.apart), never an unknown boss or the same boss twice", () => {
    expect(BATTLE_TOWER.apart).toContainEqual(["hollow", "smudgy"]);
    expect(() => runner(["hollow", "gingerbread", "smudgy"])).toThrow(/never share a floor/);
    expect(() => runner(["gingerbread", "nobody"])).toThrow(/no boss/);
    expect(() => runner(["gingerbread", "gingerbread"])).toThrow(/different bosses/);
    expect(() => runner(["gingerbread", "clown", "moo", "bigboy"])).toThrow(/different bosses/);
  });

  it("one boss in bossIds is one boss, as ever (no side)", () => {
    const r = runner(["gingerbread"]);
    expect(r.state.bosses).toBeUndefined();
    expect(r.several()).toBe(false);
    expect(r.sideBosses().map((b) => b.id)).toEqual(["gingerbread"]);
  });
});

describe("several bosses: the turn order and the merged layer", () => {
  it("they move in the order dealt, each his own turn; the crowd's moves are limited by every boss's marks at once", async () => {
    const movers: string[] = [];
    let limited = 0;
    const problems: string[] = [];
    await runBattle(battle(["gingerbread", "clown", "sawyer"], "", 3, 24), null, (r, fen, who) => {
      if (who === "boss") movers.push(r.boss!.id!);
      if (who !== "crowd") return;
      // (Every move the side allows is one each boss alone would allow, unless the limits lifted: none was left.)
      const side = r.crowdAllowed();
      if (!side) return;
      limited++;
      for (const b of r.sideBosses()) {
        const own = crowdAllowed(b, fen);
        if (own && side.some((m) => !own.includes(m)) && side.length < legalMoves(fen).length) problems.push(`${b.id} at ${fen}: ${side.filter((m) => !own.includes(m)).join(",")}`);
      }
    });
    expect(problems).toEqual([]);
    expect(limited).toBeGreaterThan(3);
    expect(movers.length).toBeGreaterThan(12);
    // (Sawyer's first move is his own: a pawn's; the others' moves aren't bound by it.)
    expect(movers.slice(0, 9)).toEqual(["gingerbread", "clown", "sawyer", "gingerbread", "clown", "sawyer", "gingerbread", "clown", "sawyer"]);
  }, 60_000);

  it("one ultimate a turn change: each boss's ultimate comes only at his own turn change, every boss's in turn", async () => {
    // (Every turn an ultimate came on, by boss, read at every step: the funhouse's first turn is never dealt.)
    const at = new Map<string, Set<number>>();
    let last: { id: string; ults: number }[] = [];
    await runBattle(battle(["gingerbread", "clown", "grex"], "", 2, 30), null, (r) => {
      for (const b of r.sideBosses()) if (b.powers?.ultAt !== undefined) at.set(b.id!, new Set([...(at.get(b.id!) ?? []), b.powers.ultAt]));
      last = r.sideBosses().map((b) => ({ id: b.id!, ults: b.powers?.ults ?? 0 }));
    });
    const turns = [...at.values()].flatMap((t) => [...t]);
    expect(turns.length).toBe(new Set(turns).size);
    expect(last.filter((b) => b.ults < 1)).toEqual([]);
  }, 60_000);

  it("each meter fills at BATTLE_TOWER.rageScale of its speed (2 bosses 75%, 3 bosses 60%); the bar reads the same rates", () => {
    expect(BATTLE_TOWER.rageScale).toEqual([1, 0.75, 0.6]);
    expect(sideRates(BOSS_POWERS, ["gingerbread"])).toBe(BOSS_POWERS);
    expect(sideRates(BOSS_POWERS, ["gingerbread", "clown"]).rageSpeed.gingerbread).toBeCloseTo(BOSS_POWERS.rageSpeed.gingerbread! * 0.75);
    expect(sideRates(BOSS_POWERS, ["gingerbread", "clown", "moo"]).rageSpeed.moo).toBeCloseTo((BOSS_POWERS.rageSpeed.moo ?? 1) * 0.6);
    const r = runner(["gingerbread", "clown"]);
    const b = { ...r.boss!, powers: { ...r.boss!.powers!, charge: 40 } };
    expect(rageOf(b, sideRates(BOSS_POWERS, ["gingerbread", "clown"]))).toBeCloseTo(rageOf(b)! * 0.75);
  });
});

describe("several bosses: the design's out-of-turn rules", () => {
  it("Hollow's second move (Lights out failed): his turn again before the next boss's, then the order goes on", async () => {
    const movers: string[] = [];
    const run = await runBattle(battle(["hollow", "gingerbread"], "lightsout", 2, 24), null, (r, _fen, who) => {
      if (who === "boss") movers.push(r.boss!.id!);
    });
    expect(run.played.lightsout ?? 0).toBeGreaterThan(0);
    expect(run.played.extra ?? 0).toBeGreaterThan(0);
    // (The order never broke: his extra move isn't a turn of the side's.)
    for (let i = 1; i < movers.length; i++) expect(movers[i], `move ${i}`).not.toBe(movers[i - 1]);
  }, 60_000);

  it("Folio's Revision crosses out only its own move, and its move again comes out of turn", async () => {
    const movers: { id: string; out: boolean }[] = [];
    const run = await runBattle(battle(["gingerbread", "folio"], "revision", 99, 24), null, (r, _fen, who) => {
      if (who === "boss") movers.push({ id: r.boss!.id!, out: (r.boss!.powers?.folio?.revision?.at ?? -1) === r.boss!.crowdMoves && !r.boss!.powers?.folio?.revision?.move });
    });
    expect(run.events.has("revision")).toBe(true);
    const replay = movers.findIndex((m) => m.out);
    expect(replay).toBeGreaterThan(0);
    // (Folio moved, Revision took its move and the crowd's back, and Folio moves again; then Ginger, as the order goes on.)
    expect(movers[replay]!.id).toBe("folio");
    expect(movers[replay - 1]!.id).toBe("folio");
    expect(movers[replay + 1]?.id).toBe("gingerbread");
  }, 60_000);

  it("Wrangler's reply to the showdown's duel is the side's very next move, out of turn; the order then goes on after him", async () => {
    const movers: string[] = [];
    const run = await runBattle(battle(["pig", "gingerbread"], "showdown", 99, 24), null, (r, _fen, who) => {
      if (who === "boss") movers.push(r.boss!.id!);
    });
    expect(run.events.has("showdown")).toBe(true);
    const twice = movers.findIndex((m, i) => i > 0 && m === "pig" && movers[i - 1] === "pig");
    expect(twice).toBeGreaterThan(0);
    expect(movers[twice + 1]).toBe("gingerbread");
    // (Only there: every other move in the order dealt.)
    expect(movers.filter((m, i) => i > 0 && m === movers[i - 1]).length).toBe(1);
  }, 60_000);
});

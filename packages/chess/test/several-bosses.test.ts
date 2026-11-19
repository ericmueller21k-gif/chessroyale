import { describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_POWERS, mulberry32 } from "@chessroyale/core";
import type { BossState, Settings } from "@chessroyale/core";
import { MatchRunner, bossRules, crowdAllowed, legalMoves, pieceAt, rageOf, rageSpeedOf, rageTick, sideRates } from "../src/index.ts";
import { KIT_OPENING, fakeEngine, kitSettings, runBattle, sideTracked, type KitBattle } from "./boss-kit-lib.ts";

/**
 * Several bosses on one side (Battle Tower PR 6; docs/decisions/2026-11-18-several-bosses.md): the deal, the turn order, the
 * merged layer, one ultimate a turn change, the meters at BATTLE_TOWER.rageScale, and the design's out-of-turn rules. The boss
 * kit over every pair and a sample of threes is boss-kit-side.test.ts.
 */

const runner = (bosses: readonly string[], test = "", seed = 5, patch: Partial<Settings> = {}) =>
  new MatchRunner({ settings: kitSettings({ boss: bosses[0]!, bosses, test, maxMoves: 30 }, patch), rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });

/** The boss with this id on the side, in full. */
const sideBoss = (r: MatchRunner, id: string): BossState => r.sideBosses().find((b) => b.id === id)!;

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

  it("never a pair BATTLE_TOWER.apart keeps apart (Hollow with Smudgy; Nov 19: Smudgy with Alfil, Alfil with Jefferson, Dash with Smudgy), never an unknown boss or the same boss twice", () => {
    expect(BATTLE_TOWER.apart).toEqual([["hollow", "smudgy"], ["smudgy", "alfil"], ["alfil", "grex"], ["dash", "smudgy"]]);
    expect(() => runner(["hollow", "gingerbread", "smudgy"])).toThrow(/never share a floor/);
    expect(() => runner(["alfil", "smudgy"])).toThrow(/never share a floor/);
    expect(() => runner(["grex", "moo", "alfil"])).toThrow(/never share a floor/);
    expect(() => runner(["smudgy", "dash"])).toThrow(/never share a floor/);
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
    expect(movers.slice(0, 9)).toEqual(["gingerbread", "clown", "sawyer", "gingerbread", "clown", "sawyer", "gingerbread", "clown", "sawyer"]);
  }, 60_000);

  it("Sawyer's first move is his own: a pawn's, and it never binds the others' moves while it's due", async () => {
    const others: string[] = [];
    let first: string | null = null;
    await runBattle(battle(["gingerbread", "clown", "sawyer"], "", 99, 12), null, (r, fen, who) => {
      if (who !== "boss" || sideBoss(r, "sawyer").powers?.split) return;
      const mover = r.boss!.id!;
      const allowed = r.bossAllowed() ?? legalMoves(fen);
      if (mover === "sawyer") {
        first = allowed.every((m) => pieceAt(fen, m.slice(0, 2))?.type === "p") ? "pawn" : `not only pawns: ${allowed.join(",")}`;
        return;
      }
      // (While his first move is due, the others may move a piece: his rule isn't theirs.)
      if (!allowed.some((m) => pieceAt(fen, m.slice(0, 2))?.type !== "p")) others.push(`${mover}: ${allowed.join(",")}`);
    });
    expect(first).toBe("pawn");
    expect(others).toEqual([]);
  }, 60_000);

  for (const side of [
    ["gingerbread", "clown", "grex"],
    ["gingerbread", "moo"],
    ["gingerbread", "zebra"],
  ]) {
    it(`one ultimate a turn change, each at his own (${side.join(" + ")}): a boss's ultimate comes as his own turn begins or at his own turn change`, async () => {
      // (Each step the kit watches: a crowd turn dealt, or a boss to move. An ultimate that came since the last step (its ultAt newly
      // set) came at this step's turn change: one a step, and the boss's own: the boss to move when his turn begins (an ultimate his
      // afterCrowdMove brings, Moo's Full Moon, Don Dough's Gold Plate), else the boss whose turn change the crowd's turn is (the next
      // to move), or the one who just moved for an ultimate his move prepares (triggerAtHisTurn).)
      const had = new Map<string, boolean>();
      const wrong: string[] = [];
      const came = new Set<string>();
      await runBattle(battle(side, "", 2, 30), null, (r, _fen, who) => {
        const now = r.sideBosses().filter((b) => b.powers?.ultAt !== undefined && !had.get(b.id!));
        for (const b of r.sideBosses()) had.set(b.id!, b.powers?.ultAt !== undefined);
        if (now.length > 1) wrong.push(`${now.map((b) => b.id).join(" and ")} at one turn change`);
        const moved = r.state.bosses![r.state.moved ?? 0]!.id;
        for (const b of now) {
          came.add(b.id!);
          const own = who === "boss" ? r.boss!.id : bossRules(b)?.triggerAtHisTurn ? moved : r.sideBosses()[0]!.id;
          if (own !== b.id) wrong.push(`${b.id}'s ultimate came at ${own}'s ${who === "boss" ? "turn" : "turn change"}`);
        }
      });
      expect(wrong).toEqual([]);
      expect([...came].sort()).toEqual([...side].sort());
    }, 60_000);
  }

  it("Hollow's second move holds no ultimate: the boss after him gets his ultimate's step at the turn change after Hollow's move", async () => {
    let pulled = 0;
    const held: string[] = [];
    await runBattle(battle(["hollow", "gingerbread"], "lightsout", 99, 24), null, (r, _fen, who) => {
      const ginger = sideBoss(r, "gingerbread");
      // (Ginger's trigger, pulled as Hollow plays the move his second move follows: due at the turn change after it, Ginger's.)
      if (who === "boss" && !pulled && r.boss!.id === "hollow" && r.boss!.powers?.lightsOut?.extra === "due" && ginger.powers?.ultAt === undefined) pulled += r.triggerUltimate() ? 1 : 0;
      // (The crowd's turn after Hollow's move and his second: its turn change is the next boss's in the order, Ginger's.)
      const own = r.state.bosses![((r.state.moved ?? 0) + 1) % 2]!.id;
      if (who === "crowd" && pulled && own === "gingerbread") {
        if (ginger.powers?.ultNext) held.push(`turn ${ginger.powers.turn}: Ginger's trigger held at his own turn change`);
        if (r.boss!.id !== "gingerbread") held.push(`turn ${ginger.powers?.turn}: the crowd's turn read from ${r.boss!.id}, not Ginger`);
      }
    });
    expect(pulled).toBe(1);
    expect(held).toEqual([]);
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

describe("several bosses: Folio's Crease line asked at the floor's rates (audit 1, finding 3)", () => {
  /** Folio to move after your first move, his meter set to `full` times full at the one-boss speed as your next turn begins. */
  async function folioAt(order: readonly string[], full: number) {
    const r = runner(order);
    r.deal();
    await r.score(new Map([["h0", { move: "e2e4", thinkMs: 1000 }]]));
    expect(r.bossToMove() && r.boss!.id).toBe("folio");
    const p = r.boss!.powers!;
    // (creaseDue's own sum: the meter gathered, plus this crowd move's tick, times his speed.)
    const charge = (full * BOSS_POWERS.rageFull) / rageSpeedOf("folio") - rageTick(p.judged);
    r.state.boss = { ...r.boss!, powers: { ...p, charge, lost: 0, rageUsed: 0 } };
    return r;
  }

  it("a meter full at the one-boss speed but not at the floor's (75% with two, 60% with three): no line search", async () => {
    // (Alone: full, the line is wanted. The one-boss case is unchanged.)
    expect((await folioAt(["folio"], 1.2)).creaseAsk()).not.toBeNull();
    expect((await folioAt(["folio", "gingerbread"], 1.2)).creaseAsk()).toBeNull();
    expect((await folioAt(["folio", "gingerbread", "moo"], 1.5)).creaseAsk()).toBeNull();
    // (Full at the floor's own rates: wanted, as his step will warn.)
    expect((await folioAt(["folio", "gingerbread"], 1.2 / 0.75)).creaseAsk()).not.toBeNull();
    expect((await folioAt(["folio", "gingerbread", "moo"], 1.2 / 0.6)).creaseAsk()).not.toBeNull();
    expect(BATTLE_TOWER.rageScale.slice(1, 3)).toEqual([0.75, 0.6]);
  });
});

describe("several bosses: each boss's own turn, and every move reaching every boss (the review of PR #808)", () => {
  it("Smudgy's forced moves are his own: the boss to move before him is never held to one, and his Camouflage isn't worn down by the others' turns", async () => {
    const held: string[] = [];
    let smudgy: BossState | null = null;
    await runBattle(battle(["gingerbread", "smudgy"], "", 99, 24), null, (r, _fen, who) => {
      smudgy = sideBoss(r, "smudgy");
      const due = smudgy.powers?.camo?.due;
      if (who === "boss" && r.boss!.id !== "smudgy" && due && r.bossAllowed()?.join() === due) held.push(`${r.boss!.id} held to ${due}`);
    });
    expect(held).toEqual([]);
    const camo = (smudgy as BossState | null)?.powers?.camo;
    expect(camo?.missed).toBe(0);
    expect(camo?.off).toBeUndefined();
    expect(camo?.swap).toBeTruthy();
  }, 60_000);

  it("another boss may step Smudgy's hidden rook as a pawn would (the disguise binds the side), and his rook is followed", async () => {
    const r = runner(["gingerbread", "smudgy"], "", 5, { bossPaintTest: 1 });
    expect(sideBoss(r, "smudgy").powers?.camo?.square).toBe("d7");
    r.deal();
    await r.score(new Map([["h0", { move: "a2a3", thinkMs: 1000 }]]));
    expect(r.boss!.id).toBe("gingerbread");
    expect(r.bossAllowed() ?? legalMoves(r.boards.get(0)!.fen)).toContain("d7d6");
    r.applyBossMove("d7d6");
    const camo = sideBoss(r, "smudgy").powers!.camo!;
    expect(camo.square).toBe("d6");
    expect(sideTracked(sideBoss(r, "smudgy"))).toEqual([["hidden rook", "d6"]]);
    // (The crowd's board masks the rook where it stands now, and the move's name gives it away no more than Smudgy's own would.)
    expect(r.bossView()?.powers?.camo?.square).toBe("d6");
    expect(r.bossView()?.lastMove?.san).toBe("d6");
  });


  for (const partner of ["zebra", "sawyer", "gingerbread"]) {
    it(`Folio's Revision (with ${partner}): the crowd move it crosses out reaches no other boss (his hooks, his judged numbers)`, async () => {
      // (The others' powers as the crowd's turn was dealt, and as the bosses' turn begins after a Revision: the same.)
      let dealt = new Map<string, string>();
      let revisions = 0;
      const changed: string[] = [];
      const others = (r: MatchRunner) => r.sideBosses().filter((b) => b.id !== "folio");
      const key = (b: BossState) => JSON.stringify({ ...b.powers, events: undefined });
      await runBattle(battle(["folio", partner], "revision", 99, 24), null, (r, _fen, who) => {
        if (who === "crowd") dealt = new Map(others(r).map((b) => [b.id!, key(b)]));
        const rev = sideBoss(r, "folio").powers?.folio?.revision;
        if (who !== "boss" || r.boss!.id !== "folio" || rev?.at !== r.boss!.crowdMoves || rev.move) return;
        revisions++;
        for (const b of others(r)) if (key(b) !== dealt.get(b.id!)) changed.push(`${b.id} at crowd move ${r.boss!.crowdMoves}`);
      });
      expect(revisions).toBeGreaterThan(0);
      expect(changed).toEqual([]);
    }, 60_000);
  }

  // (The delta review's repros: a move of Folio's moved a piece another boss tracks, and the crowd's reply drew a Revision.)
  for (const [order, seed] of [[["sawyer", "folio"], 12], [["folio", "smudgy"], 5], [["folio", "smudgy"], 37], [["folio", "alfil"], 2]] as const) {
    it(`Folio's Revision never crosses out a move of Folio's another boss's trackers followed (${order.join(" + ")}, seed ${seed}): his trackers stay true`, async () => {
      let tracked: string[] = [];
      let reached = 0;
      let after = false;
      const crossed: string[] = [];
      const others = (r: MatchRunner) => r.sideBosses().filter((b) => b.id !== "folio");
      const run = await runBattle({ ...battle([...order], "revision", 99, 24), seed }, null, (r, _fen, who) => {
        const board = r.boards.get(0)!;
        const rev = sideBoss(r, "folio").powers?.folio?.revision;
        if (who === "crowd" && r.state.bosses![r.state.moved!]!.id === "folio") {
          // (Folio's move just played: did it move a piece another boss tracks?)
          after = tracked.includes(board.history.at(-1)?.slice(0, 2) ?? "");
          if (after) reached++;
        }
        if (who !== "boss" || r.boss!.id !== "folio") return;
        if (rev?.at === r.boss!.crowdMoves && !rev.move && after) crossed.push(`${rev.moves.join(" ")} at crowd move ${r.boss!.crowdMoves}`);
        after = false;
        tracked = others(r).flatMap((b) => sideTracked(b).map(([, sq]) => sq));
      });
      expect(run.failures).toEqual([]);
      expect(reached).toBeGreaterThan(0);
      expect(crossed).toEqual([]);
    }, 60_000);
  }
});

describe("several bosses: an ultimate that can't wait (Chandy's last chance; audit 1, finding 2)", () => {
  /** Scholar's mate against him, the bosses' moves played as given (seed 5): Qxf7# open as the crowd's turn 4 begins. */
  async function scholars(order: readonly string[], each?: (r: MatchRunner, k: number) => void) {
    const r = runner(order);
    const crowd = ["e2e4", "f1c4", "d1h5"];
    const boss = ["e7e5", "b8c6", "g8f6"];
    for (let k = 0; k < 3; k++) {
      r.deal();
      await r.score(new Map([["h0", { move: crowd[k]!, thinkMs: 1000 }]]));
      expect(r.boards.get(0)!.history.at(-1), `the crowd's move ${k + 1}`).toBe(crowd[k]);
      each?.(r, k);
      r.applyBossMove(boss[k]!);
    }
    return { r, chandy: sideBoss(r, "chandy") };
  }

  // (Every order the audit tried: alone, Chandy first or second of two, each place of three.)
  for (const order of [["chandy"], ["timber", "chandy"], ["zebra", "chandy"], ["chandy", "timber"], ["chandy", "zebra"], ["chandy", "timber", "zebra"], ["timber", "zebra", "chandy"], ["timber", "chandy", "zebra"]]) {
    it(`${order.join(" + ")}: a mate in one open as your turn begins brings his Dodge at once, whoever moved last`, async () => {
      const { r, chandy } = await scholars(order);
      expect(legalMoves(r.boards.get(0)!.fen)).toContain("h5f7");
      expect(chandy.powers!.events.map((e) => e.kind)).toEqual(expect.arrayContaining(["warn", "dodge"]));
      expect(chandy.powers!.ultAt).toBe(4);
      // (One ultimate a turn change: his, the others' waiting.)
      for (const b of r.sideBosses()) if (b.id !== "chandy") expect(b.powers?.events.map((e) => e.kind) ?? [], b.id).not.toContain("warn");
      // (He holds your turn: his Dodge plays on it round by round, read from him; then your move, and the order goes on after
      // whoever moved last.)
      expect(r.boss!.id).toBe("chandy");
      let rounds = 0;
      while (r.dodgeDue()) {
        const d = r.boss!.powers!.chandy!.dodge!;
        r.finishDodgeRound({ h0: d.rounds[d.results.length]!.safe });
        rounds++;
      }
      expect(rounds).toBe(BOSS_POWERS.chandy.dodgeRounds);
      r.deal();
      await r.score(new Map([["h0", { move: "a2a3", thinkMs: 1000 }]]));
      expect(r.boards.get(0)!.history.at(-1)).toBe("a2a3");
      expect(r.bossToMove()).toBe(true);
      expect(r.boss!.id).toBe(order[3 % order.length]);
    });
  }

  it("an ultimate prepared by the move just played still comes with it (Wrangler's line-up is on the board), the others waiting", async () => {
    // (Chandy's hook and ultimate stood in for: his ultimate can't wait exactly at the turn change Wrangler's line-up was made for.)
    const rules = bossRules({ id: "chandy" })!;
    const { ultimateNow, ultimate } = rules;
    let runner: MatchRunner | null = null;
    let now = false;
    const lineUp = (turn: number) => !!runner?.sideBosses().some((b) => b.id === "pig" && b.powers?.showdown?.turn === turn && b.powers.ultAt === undefined);
    rules.ultimateNow = (_p, t) => (now = lineUp(t.turn));
    rules.ultimate = (next, t) => {
      if (!now) return false;
      next.ultAt = t.turn;
      t.events.push({ kind: "dodge", turn: t.turn });
      return true;
    };
    const both: string[][] = [];
    try {
      await runBattle(battle(["pig", "gingerbread", "chandy"], "showdown", 99, 24), null, (r, _fen, who) => {
        runner = r;
        if (who !== "crowd") return;
        const kinds = r.sideBosses().map((b) => (b.powers?.events ?? []).filter((e) => e.turn === b.powers!.turn).map((e) => e.kind));
        if (kinds.some((k) => k.includes("dodge"))) both.push(r.sideBosses().map((b, i) => `${b.id}: ${kinds[i]!.join(" ")}`));
      });
    } finally {
      rules.ultimateNow = ultimateNow;
      rules.ultimate = ultimate;
    }
    expect(both.length).toBe(1);
    expect(both[0]!.find((x) => x.startsWith("pig:"))).toMatch(/showdown/);
    expect(both[0]!.find((x) => x.startsWith("gingerbread:"))).not.toMatch(/warn|blizzard/);
  }, 60_000);

  it("a mate another boss's limit stops isn't open: no Dodge (Ginger's freeze holding your queen; the side's allowed moves asked)", async () => {
    for (const order of [["gingerbread", "chandy"], ["chandy", "gingerbread"]]) {
      const { r, chandy } = await scholars(order, (r, k) => {
        // (No freeze of his own until then; then his freeze on your queen through turn 4.)
        const i = r.state.bosses!.findIndex((o) => o.id === "gingerbread");
        const own = r.state.focus === i ? r.state.boss! : r.state.bosses![i]!;
        own.powers = { ...own.powers!, nextPassive: 9, ...(k === 2 ? { frozen: { square: "h5", piece: "q", until: 4 } } : {}) };
      });
      expect(r.crowdAllowed(), order.join(" + ")).not.toContain("h5f7");
      expect(chandy.powers!.events.map((e) => e.kind), order.join(" + ")).not.toContain("dodge");
      expect(chandy.powers!.ultAt, order.join(" + ")).toBeUndefined();
    }
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

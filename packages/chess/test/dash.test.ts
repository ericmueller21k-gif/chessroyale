import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_CLOCK, BOSS_POWERS, BOSS_ROSTER, DASH_HANG_ON, DASH_STALL, DASH_TAP, adminFirst, bossClockSettings, isPlayable, menuBosses, mulberry32, type BossPowerState, type PowerEvent, type Settings } from "@chessroyale/core";
import { DASH_ANIM, DASH_FX, MatchRunner, applyMove, inCheck, pieceAt, stallMove, stallPausedMs, stallPlan, stallTimeline, dashView, nextBeat, extraMoveCandidates, passTurn, POWER_FX, boardPieces, botRushCorrect, bossThinkMs, chooseRush, dashMoveClock, flagMove, legalMoves, rushFen, rushHeld, rushJudge, rushKeep, rushMovesLeft, rushTimeline, scrambleLeft, scrambleOn, scrambleSecondsOf, slappedClock, DASH, hangOnTimeline, popOffMs } from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Dash, the cheetah (docs/decisions/2026-11-03-dash.md): Clock Slap (each capture of his steals time from your clock: the bank,
 * or a raid's next move), Time Scramble (after the usual warning, your next 5 moves get 3 s each), and out of time never a loss
 * (a move played for you from the judge's top moves).
 */

const S = BOSS_POWERS;

function battle(seed: number, opts: { test?: string; bank?: boolean; entrants?: { id: string; name: string; isBot: boolean }[] } = {}) {
  const base = kitSettings({ boss: "dash", test: opts.test ?? "", maxMoves: 60 });
  const settings: Settings = opts.bank ? { ...base, ...bossClockSettings(base) } : base;
  const r = new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: opts.entrants ?? [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
  return r;
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;

/** The crowd's turn: a move in time (`move` null: nobody picked). */
async function crowdMove(r: MatchRunner, inTime = true) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = inTime ? crowdPick(fen, allowed, mulberry32(fen.length * 31 + allowed.length)) : null;
  await r.score(new Map([["h0", { move, thinkMs: inTime ? 1000 : r.allowedMsFor("h0") }]]));
  return { fen, move };
}

describe("Dash: his roster line and numbers", () => {
  it("is on the roster, admins first (never at random or for a player until his id leaves BOSS_ADMIN_FIRST), Eric's numbers", () => {
    const d = BOSS_ROSTER.find((b) => b.id === "dash")!;
    expect(d).toMatchObject({ name: "Dash", kit: "Dash", offset: -250, powers: { passive: "clockslap", ultimate: "scramble" } });
    expect(BOSS_ADMIN_FIRST).toContain("dash");
    expect(adminFirst(d)).toBe(true);
    expect(isPlayable(d)).toBe(false);
    expect(menuBosses({ admin: false, raid: true }).some((b) => b.id === "dash")).toBe(false);
    expect(menuBosses({ admin: true, raid: true }).some((b) => b.id === "dash")).toBe(true);
    // (Eric, Nov 26: 3 moves of 5 seconds the first time, 3 moves of 3 seconds the second; was his 5 moves of 3 seconds. The sim's: 30 s
    // a slap off the bank, the flag from the top 4, the usual meter.)
    expect([S.scrambleMoves, S.scrambleSeconds, S.slapBankSeconds, S.slapMoveSeconds, S.slapMoveMin, S.flagTop, S.rageSpeed.dash]).toEqual([3, [5, 3], 30, 6, 8, 4, 1]);
    // His moments hold the screen as long as his animations: the slap, TIME SCRAMBLE!'s banner and his spin, his jab.
    expect(POWER_FX.slap).toBe(DASH_ANIM.clockSlap);
    expect(DASH_FX.scramble).toBe(1500 + DASH_ANIM.timeScramble);
    expect(POWER_FX.flag).toBe(DASH_ANIM.check);
    // He never thinks: his least wait before his move is dashThinkMs, every other boss's 1200.
    const view = { crowdSide: "w" as const, crowdMoves: 1, board: { history: ["e2e4", "e7e5"] } };
    expect(bossThinkMs({ ...view, id: "dash" })).toBe(S.dashThinkMs);
    expect(bossThinkMs({ ...view, id: "timber" })).toBe(1200);
  });
});

describe("Dash: the clock", () => {
  type B = Parameters<typeof dashMoveClock>[0] & object;
  const boss = (p: object, crowdMoves = 4): B => ({ id: "dash", crowdMoves, result: undefined, powers: { seed: 1, turn: crowdMoves + 1, material: 39, lost: 0, nextPassive: 2, events: [], ...p } }) as unknown as B;

  it("a scrambled move's clock is its use's scrambleSeconds (5 the first, 3 the second), for exactly scrambleMoves crowd turns from the one it came", () => {
    for (const turn of [5, 6, 7]) expect(scrambleOn({ ultAt: 5 }, turn)).toBe(true);
    for (const turn of [4, 8]) expect(scrambleOn({ ultAt: 5 }, turn)).toBe(false);
    expect([5, 6, 7, 8].map((t) => scrambleLeft({ ultAt: 5 }, t))).toEqual([3, 2, 1, 0]);
    // (Its use: the battle's ultimates so far, this one counted.)
    expect(dashMoveClock(boss({ ultAt: 5, ults: 1 }, 4), 20)).toBe(5);
    expect(dashMoveClock(boss({ ultAt: 5, ults: 1 }, 4), 1200)).toBe(5);
    expect(dashMoveClock(boss({ ultAt: 5, ults: 2 }, 6), 20)).toBe(3);
    expect(dashMoveClock(boss({ ultAt: 5, ults: 2 }, 6), 1200)).toBe(3);
    expect(dashMoveClock(boss({ ultAt: 5, ults: 1 }, 7), 20)).toBe(20);
    // (A third, were there one: the last's.)
    expect([0, 1, 2, 5].map((u) => scrambleSecondsOf(u))).toEqual([5, 3, 3, 3]);
    // (His view's seconds, for the banner, the countdown and Tick's tally: the use's.)
    const view = (ults: number) => dashView({ ...boss({ ultAt: 5, ults }, 4).powers!, dash: { slaps: 0, stolen: 0, flags: 0 } } as never)!.scramble;
    expect([view(1), view(2)]).toEqual([{ at: 5, moves: 3, seconds: 5 }, { at: 5, moves: 3, seconds: 3 }]);
    // (Another boss, or his battle over: the clock as it was.)
    expect(dashMoveClock({ ...boss({ ultAt: 5 }, 4), id: "timber" }, 20)).toBe(20);
    expect(dashMoveClock({ ...boss({ ultAt: 5 }, 4), result: "boss" } as B, 20)).toBe(20);
  });

  it("a raid's slapped move: slapMoveSeconds shorter, never under slapMoveMin nor above the clock; only the next crowd turn", () => {
    expect(slappedClock(20)).toBe(14);
    expect(slappedClock(10)).toBe(8);
    expect(slappedClock(6)).toBe(6);
    const slap = { dash: { slaps: 1, stolen: 6000, flags: 0, slap: { at: 4, ms: 6000, bank: false } } };
    expect(dashMoveClock(boss(slap, 4), 20)).toBe(14);
    expect(dashMoveClock(boss(slap, 5), 20)).toBe(20);
    // (On a bank the slap took from the bank: the move's clock stands.)
    expect(dashMoveClock(boss({ dash: { ...slap.dash, slap: { at: 4, ms: 30000, bank: true } } }, 4), 1200)).toBe(1200);
  });

  it("the flag's move: one of the judge's top flagTop moves allowed, at random, seeded (the same every time); with none ranked, any allowed", () => {
    const allowed = ["a2a3", "b2b3", "c2c3", "d2d4", "e2e4", "g1f3"];
    const ranked = ["e2e4", "d2d4", "g1f3", "c2c3", "b2b3", "a2a3"];
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const m = flagMove(seed, 7, allowed, ranked)!;
      expect(ranked.slice(0, S.flagTop)).toContain(m);
      expect(flagMove(seed, 7, allowed, ranked)).toBe(m);
      seen.add(m);
    }
    expect(seen.size).toBe(S.flagTop);
    // (A ranked move not allowed is passed over; none ranked: any allowed.)
    expect(flagMove(3, 7, ["a2a3"], ranked)).toBe("a2a3");
    expect(allowed).toContain(flagMove(3, 7, allowed, []));
    expect(flagMove(3, 7, [], ranked)).toBeNull();
  });
});

describe("Dash: in a battle", () => {
  it("on a bank (Boss alone, a party): his slap (the test switch: his first move) takes slapBankSeconds from every bank, its moment as your turn begins", async () => {
    const r = battle(3, { test: "clockslap", bank: true });
    await crowdMove(r);
    const before = r.alive()[0]!.bankMs;
    await r.playBoss(fakeEngine());
    expect(r.alive()[0]!.bankMs).toBe(before - S.slapBankSeconds * 1000);
    expect(r.boss!.powers!.dash!.slap).toEqual({ at: r.boss!.crowdMoves, ms: S.slapBankSeconds * 1000, bank: true });
    r.deal();
    expect(r.boss!.powers!.events.find((e) => e.kind === "slap")).toMatchObject({ ms: S.slapBankSeconds * 1000, bank: true });
    // (The bank: as it was, 10 + 10, the move's clock out of reach.)
    expect(r.allowedMsFor("h0")).toBe(r.alive()[0]!.bankMs + BOSS_CLOCK.incrementSeconds * 1000);
  });

  it("an empty bank isn't a loss; nobody picking in time gets the flag's move played, his jab as the next turn begins", async () => {
    const r = battle(5, { bank: true });
    r.state = { ...r.state, players: r.state.players.map((p) => ({ ...p, bankMs: 0 })) };
    const { fen } = await crowdMove(r, false);
    expect(r.bossOutOfTime()).toBe(false);
    expect(r.stageComplete()).toBe(false);
    const d = r.boss!.powers!.dash!;
    expect(d.flags).toBe(1);
    expect(legalMoves(fen)).toContain(d.flag!.move);
    expect(r.boards.get(r.state.boards[0]!)!.history.at(-1)).toBe(d.flag!.move);
    await r.playBoss(fakeEngine());
    r.deal();
    expect(r.boss!.powers!.events.find((e) => e.kind === "flag")?.move).toBe(d.flag!.move);
    // (The bank stays at 0: the move has its increment.)
    expect(r.allowedMsFor("h0")).toBe(BOSS_CLOCK.incrementSeconds * 1000);
  });

  it("Time Scramble (the test switch): warned as turn 2 begins, then scrambleMoves turns of its first scrambleSeconds (5), the meter empty meanwhile; then the clock as before", async () => {
    const r = battle(7, { test: "scramble" });
    const clocks: number[] = [];
    const kinds: string[][] = [];
    const said: (number | undefined)[] = [];
    for (let i = 0; i < 9; i++) {
      r.deal();
      clocks.push(r.moveClock());
      kinds.push(r.boss!.powers!.events.map((e) => e.kind));
      said.push((r.boss!.powers!.events.find((e) => e.kind === "scramble") as { seconds?: number } | undefined)?.seconds);
      const fen = fenOf(r);
      const allowed = r.crowdAllowed() ?? legalMoves(fen);
      await r.score(new Map([["h0", { move: crowdPick(fen, allowed, mulberry32(i)), thinkMs: 500 }]]));
      if (r.isOver()) break;
      await r.playBoss(fakeEngine());
    }
    const base = kitSettings({ boss: "dash", test: "", maxMoves: 60 }).moveClockSeconds;
    expect(kinds[1]).toContain("warn");
    expect(kinds[2]).toContain("scramble");
    expect(clocks.slice(0, 2)).toEqual([base, base]);
    // (The battle's first Time Scramble: 3 moves of 5 seconds, its moment saying so.)
    expect(clocks.slice(2, 5)).toEqual([5, 5, 5]);
    expect(said[2]).toBe(5);
    expect(clocks.slice(5, 7)).toEqual([base, base]);
  });

  it("his \"Hang on\" (?power=hangon: his second turn) changes nothing in the game: your move stands, the same moves, clocks and bank as a battle without it; his thinking held for it only then (Nov 26)", async () => {
    const run = async (test: string) => {
      const r = battle(11, { test, bank: true });
      const clocks: number[] = [];
      const banks: number[] = [];
      const held: number[] = [];
      for (let i = 0; i < 4; i++) {
        r.deal();
        clocks.push(r.moveClock());
        banks.push(r.allowedMsFor("h0"));
        const fen = fenOf(r);
        const allowed = r.crowdAllowed() ?? legalMoves(fen);
        await r.score(new Map([["h0", { move: crowdPick(fen, allowed, mulberry32(i)), thinkMs: 1500 }]]));
        if (r.isOver()) break;
        // (His thinking after your move: how long it's held for his gags.)
        held.push(popOffMs(r.boss));
        await r.playBoss(fakeEngine());
      }
      return { history: [...r.boards.get(r.state.boards[0]!)!.history], clocks, banks, held, popOff: r.boss!.powers!.dash!.popOff ?? null };
    };
    const gag = await run("hangon");
    const plain = await run("");
    expect(gag.popOff).toEqual({ at: 2, hangOn: true });
    expect(plain.popOff).toBeNull();
    expect(gag.held).toEqual([0, hangOnTimeline().total + DASH_HANG_ON.tailMs, 0, 0]);
    expect(plain.held).toEqual([0, 0, 0, 0]);
    expect(gag.history).toEqual(plain.history);
    expect(gag.clocks).toEqual(plain.clocks);
    expect(gag.banks).toEqual(plain.banks);
  });

  it("each Time Scramble's moment says its own use's seconds and moves: 5 the first time, 3 the second (Eric, Nov 26)", () => {
    for (const [ults, seconds] of [[0, 5], [1, 3]] as const) {
      const next = { seed: 1, turn: 5, material: 39, lost: 0, nextPassive: 2, events: [], warnAt: 4, ults, dash: { slaps: 0, stolen: 0, flags: 0 } } as unknown as BossPowerState;
      const events: PowerEvent[] = [];
      const t = { turn: 5, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", crowd: "w", seed: 1, passive: "clockslap", ultimate: "scramble", test: "", ultNext: false, lastMove: null, rageSpeed: 1, s: S, events } as never;
      expect(DASH.ultimate(next, t)).toBe(true);
      expect(events).toContainEqual(expect.objectContaining({ kind: "scramble", count: 3, seconds }));
    }
  });
});

/**
 * Dash v2 (Eric, Nov 6; docs/decisions/2026-11-06-dash-v2.md): Time Scramble at most twice a battle, a clock fit at most twice, and
 * once a battle his Scramble Rush: 3 of your pieces and 3 of his swept to the middle ranks (on screen only), ten seconds to put them
 * back, under needCorrect back and he moves again at once.
 */
describe("Dash v2: his numbers", () => {
  it("Eric's: Time Scramble at most twice, the Rush's 4 of 6, its 1.00 over five seconds and its ten seconds; the clock's multi-hit every 4 or 5 of his moves (dash-clock.test.ts)", () => {
    expect(S.maxUltimates["dash"]).toBe(2);
    expect(S.dashScramble).toMatchObject({ needCorrect: 4, pieces: 3, ranks: [3, 6], countdownMs: 5000, placeMs: 10000, from: 7 });
    const tl = rushTimeline();
    // (His copies' sweep, 3 to 4 seconds, inside the countdown.)
    expect(tl.scatterUntil - tl.scatterAt).toBeGreaterThanOrEqual(3000);
    expect(tl.scatterUntil - tl.scatterAt).toBeLessThanOrEqual(4000);
    expect(tl.scatterUntil).toBeLessThanOrEqual(tl.countdownMs);
    expect(tl.placeUntil - tl.placeAt).toBe(10000);
    expect(S.dashClockFit).toMatchObject({ every: [4, 5], smacks: 5 });
    expect(POWER_FX.clockFit).toBe(DASH_FX.clockFit);
    expect(POWER_FX.rushExtra).toBe(DASH_FX.rushExtra);
    // (Eric, Nov 6: each piece moved at most twice in the put-back; the Rush's warning as long as every ultimate's.)
    expect(S.dashScramble.movesPerPiece).toBe(2);
    expect(POWER_FX.rushWarn).toBe(POWER_FX.warn);
  });
});

describe("Dash v2: the Scramble Rush's sweep", () => {
  const FENS = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQK2R w KQ - 4 8",
    "4k3/8/3p4/8/8/2N5/8/4K3 w - - 0 40",
    "6k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 30",
  ];
  it("3 of yours and 3 of his (fewer only when a side has fewer), never a king, each to its own empty square of ranks 3 to 6; seeded", () => {
    for (const fen of FENS)
      for (const crowd of ["w", "b"] as const)
        for (let seed = 0; seed < 60; seed++) {
          const moves = chooseRush(fen, crowd, seed, 9);
          expect(chooseRush(fen, crowd, seed, 9)).toEqual(moves);
          const pieces = boardPieces(fen);
          const mine = [...pieces.values()].filter((p) => p[0] === crowd && p[1] !== "k").length;
          const his = [...pieces.values()].filter((p) => p[0] !== crowd && p[1] !== "k").length;
          expect(moves.filter((m) => m.piece[0] === crowd)).toHaveLength(Math.min(3, mine));
          expect(moves.filter((m) => m.piece[0] !== crowd)).toHaveLength(Math.min(3, his));
          // (The crowd's first.)
          expect(moves.findIndex((m) => m.piece[0] !== crowd)).toBe(moves.some((m) => m.piece[0] !== crowd) ? Math.min(3, mine) : -1);
          for (const m of moves) {
            expect(pieces.get(m.from)).toBe(m.piece);
            expect(m.piece[1]).not.toBe("k");
            expect(pieces.has(m.to)).toBe(false);
            expect(Number(m.to[1])).toBeGreaterThanOrEqual(3);
            expect(Number(m.to[1])).toBeLessThanOrEqual(6);
          }
          // (No two from one square, none onto another's: no overlaps.)
          expect(new Set(moves.map((m) => m.from)).size).toBe(moves.length);
          expect(new Set(moves.map((m) => m.to)).size).toBe(moves.length);
          // (The screens' board: the same pieces, the swept ones moved.)
          const shown = boardPieces(rushFen(fen, { moves }));
          expect(shown.size).toBe(pieces.size);
          for (const m of moves) expect(shown.get(m.to)).toBe(m.piece);
        }
  });
});

describe("Dash v2: the Scramble Rush's scoring", () => {
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const rush = {
    moves: [
      { from: "b1", to: "c4", piece: "wn" },
      { from: "a2", to: "e5", piece: "wp" },
      { from: "b2", to: "h3", piece: "wp" },
      { from: "g8", to: "d6", piece: "bn" },
      { from: "c7", to: "a4", piece: "bp" },
      { from: "d8", to: "f5", piece: "bq" },
    ],
  };
  it("untouched, none right; every piece back, all six right (green), the board the game's again", () => {
    expect(rushJudge(fen, rush).correct).toBe(0);
    expect(rushJudge(fen, rush).marks.every((m) => !m.right && !m.placed)).toBe(true);
    const back = Object.fromEntries(rush.moves.map((m) => [m.from, m.from]));
    expect(rushJudge(fen, rush, back).correct).toBe(6);
    expect(rushFen(fen, rush, back)).toBe(fen);
  });
  it("a wrong square (red), a square off or more (king's steps); two like pieces swapped count as both right", () => {
    const j = rushJudge(fen, rush, { b1: "a3", g8: "g6", a2: "b2", b2: "a2" });
    const at = (sq: string) => j.marks.find((m) => m.square === sq)!;
    expect(at("a3")).toMatchObject({ right: false, placed: true, off: 2 });
    expect(at("g6")).toMatchObject({ right: false, placed: true, off: 2 });
    expect(rushJudge(fen, rush, { b1: "a2" }).marks.find((m) => m.square === "a2")).toMatchObject({ right: false, off: 1 });
    // (Your two pawns swapped: the board is right, so both are.)
    expect(at("a2").right && at("b2").right).toBe(true);
    expect(j.correct).toBe(2);
  });
  it("never onto a piece he didn't sweep, nor two onto one square; junk ignored (the piece stays where he dropped it)", () => {
    const j = rushJudge(fen, rush, { b1: "e2", a2: "c3", b2: "c3", g8: "zz", c7: 7 as unknown as string });
    expect(j.marks.map((m) => m.square).sort()).toEqual(["a4", "c3", "c4", "d6", "f5", "h3"].sort());
    expect(j.correct).toBe(0);
  });
  /** Your moves one by one, as a screen sends them (rushKeep): each the whole placements with one piece moved. */
  const putAll = (steps: [string, string][]) => {
    let kept = { places: {} as Record<string, string>, moved: {} as Record<string, number> };
    const refused: number[] = [];
    for (const [i, [from, to]] of steps.entries()) {
      const next = rushKeep(rush, kept.places, kept.moved, { ...kept.places, [from]: to });
      if (next.places[from] !== to) refused.push(i);
      kept = next;
    }
    return { ...kept, refused };
  };
  it("Eric, Nov 6: each swept piece moves at most movesPerPiece (2) times; a third is refused, the piece where it was; counted by the piece, not the square", () => {
    // (The knight: twice, then a third refused; it stays on its second square. Each other piece has its own two.)
    const k = putAll([
      ["b1", "a3"],
      ["b1", "c3"],
      ["b1", "b1"],
      ["a2", "b1"],
      ["a2", "a2"],
      ["b2", "c3"],
    ]);
    expect(k.refused).toEqual([2]);
    expect(k.places.b1).toBe("c3");
    expect(k.moved).toMatchObject({ b1: 2, a2: 2 });
    expect(rushMovesLeft(k.moved, "b1")).toBe(0);
    expect(rushMovesLeft(k.moved, "a2")).toBe(0);
    // (The pawn from a2 stood on b1 for a move: b1's count is still the knight's alone, by where each piece came from.)
    expect(rushMovesLeft(k.moved, "g8")).toBe(2);
    // (Sent whole again, or with an out-of-moves piece changed: nothing changes, nothing counted.)
    expect(rushKeep(rush, k.places, k.moved, { ...k.places })).toEqual({ places: k.places, moved: k.moved });
    expect(rushKeep(rush, k.places, k.moved, { ...k.places, b1: "b1", a2: "e2" }).places).toEqual(k.places);
    // (Junk never counts as a move.)
    expect(rushKeep(rush, {}, {}, { g8: "zz", d8: 4 }).moved).toEqual({});
  });
  it("with the cap: green, red, a square off or more as ever; out of moves on one piece, the rest still go back and count", () => {
    // The knight put a square off, then two off: out of moves, it stays red; the other five go home, five right.
    const k = putAll([
      ["b1", "a2"],
      ["b1", "a3"],
      ["b1", "b1"],
      ...rush.moves.filter((m) => m.from !== "b1").map((m) => [m.from, m.from] as [string, string]),
    ]);
    expect(k.refused).toEqual([2]);
    const j = rushJudge(fen, rush, k.places);
    expect(j.marks.find((m) => m.square === "a3")).toMatchObject({ right: false, placed: true, off: 2 });
    expect(j.correct).toBe(5);
    expect(rushHeld([j.correct], 6)).toBe(true);
    // (Its first move: a square off, "Close, but not quite!".)
    expect(rushJudge(fen, rush, { b1: "a2" }).marks.find((m) => m.square === "a2")).toMatchObject({ right: false, off: 1 });
    // Three home and the rest out of moves on wrong squares: three, too few (his extra move).
    const f = putAll([
      ["b1", "b1"],
      ["a2", "a2"],
      ["b2", "b2"],
      ["g8", "g6"],
      ["g8", "h6"],
      ["g8", "g8"],
    ]);
    expect(f.refused).toEqual([5]);
    expect(rushJudge(fen, rush, f.places).correct).toBe(3);
    expect(rushHeld([3], 6)).toBe(false);
  });
  it("the crowd holds at needCorrect back on average (people's and bots'); bots each piece with botHit's chance, seeded", () => {
    expect(rushHeld([4], 6)).toBe(true);
    expect(rushHeld([3], 6)).toBe(false);
    expect(rushHeld([0], 6)).toBe(false);
    expect(rushHeld([6, 2], 6)).toBe(true);
    expect(rushHeld([5, 2], 6)).toBe(false);
    // (Fewer swept than needCorrect: all of them.)
    expect(rushHeld([2], 2)).toBe(true);
    let sum = 0;
    for (let i = 0; i < 400; i++) {
      const n = botRushCorrect(11, `b${i}`, { at: 8, moves: rush.moves });
      expect(botRushCorrect(11, `b${i}`, { at: 8, moves: rush.moves })).toBe(n);
      sum += n;
    }
    expect(sum / 400).toBeCloseTo(6 * S.dashScramble.botHit, 0);
  });
});

describe("Dash v2: the Scramble Rush in a battle", () => {
  /** Plays to the Rush (the test switch: warned as the second turn begins, it comes as the third does); returns the position it froze. */
  async function toRush(seed: number, entrants?: { id: string; name: string; isBot: boolean }[]) {
    const r = battle(seed, { test: "rush", entrants });
    await crowdMove(r);
    await r.playBoss(fakeEngine());
    expect(r.rushDue()).toBe(false);
    await crowdMove(r);
    await r.playBoss(fakeEngine());
    expect(r.rushDue()).toBe(true);
    return { r, fen: fenOf(r), plies: r.boards.get(r.state.boards[0]!)!.history.length };
  }
  const placesFor = (r: MatchRunner, right: number) => Object.fromEntries(r.boss!.powers!.dash!.rush!.moves.slice(0, right).map((m) => [m.from, m.from]));

  for (const [right, held] of [
    [4, true],
    [3, false],
    [0, false],
  ] as const)
    it(`${right} of 6 back: ${held ? "held, your turn as ever" : "he moves again at once (his quiet extra move, unscored)"}; the board the game's own throughout`, async () => {
      const { r, fen, plies } = await toRush(21 + right);
      const rush = r.boss!.powers!.dash!.rush!;
      expect(rush.moves).toHaveLength(6);
      expect(rush.at).toBe(r.boss!.crowdMoves);
      const out = r.finishRush({ h0: placesFor(r, right) });
      expect(out.correct.h0).toBe(right);
      expect(out.held).toBe(held);
      // (Restored: the game's position never changed.)
      expect(fenOf(r)).toBe(fen);
      expect(r.rushDue()).toBe(false);
      // (Judged once: a second answer changes nothing.)
      expect(r.finishRush({ h0: placesFor(r, 6) }).held).toBe(held);
      expect(r.extraMoveDue()).toBe(!held);
      if (!held) {
        const move = await r.playExtraMove(fakeEngine());
        expect(move).toBeTruthy();
        expect(r.boards.get(r.state.boards[0]!)!.history.length).toBe(plies + 1);
        expect(r.boss!.powers!.dash!.rush!.extra).toBe("played");
        expect(r.boss!.powers!.events.some((e) => e.kind === "rushExtra")).toBe(true);
        expect(r.extraMoveDue()).toBe(false);
        // (Still the crowd's turn, with the boss's move logged: the side to move is the crowd's.)
        expect(fenOf(r).split(" ")[1]).toBe(fen.split(" ")[1]);
      } else expect(fenOf(r)).toBe(fen);
      // On with the crowd's turn as usual.
      await crowdMove(r);
      expect(r.isOver()).toBe(false);
    });

  it("Eric, Nov 8: solo, only your own put-back counts (no bots, no mean); online, the crowd's mean; the verdict is the extra move's", async () => {
    const crowd = [
      { id: "h0", name: "H", isBot: false },
      { id: "h1", name: "I", isBot: false },
      { id: "h2", name: "J", isBot: false },
      { id: "h3", name: "K", isBot: false },
      { id: "b0", name: "B", isBot: true },
    ];
    const places = (r: MatchRunner) => ({ h0: placesFor(r, 2), h1: placesFor(r, 6), h2: placesFor(r, 6), h3: placesFor(r, 6) });
    // Online: everyone's count, the bot's from the seed, and their mean: your 2 carried by the others' 6s.
    const online = (await toRush(31, crowd)).r;
    const all = online.finishRush(places(online));
    expect(Object.keys(all.correct).sort()).toEqual(["b0", "h0", "h1", "h2", "h3"]);
    expect(all.mean).toBeCloseTo((2 + 18 + all.correct.b0!) / 5, 9);
    expect(all.held).toBe(true);
    expect(online.extraMoveDue()).toBe(false);
    expect(online.boss!.powers!.dash!.rush!.extra).toBeUndefined();
    // Solo: yours alone, the same placements: 2 of 6, too few, and he moves again (the verdict and the move one field).
    const { r: solo, plies } = await toRush(31, crowd);
    const mine = solo.finishRush(places(solo), "h0");
    expect(mine).toEqual({ correct: { h0: 2 }, mean: 2, held: false });
    expect(solo.boss!.powers!.dash!.rush).toMatchObject({ correct: 2, extra: "due" });
    expect(solo.extraMoveDue()).toBe(true);
    expect(await solo.playExtraMove(fakeEngine())).toBeTruthy();
    expect(solo.boards.get(solo.state.boards[0]!)!.history.length).toBe(plies + 1);
    // Solo with all 4 back: held, no extra move.
    const pass = (await toRush(32, crowd)).r;
    expect(pass.finishRush({ h0: placesFor(pass, 4) }, "h0").held).toBe(true);
    expect(pass.extraMoveDue()).toBe(false);
  });

  it("Nov 8: once due he never skips it: no engine answer (or a move that isn't a quiet candidate) and he plays a quiet one from the seed", async () => {
    for (const move of [null, "zzzz"]) {
      const { r, fen, plies } = await toRush(41);
      r.finishRush({ h0: {} }, "h0");
      expect(r.extraMoveDue()).toBe(true);
      const played = r.applyExtraMove(move);
      expect(played).toBeTruthy();
      expect(extraMoveCandidates(passTurn(fen)!)).toContain(played);
      expect(r.boss!.powers!.dash!.rush!.extra).toBe("played");
      expect(r.boards.get(r.state.boards[0]!)!.history.length).toBe(plies + 1);
      expect(fenOf(r).split(" ")[1]).toBe(fen.split(" ")[1]);
    }
    // (An engine that fails: the same stand-in.)
    const { r, plies } = await toRush(42);
    r.finishRush({ h0: {} }, "h0");
    const broken = { topMoves: async () => Promise.reject(new Error("gone")), scoreMoves: async () => Promise.reject(new Error("gone")) };
    expect(await r.playExtraMove(broken as never)).toBeTruthy();
    expect(r.boards.get(r.state.boards[0]!)!.history.length).toBe(plies + 1);
  });

  it("Eric, Nov 6: warned a turn ahead (RAGE!, \"Next turn: Scramble Rush\"), your one move as ever in between, then it comes", async () => {
    const r = battle(4, { test: "rush" });
    await crowdMove(r);
    await r.playBoss(fakeEngine());
    // As your second turn begins: the warning, and nothing swept; your turn as ever (nobody's clock waits on a Rush).
    expect(r.boss!.powers!.events.map((e) => e.kind)).toContain("rushWarn");
    const warnedAt = r.boss!.powers!.dash!.rushWarn!;
    expect(warnedAt).toBe(r.boss!.crowdMoves + 1);
    expect(r.boss!.powers!.dash!.rush ?? null).toBeNull();
    expect(r.rushDue()).toBe(false);
    const { move } = await crowdMove(r);
    expect(move).toBeTruthy();
    await r.playBoss(fakeEngine());
    // As the next begins: the Rush (after his move), no second warning; your turn waits for it.
    expect(r.boss!.powers!.events.some((e) => e.kind === "rushWarn")).toBe(false);
    expect(r.boss!.powers!.dash!.rush!.at).toBe(warnedAt);
    expect(r.boss!.crowdMoves).toBe(warnedAt);
    expect(r.rushDue()).toBe(true);
  });

  it("in a battle without the switch: never before turn 7, at most once; Time Scramble at most twice; the clock's multi-hits every 4 or 5 of his moves", async () => {
    let came = 0;
    for (const seed of [2, 5]) {
      const r = battle(seed);
      const rushes: number[] = [];
      const warns: number[] = [];
      let scrambles = 0;
      let fits = 0;
      for (let i = 0; i < 45 && !r.isOver(); i++) {
        if (r.rushDue()) {
          rushes.push(r.boss!.crowdMoves + 1);
          r.finishRush({});
          if (r.extraMoveDue()) await r.playExtraMove(fakeEngine());
        }
        r.deal();
        if (r.boss!.powers!.events.some((e) => e.kind === "rushWarn")) warns.push(r.boss!.crowdMoves + 1);
        scrambles += r.boss!.powers!.events.filter((e) => e.kind === "scramble").length;
        fits += r.boss!.powers!.events.filter((e) => e.kind === "clockFit").length;
        const f = fenOf(r);
        const allowed = r.crowdAllowed() ?? legalMoves(f);
        await r.score(new Map([["h0", { move: crowdPick(f, allowed, mulberry32(i + seed)), thinkMs: 500 }]]));
        if (r.isOver() || r.stageComplete() || !r.bossToMove()) break;
        await r.playBoss(fakeEngine());
      }
      expect(rushes.length).toBeLessThanOrEqual(1);
      // (Each Rush warned as the turn before it began, and only once.)
      expect(warns.length).toBeLessThanOrEqual(1);
      for (const t of rushes) expect(warns).toEqual([t - 1]);
      came += rushes.length;
      for (const t of rushes) expect(t).toBeGreaterThanOrEqual(S.dashScramble.from);
      expect(scrambles).toBeLessThanOrEqual(2);
      // (Every 4 or 5 of his moves: 45 turns at most, so at most 11 multi-hits; the schedule's own count.)
      expect(fits).toBeGreaterThan(0);
      expect(fits).toBeLessThanOrEqual(Math.ceil(45 / 4));
    }
    // (It came in these battles: his meter half full by about turn 13.)
    expect(came).toBeGreaterThan(0);
  });
});

describe("Dash: his stall skit and his clock tap (Eric, Nov 17)", () => {
  const fresh = (seed = 7, extra: Record<string, unknown> = {}) =>
    ({ id: "dash", crowdMoves: 0, crowdSide: "w", powers: { seed, turn: 1, events: [], dash: { slaps: 0, stolen: 0, flags: 0 }, ...extra } }) as never;
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("when: on a bank at slamSeconds and fakeSeconds (20 s, 30 s); on a move clock at its half and three quarters (10 s, 15 s of 20); the test switch's; the skit's beats add up", () => {
    expect([DASH_STALL.slamSeconds, DASH_STALL.fakeSeconds, DASH_STALL.slamShare, DASH_STALL.fakeShare, DASH_STALL.slamMs]).toEqual([20, 30, 0.5, 0.75, 5000]);
    expect(stallPlan(fresh(), START, 610_000, true)).toMatchObject({ slamAt: 20_000, fakeAt: 30_000 });
    expect(stallPlan(fresh(), START, 20_000, false)).toMatchObject({ slamAt: 10_000, fakeAt: 15_000 });
    expect(stallPlan(fresh(), START, 610_000, true, "stall")).toMatchObject(DASH_STALL.test);
    const tl = stallTimeline();
    expect([tl.bragAt, tl.jkAt, tl.backAt, tl.total]).toEqual([DASH_STALL.landMs, DASH_STALL.landMs + DASH_STALL.bragMs, DASH_STALL.landMs + DASH_STALL.bragMs + DASH_STALL.jkMs, DASH_STALL.landMs + DASH_STALL.bragMs + DASH_STALL.jkMs + DASH_STALL.backMs]);
  });

  it("not on a move that can't reach the fake move with marginMs to spare, once it has come, with another moment of his, a scramble, his Rush, the re-pick after a Last Stand, in check, or for another boss", () => {
    expect(stallPlan(fresh(), START, 30_000 + DASH_STALL.marginMs - 1, true)).toBeNull();
    expect(stallPlan(fresh(), START, 30_000 + DASH_STALL.marginMs, true)).not.toBeNull();
    expect(stallPlan(fresh(7, { dash: { slaps: 0, stolen: 0, flags: 0, stall: { at: 3, move: "g8f6" } } }), START, 610_000, true)).toBeNull();
    // (A reconnect mid-skit: the pauses so far, the slam's left out when the fake move came alone.)
    const hold = stallTimeline().total;
    expect(stallPausedMs({ beat: "slam", at: 0, until: DASH_STALL.slamMs })).toBe(DASH_STALL.slamMs);
    expect(stallPausedMs({ beat: "fake", at: 0, until: hold })).toBe(DASH_STALL.slamMs + hold);
    expect(stallPausedMs({ beat: "fake", at: 0, until: hold, alone: true })).toBe(hold);
    // (Each once a battle, apart: after the slam, the fake move alone; after both, nothing.)
    expect(stallPlan(fresh(7, { dash: { slaps: 0, stolen: 0, flags: 0, slam: { at: 3 } } }), START, 610_000, true)).toMatchObject({ slamAt: null, fakeAt: 30_000 });
    expect(stallPlan(fresh(7, { dash: { slaps: 0, stolen: 0, flags: 0, slam: { at: 3 } } }), START, 20_000, false)).toMatchObject({ slamAt: null, fakeAt: 15_000 });
    expect(stallPlan(fresh(7, { dash: { slaps: 0, stolen: 0, flags: 0, slam: { at: 3 }, stall: { at: 5, move: "g8f6" } } }), START, 610_000, true)).toBeNull();
    // (Eric, Nov 18: the short moments at a move's start, over before its clock starts, leave his beats on it: a real game has one on
    // most moves (a slap after each capture, a clock fit every 4-5 turns). Those still to play on the move rule them out.)
    for (const kind of ["slap", "flag", "clockFit"]) expect(stallPlan(fresh(7, { events: [{ kind, turn: 1 }] }), START, 610_000, true), kind).toMatchObject({ slamAt: 20_000, fakeAt: 30_000 });
    for (const kind of ["warn", "scramble", "rushWarn", "rushExtra"]) expect(stallPlan(fresh(7, { events: [{ kind, turn: 1 }] }), START, 610_000, true), kind).toBeNull();
    expect(stallPlan(fresh(7, { ultAt: 1 }), START, 610_000, true)).toBeNull();
    expect(stallPlan(fresh(7, { dash: { slaps: 0, stolen: 0, flags: 0, rush: { at: 0, moves: [] } } }), START, 610_000, true)).toBeNull();
    expect(stallPlan({ ...(fresh() as object), barred: "e2e4" } as never, START, 610_000, true)).toBeNull();
    const check = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(inCheck(check)).toBe(true);
    expect(stallPlan(fresh(), check, 610_000, true)).toBeNull();
    expect(stallPlan({ ...(fresh() as object), id: "tiger" } as never, START, 610_000, true)).toBeNull();
  });

  it("his move: one of his legal moves were you to pass, quiet (no capture, castling, promotion or en passant), giving no check; the same from the same seed and turn", () => {
    const fens = [START, "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "8/2P5/8/3k4/8/8/4K3/7r w - - 0 1"];
    for (const fen of fens)
      for (let seed = 1; seed < 40; seed++) {
        const passed = passTurn(fen)!;
        const m = stallMove(passed, seed, 3)!;
        expect(legalMoves(passed)).toContain(m);
        expect(m.length).toBe(4);
        expect(pieceAt(passed, m.slice(2, 4))).toBeNull();
        expect(inCheck(applyMove(passed, m))).toBe(false);
        expect(stallMove(passed, seed, 3)).toBe(m);
      }
    expect(new Set(Array.from({ length: 30 }, (_, i) => stallMove(passTurn(START)!, i, 1))).size).toBeGreaterThan(3);
  });

  it("through a battle: planned on your move, recorded once as the fake move comes, the position and the clocks as they were; never again after", async () => {
    const r = battle(11, { bank: true });
    r.deal();
    const plan = r.stallPlan("h0")!;
    expect(plan).toMatchObject({ slamAt: 20_000, fakeAt: 30_000 });
    const before = { fen: fenOf(r), banks: r.state.players.map((p) => p.bankMs), history: r.boards.get(r.state.boards[0]!)!.history.length };
    r.stalled(plan.move!);
    expect(r.boss!.powers!.dash!.stall).toEqual({ at: 0, move: plan.move });
    expect({ fen: fenOf(r), banks: r.state.players.map((p) => p.bankMs), history: r.boards.get(r.state.boards[0]!)!.history.length }).toEqual(before);
    r.stalled("a7a6");
    expect(r.boss!.powers!.dash!.stall!.move).toBe(plan.move);
    r.slammed();
    r.slammed();
    expect(r.boss!.powers!.dash!.slam).toEqual({ at: 0 });
    for (let i = 0; i < 6 && !r.boss!.result; i++) {
      await crowdMove(r);
      if (r.boss!.result) break;
      await r.playBoss(fakeEngine());
      r.deal();
      // (The skit spent; his clock tap may still come.)
      expect(r.stallPlan("h0")?.fakeAt ?? null, `turn ${i + 2}`).toBeNull();
      expect(r.stallPlan("h0")?.slamAt ?? null, `turn ${i + 2}`).toBeNull();
    }
  });

  it("armed until it comes: a move before the fake move (the plan never recorded) leaves it for a later move", async () => {
    const r = battle(12, { bank: true });
    r.deal();
    expect(r.stallPlan("h0")).not.toBeNull();
    // (Your move goes in before it: nothing recorded. The next move with none of his moments has it planned again.)
    let again = 0;
    for (let i = 0; i < 8 && !again && !r.boss!.result; i++) {
      await crowdMove(r);
      if (r.boss!.result) break;
      await r.playBoss(fakeEngine());
      r.deal();
      expect(r.boss!.powers!.dash!.stall ?? null).toBeNull();
      if (!r.boss!.powers!.events.length && passTurn(fenOf(r))) {
        expect(r.stallPlan("h0")).not.toBeNull();
        again++;
      }
    }
    expect(again).toBe(1);
  });

  // (Crowd move `turn`, his powers' fields `powers`.)
  const onMove = (turn: number, powers: Record<string, unknown> = {}, dash: Record<string, unknown> = {}) =>
    ({ id: "dash", crowdMoves: turn - 1, crowdSide: "w", powers: { seed: 7, turn, events: [], ...powers, dash: { slaps: 0, stolen: 0, flags: 0, ...dash } } }) as never;

  it("his clock tap only when you're slow (Eric, Nov 17: \"it fired off like 5 seconds into the match even tho I played all my moves instantly\"): from move 3 at 10 s of a bank's move, 30% of a move clock; ?power=clocktap from the first; never with another moment of his", () => {
    expect([DASH_TAP.fromMove, DASH_TAP.afterMs, DASH_TAP.afterShare]).toEqual([3, 10_000, 0.3]);
    for (const turn of [1, 2]) expect(stallPlan(onMove(turn), START, 610_000, true)?.tapAt ?? null, `move ${turn}`).toBeNull();
    expect(stallPlan(onMove(3), START, 610_000, true)).toMatchObject({ tapAt: 10_000, slamAt: 20_000, fakeAt: 30_000 });
    expect(stallPlan(onMove(3), START, 20_000, false)).toMatchObject({ tapAt: 6_000, slamAt: 10_000, fakeAt: 15_000 });
    expect(stallPlan(onMove(1), START, 610_000, true, "clocktap")).toMatchObject({ tapAt: 10_000 });
    // (A move clock too short for the skit still has the tap; one too short for the tap has nothing.)
    expect(stallPlan(onMove(3), START, 7_000, false)).toMatchObject({ tapAt: 2_100, slamAt: null, fakeAt: null, move: null });
    expect(stallPlan(onMove(3), START, 9_000, true)).toBeNull();
    // (Never in the move's last DASH_STALL.marginMs (review of #775: solo started a crawl at 10.0 s of a 10.3 s bank, and flagged under
    // it): solo and the server plan the same.)
    expect(DASH_STALL.marginMs).toBe(2000);
    expect(stallPlan(onMove(3), START, 10_300, true)).toBeNull();
    expect(stallPlan(onMove(3), START, 11_999, true)).toBeNull();
    expect(stallPlan(onMove(3), START, 12_000, true)).toMatchObject({ tapAt: 10_000, slamAt: null });
    // (Beside the short moments at a move's start (Eric, Nov 18); never with one still to play on it.)
    for (const kind of ["slap", "flag", "clockFit"]) expect(stallPlan(onMove(5, { events: [{ kind, turn: 5 }] }), START, 610_000, true), kind).toMatchObject({ tapAt: 10_000 });
    for (const kind of ["warn", "scramble", "rushWarn", "rushExtra"]) expect(stallPlan(onMove(5, { events: [{ kind, turn: 5 }] }), START, 610_000, true), kind).toBeNull();
  });

  it("his clock tap and his stall skit never share a move (Eric, Nov 17: \"the bigger gag is reserved for another turn\"): the first to come takes it", () => {
    const plan = { tapAt: 10_000, slamAt: 20_000, fakeAt: 30_000, move: "g8f6" };
    expect(nextBeat(plan, {})).toEqual({ beat: "tap", at: 10_000 });
    expect(nextBeat(plan, { tap: {} })).toBeNull();
    expect(nextBeat({ ...plan, tapAt: null }, {})).toEqual({ beat: "slam", at: 20_000 });
    expect(nextBeat(plan, { slam: {} })).toEqual({ beat: "fake", at: 30_000 });
    expect(nextBeat(plan, { slam: {}, fake: {} })).toBeNull();
    // (His slam spent on an earlier move: the tap still comes first, at 10 s against the fake move's 30.)
    expect(nextBeat({ ...plan, slamAt: null }, {})).toEqual({ beat: "tap", at: 10_000 });
    // (?power=stall's early beats: the skit takes the move, the tap waits.)
    expect(nextBeat({ ...plan, slamAt: 1500, fakeAt: 3500 }, {})).toEqual({ beat: "slam", at: 1500 });
    expect(nextBeat({ ...plan, slamAt: 1500, fakeAt: 3500 }, { slam: {} })).toEqual({ beat: "fake", at: 3500 });
  });

  it("his clock tap through a battle: recorded once as it comes, nothing more of his on its move (no slam, no fake move), the skit on the next slow move; the position and clocks as they were", async () => {
    const r = battle(13, { bank: true, test: "clocktap" });
    r.deal();
    expect(r.stallPlan("h0")).toMatchObject({ tapAt: 10_000, slamAt: 20_000 });
    const before = { fen: fenOf(r), banks: r.state.players.map((p) => p.bankMs) };
    r.tapped();
    r.tapped();
    expect(r.boss!.powers!.dash!.tap).toEqual({ at: 0 });
    expect(dashView(r.boss!.powers!)!.tap).toEqual({ at: 0 });
    expect({ fen: fenOf(r), banks: r.state.players.map((p) => p.bankMs) }).toEqual(before);
    expect(r.stallPlan("h0")).toBeNull();
    let skit = 0;
    for (let i = 0; i < 6 && !skit && !r.boss!.result; i++) {
      await crowdMove(r);
      if (r.boss!.result) break;
      await r.playBoss(fakeEngine());
      r.deal();
      const plan = r.stallPlan("h0");
      expect(plan?.tapAt ?? null).toBeNull();
      if (plan) {
        expect(plan).toMatchObject({ slamAt: 20_000, fakeAt: 30_000 });
        skit++;
      }
    }
    expect(skit).toBe(1);
    expect(r.boss!.powers!.events.map((e) => e.kind as string)).not.toContain("clockTap");
  });
});

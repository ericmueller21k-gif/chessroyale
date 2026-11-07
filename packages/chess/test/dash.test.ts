import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_CLOCK, BOSS_POWERS, BOSS_ROSTER, adminFirst, bossClockSettings, isPlayable, menuBosses, mulberry32, type Settings } from "@chessroyale/core";
import { DASH_ANIM, DASH_FX, MatchRunner, POWER_FX, boardPieces, botRushCorrect, bossThinkMs, chooseRush, dashMoveClock, fitSmacks, fitTurns, flagMove, legalMoves, rushFen, rushHeld, rushJudge, rushKeep, rushMovesLeft, rushTimeline, scrambleLeft, scrambleOn, slappedClock } from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Dash, the cheetah (docs/decisions/2026-11-03-dash.md): Clock Slap (each capture of his steals time from your clock: the bank,
 * or a raid's next move), Time Scramble (after the usual warning, your next 5 moves get 3 s each), and out of time never a loss
 * (a move played for you from the judge's top moves).
 */

const S = BOSS_POWERS;

function battle(seed: number, opts: { test?: string; bank?: boolean } = {}) {
  const base = kitSettings({ boss: "dash", test: opts.test ?? "", maxMoves: 60 });
  const settings: Settings = opts.bank ? { ...base, ...bossClockSettings(base) } : base;
  const r = new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
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
    // (Eric's: 5 moves of 3 seconds. The sim's: 30 s a slap off the bank, the flag from the top 4, the usual meter.)
    expect([S.scrambleMoves, S.scrambleSeconds, S.slapBankSeconds, S.slapMoveSeconds, S.slapMoveMin, S.flagTop, S.rageSpeed.dash]).toEqual([5, 3, 30, 6, 8, 4, 1]);
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

  it("a scrambled move's clock is scrambleSeconds, for exactly scrambleMoves crowd turns from the one it came", () => {
    for (const turn of [5, 6, 7, 8, 9]) expect(scrambleOn({ ultAt: 5 }, turn)).toBe(true);
    for (const turn of [4, 10]) expect(scrambleOn({ ultAt: 5 }, turn)).toBe(false);
    expect([5, 7, 9, 10].map((t) => scrambleLeft({ ultAt: 5 }, t))).toEqual([5, 3, 1, 0]);
    expect(dashMoveClock(boss({ ultAt: 5 }, 4), 20)).toBe(S.scrambleSeconds);
    expect(dashMoveClock(boss({ ultAt: 5 }, 4), 1200)).toBe(S.scrambleSeconds);
    expect(dashMoveClock(boss({ ultAt: 5 }, 9), 20)).toBe(20);
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

  it("Time Scramble (the test switch): warned as turn 2 begins, then scrambleMoves turns of scrambleSeconds, the meter empty meanwhile; then the clock as before", async () => {
    const r = battle(7, { test: "scramble" });
    const clocks: number[] = [];
    const kinds: string[][] = [];
    for (let i = 0; i < 9; i++) {
      r.deal();
      clocks.push(r.moveClock());
      kinds.push(r.boss!.powers!.events.map((e) => e.kind));
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
    expect(clocks.slice(2, 7)).toEqual(Array(S.scrambleMoves).fill(S.scrambleSeconds));
    expect(clocks[7]).toBe(base);
  });
});

/**
 * Dash v2 (Eric, Nov 6; docs/decisions/2026-11-06-dash-v2.md): Time Scramble at most twice a battle, a clock fit at most twice, and
 * once a battle his Scramble Rush: 3 of your pieces and 3 of his swept to the middle ranks (on screen only), ten seconds to put them
 * back, under needCorrect back and he moves again at once.
 */
describe("Dash v2: his numbers", () => {
  it("Eric's: Time Scramble at most twice, the Rush's 4 of 6, its 1.00 over five seconds and its ten seconds; a fit at most twice, 3 to 5 smacks", () => {
    expect(S.maxUltimates["dash"]).toBe(2);
    expect(S.dashScramble).toMatchObject({ needCorrect: 4, pieces: 3, ranks: [3, 6], countdownMs: 5000, placeMs: 10000, from: 7 });
    const tl = rushTimeline();
    // (His copies' sweep, 3 to 4 seconds, inside the countdown.)
    expect(tl.scatterUntil - tl.scatterAt).toBeGreaterThanOrEqual(3000);
    expect(tl.scatterUntil - tl.scatterAt).toBeLessThanOrEqual(4000);
    expect(tl.scatterUntil).toBeLessThanOrEqual(tl.countdownMs);
    expect(tl.placeUntil - tl.placeAt).toBe(10000);
    expect(S.dashClockFit).toMatchObject({ max: 2, smacks: [3, 5] });
    for (let seed = 0; seed < 300; seed++) {
      const turns = fitTurns(seed);
      expect(turns).toHaveLength(2);
      expect(new Set(turns).size).toBe(2);
      for (const t of turns) {
        expect(t).toBeGreaterThanOrEqual(S.dashClockFit.from);
        expect(t).toBeLessThanOrEqual(S.dashClockFit.to);
        expect(fitSmacks(seed, t)).toBeGreaterThanOrEqual(3);
        expect(fitSmacks(seed, t)).toBeLessThanOrEqual(5);
      }
    }
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
  async function toRush(seed: number) {
    const r = battle(seed, { test: "rush" });
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

  it("in a battle without the switch: never before turn 7, at most once; Time Scramble at most twice; a clock fit at most twice", async () => {
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
      expect(fits).toBeLessThanOrEqual(2);
    }
    // (It came in these battles: his meter half full by about turn 13.)
    expect(came).toBeGreaterThan(0);
  });
});

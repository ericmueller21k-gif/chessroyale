import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_CLOCK, BOSS_POWERS, BOSS_ROSTER, adminFirst, bossClockSettings, isPlayable, menuBosses, mulberry32, type Settings } from "@chessroyale/core";
import { DASH_ANIM, DASH_FX, MatchRunner, POWER_FX, bossThinkMs, dashMoveClock, flagMove, legalMoves, scrambleLeft, scrambleOn, slappedClock } from "../src/index.ts";
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

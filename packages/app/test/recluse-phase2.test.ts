import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS, RAID_SETTINGS, RECLUSE_PHASE2, bossBannerMs, finishBoss } from "@chessroyale/core";
import { legalMoves, phase2Numbers, type MoveScore } from "@chessroyale/chess";
import { ARC_LIFE, ARC_STRIKES, PHASE_CHANGE, Phase2Game, arcPoints, phase2Follows, phase2Mates, phaseChangeRun, smoothPath } from "../src/recluse-phase2.ts";
import { RECLUSE, RECLUSE_BUST, suited } from "../src/characters/recluse.ts";
import { CHANGE_HANDS, RECLUSE_CHANGE, RECLUSE_CHANGE_BOOK } from "../src/characters/recluse-transform.ts";
import { CRITICAL, NORMAL, Voice, bossVoice } from "../src/speech.tsx";
import { pacedLine, pacedPage, pacedTyped } from "../src/paced-line.ts";
import { HUMAN, loadOpenings, SoloMatch } from "../src/solo.ts";
import { KING_LINES, kingLine, kingSay, resetKingSpeech } from "../src/godKing.ts";
import { KING_VS_RECLUSE, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { animLength } from "../src/characters/power-art.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

// The Hidden Boss's phase 2 on this device (recluse-phase2.ts): the phase change's beats, and the four boards driven
// with pretend engines and a pretend clock. Its rules: packages/chess/test/recluse-phase2.test.ts.

describe("when phase 2 follows, and who plays it beside you", () => {
  const won = { bossId: "recluse", result: "crowd" };
  it("after phase 1 won against him: alone (Boss alone) and in a solo Crowd's boss final (Oct 14); never a Solo raid, another boss, or a loss", () => {
    expect(phase2Follows({ ...won, raid: true, raidBots: false, crowdFinal: false })).toBe(true);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: true })).toBe(true);
    expect(phase2Follows({ ...won, raid: true, raidBots: true, crowdFinal: false })).toBe(false);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: false })).toBe(false);
    for (const result of ["boss", "draw", null]) expect(phase2Follows({ ...won, result, raid: false, raidBots: false, crowdFinal: true })).toBe(false);
    expect(phase2Follows({ ...won, bossId: "clown", raid: false, raidBots: false, crowdFinal: true })).toBe(false);
  });

  it("the other boards: the finalists who fought beside you, then fresh bots for any left (Boss alone: all fresh), one a board", () => {
    const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Fresh ${i}` }));
    const boards = RECLUSE_PHASE2.boards;
    const finalists = [{ id: "bot7", name: "Ann" }, { id: "bot0", name: "Bo" }, { id: "bot3", name: "Cy" }];
    expect(phase2Mates(finalists, boards, fresh)).toEqual(finalists);
    expect(phase2Mates([], boards, fresh)).toEqual(fresh(boards - 1));
    expect(phase2Mates([...finalists, { id: "bot9", name: "Di" }], boards, fresh)).toEqual(finalists);
    // One short (somebody struck): a fresh bot, under an id of its own.
    const two = phase2Mates(finalists.slice(0, 2), boards, fresh);
    expect(two).toHaveLength(boards - 1);
    expect(new Set(two.map((b) => b.id)).size).toBe(boards - 1);
    expect(two.slice(0, 2)).toEqual(finalists.slice(0, 2));
  });
});

describe("the phase change", () => {
  it("is about 23 s from his cutscene's end to the end of \"PHASE 2\" (Eric, Nov 14: his transformation by the book's light), its beats in order: the book, the light taking him, the rise, the light growing, the white-out, the reveal, the visor up and down, the leap, the crack, the split, the book back, the leap home", () => {
    const C = PHASE_CHANGE;
    expect(C.fallMs).toBeGreaterThanOrEqual(1500);
    expect(C.fallMs).toBeLessThanOrEqual(2000);
    expect(C.total).toBeGreaterThanOrEqual(20_000);
    expect(C.total).toBeLessThanOrEqual(26_000);
    const order = [0, C.burstAt, C.riseAt, C.riseAt + C.riseMs, C.shootAt, C.radiateAt, C.whiteAt, C.whiteFull, C.downAt, C.revealAt, C.flipUpAt, C.line1At, C.flipDownAt, C.crouchAt, C.upAt, C.crackAt, C.partAt, C.growAt, C.growAt + C.growMs, C.pickupAt, C.catchAt, C.backAt, C.homeAt, C.bannerAt, C.total];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // (Every beat a setting.)
    // (Every beat a setting, from the transformation theme's start, `musicAtMs` into the phase change.)
    const S = RECLUSE_PHASE2.change.transform;
    for (const [k, v] of Object.entries(S)) expect((C as unknown as Record<string, number>)[k], k).toBe(["musicAtMs", "introMs", "riseMs", "leapMs", "line2AfterMs"].includes(k) ? v : v + S.musicAtMs);
    // (The pieces fly to their Chess960 squares as the book comes back to him, and land before "PHASE 2".)
    expect(C.shuffleAt).toBeGreaterThanOrEqual(C.pickupAt);
    expect(C.shuffleAt + C.shuffleMs).toBeLessThanOrEqual(C.bannerAt);
    expect([C.partAt - C.crackAt, C.growAt - C.partAt, C.growMs, C.shuffleMs]).toEqual([750, 400, 900, 900]);
    // (Then the countdown on phase 2's boards before the clocks: a setting.)
    expect(C.countdownMs).toBe(RECLUSE_PHASE2.change.countdownSeconds * 1000);
    // (Phase 2's frames, all drawn: his idle, his slam and laugh, the placeholder's glow.)
    for (const a of ["idle2", "slam2", "laugh2", "spellbook2", "spellLoop2", "collapseLoop"]) expect(RECLUSE.anims[a], a).toBeDefined();
  });

  it("the board cracks on the transformation theme's drop (its intro's length, themes.json), the light taking him on its slam and lifting him on its build; he leaps on its breath, a second before", () => {
    const C = PHASE_CHANGE;
    const themes = JSON.parse(readFileSync(new URL("../public/music/themes.json", import.meta.url), "utf8"));
    // (Its intro starts a moment into the phase change, so a device a little late to it still plays the whole intro.)
    expect(C.musicAtMs).toBeGreaterThanOrEqual(200);
    expect(C.crackAt - C.musicAtMs).toBe(Math.round(themes.themes["recluse-phase3"].introSeconds * 1000));
    expect(C.crackAt - C.upAt).toBe(1000);
    // (The music's marks: the slam 2.64 s in, the build 3.04 s, the breath a second before the drop.)
    expect([C.burstAt - C.musicAtMs, C.riseAt - C.musicAtMs]).toEqual([2640, 3040]);
  });

  it("his two lines (Eric, Nov 13 and 14), typed at the cutscene's pace: the first (a little faster) from his visor up, readable whole 2.8 s, gone as he leaps; the second after the landing, typed out by \"PHASE 2\" and gone before the clocks", () => {
    const C = PHASE_CHANGE;
    const L = RECLUSE_PHASE2.change.chantLines;
    // (The cutscene mockup's numbers: 45 ms a character, a second between sentences, readable 1.7 s plus 40 ms a character.)
    expect([L.typeMs, L.sentencePauseMs, L.readMs, L.perCharMs]).toEqual([45, 1000, 1700, 40]);
    // (The first line, 30 ms a character: its window is the music's, from the visor up to the leap.)
    expect(L.firstTypeMs).toBe(30);
    expect(RECLUSE_LINES.chantSay).toEqual([
      ["Computation without creativity is nothing.", "Now I have both."],
      ["Prepare yourself.", "This is the ultimate test of your skill."],
    ]);
    expect(C.chantLines.map((l) => l.line.text)).toEqual(["Computation without creativity is nothing. Now I have both.", "Prepare yourself. This is the ultimate test of your skill."]);
    const [a, b] = C.chantLines;
    // The first: once the visor is up, typed at 30 ms a character, typed out before the visor comes down, then held (through the
    // visor down and the crouch) till he leaps: readable whole 2.8 s, not the 1.2 s it had (Nov 14 review, M2), and gone as he leaps.
    expect(a!.at).toBeGreaterThan(C.flipUpAt);
    expect(a!.line.typeMs).toBe(30);
    expect(a!.at + a!.line.typedMs).toBeLessThan(C.flipDownAt);
    expect(a!.at + a!.line.holdMs).toBe(C.upAt);
    const readable = a!.line.holdMs - a!.line.typedMs - L.fadeMs;
    expect(readable).toBeGreaterThanOrEqual(2800);
    // The second: after he lands, typed out by "PHASE 2", gone before the clocks run.
    expect(b!.at).toBeGreaterThan(C.crackAt);
    expect(b!.at + b!.line.typedMs).toBeLessThanOrEqual(C.bannerAt + C.bannerMs);
    expect(b!.at + b!.line.holdMs).toBeLessThanOrEqual(C.total + C.countdownMs);
    // Each sentence typed at 45 ms a character, a second's pause between; each box readable at least 1.7 s once typed.
    const l = pacedLine(["Prepare yourself.", "This is the ultimate test of your skill."], L);
    expect(l.starts).toEqual([0, 17 * 45 + 1000]);
    expect(l.typedMs).toBe(17 * 45 + 1000 + 40 * 45);
    expect(l.holdMs - l.typedMs - L.fadeMs).toBe(1700 + 40 * l.text.length);
    expect(pacedTyped(l, 0)).toBe(1);
    expect(pacedTyped(l, 17 * 45 + 500)).toBe(17);
    expect(l.text.slice(0, pacedTyped(l, l.starts[1]!))).toBe("Prepare yourself. T");
    expect(pacedTyped(l, l.typedMs)).toBe(l.text.length);
    // (A phone's bar, two rows: a sentence at a time, each its own page; the first held through the pause.)
    expect(pacedPage(l, 17 * 45 + 900)).toEqual({ i: 0, text: "Prepare yourself.", at: 0, typed: 17 });
    expect(pacedPage(l, l.starts[1]!)).toEqual({ i: 1, text: "This is the ultimate test of your skill.", at: l.starts[1], typed: 1 });
    expect(pacedPage(l, l.holdMs).typed).toBe(40);
    // In his voice: each line up from its time, typed at its pace, whole until it's gone.
    const v = new Voice();
    v.sayPaced(a!.line, "c1", CRITICAL, a!.at);
    expect(v.line(a!.at)?.text).toBe(a!.line.text);
    expect(v.line(a!.at)?.paced).toBe(a!.line);
    expect(v.line(a!.at + a!.line.holdMs - 1)?.text).toBe(a!.line.text);
    v.sayPaced(b!.line, "c2", CRITICAL, b!.at);
    expect(v.line(b!.at)?.text).toBe(b!.line.text);
    expect(v.line(b!.at + b!.line.holdMs - 1)?.text).toBe(b!.line.text);
  });

  it("where he stands: his place empty while the board draws him, then phase 2's idle once he's home", () => {
    expect(phaseChangeRun(1000)).toEqual({ since: 1000, anims: [], loop: "idle2" });
  });

  it("arcs strike the board from his hands at his sides once he's landed: onto the cracks, smooth, two big ones as it cracks and as it parts", () => {
    const C = PHASE_CHANGE;
    expect(ARC_STRIKES.length).toBeGreaterThanOrEqual(12);
    for (const s of ARC_STRIKES) {
      expect(s.at).toBeGreaterThanOrEqual(C.crackAt);
      expect(s.at + ARC_LIFE).toBeLessThanOrEqual(C.arcEnd + ARC_LIFE);
      // (On a crack: down the middle or across it.)
      expect(s.to[0] === 50 || s.to[1] === 50, JSON.stringify(s)).toBe(true);
      for (const v of s.to) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    }
    expect(ARC_STRIKES.filter((s) => s.big).map((s) => s.at)).toEqual([C.crackAt, C.crackAt, C.partAt, C.partAt]);
    // (Never two seconds of nothing: one strikes at least every quarter second.)
    const at = ARC_STRIKES.map((s) => s.at);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeLessThanOrEqual(250);
    // (Their crackle's two snaps fall on the big ones: recluse-sounds.ts, `arc`.)
    expect([C.crackAt - C.arcAt, C.partAt - C.arcAt]).toEqual([200, 950]);
    // (From his hands: below his waist, either side of him, on the board.)
    for (const [x, y] of CHANGE_HANDS) expect(x).toBeGreaterThan(20), expect(x).toBeLessThan(80), expect(y).toBeGreaterThan(40), expect(y).toBeLessThan(70);
    // An arc runs from its hand to its point, the same for the same seed, another for another, and its path has no corners.
    const pts = arcPoints([40, 18], [50, 90], 7);
    expect(pts[0]).toEqual([40, 18]);
    expect(pts.at(-1)).toEqual([50, 90]);
    expect(pts).toHaveLength(17);
    expect(arcPoints([40, 18], [50, 90], 7)).toEqual(pts);
    expect(arcPoints([40, 18], [50, 90], 8)).not.toEqual(pts);
    for (const p of pts) expect(Math.abs(p[0] - (40 + ((p[1] - 18) / 72) * 10))).toBeLessThan(16);
    expect(smoothPath(pts)).toMatch(/^M40 18( Q[\d. -]+){15} L50 90$/);
  });

  it("his figure (Eric, Nov 14): his arms at his sides the whole time; his eyes white as the light takes him; in the suit and helmet from the reveal, the visor up only for his line, his eyes glowing then; one book on screen", () => {
    const ch = RECLUSE_CHANGE;
    const heads = (a: string) => ch.anims[a]!.frames.map((f) => f.layers.find((l) => l.part.startsWith("head:") || l.part.startsWith("helmet:"))!.part);
    const books = (a: string) => ch.anims[a]!.frames.map((f) => f.layers.filter((l) => l.part.startsWith("book:")).length);
    for (const a of Object.keys(ch.anims)) {
      // (Never a raised hand: no open palm, no fist up.)
      for (const f of ch.anims[a]!.frames) expect(f.layers.some((l) => l.part.endsWith("hand:palm")), a).toBe(false);
    }
    for (const a of ["burst", "rise", "beam"]) for (const h of heads(a)) expect(h, a).toMatch(/^head:possessed\./);
    // (Before the white-out, him as he was; from the reveal, the suit: helmet heads, no tie.)
    for (const a of ["together", "open", "glowing", "burst", "rise", "beam"]) for (const f of ch.anims[a]!.frames) expect(f.layers.some((l) => l.part.startsWith("suit:") || l.part.startsWith("helmet:")), a).toBe(false);
    for (const a of ["revealed", "crouch", "air", "land", "landed", "pickup", "leap2"]) {
      for (const h of heads(a)) expect(h, a).toMatch(/^helmet:down:/);
      for (const f of ch.anims[a]!.frames) expect(f.layers.some((l) => l.part.startsWith("tie:")), a).toBe(false);
    }
    expect(heads("flipUp")).toEqual([expect.stringMatching(/^helmet:mid:/), expect.stringMatching(/^helmet:up:/)]);
    for (const h of heads("faceOpen")) expect(h).toMatch(/^helmet:up:glow\./);
    for (const f of ch.anims.faceOpen!.frames) expect(f.layers.some((l) => l.part === "eyeGlow")).toBe(true);
    expect(heads("flipDown").at(-1)).toMatch(/^helmet:down:/);
    // One book: in his frames as it opens and while he kneels; drawn apart while he rises, hovers and jumps; his again from the pickup.
    for (const a of ["open", "glowing", "burst"]) expect(books(a), a).toEqual(books(a).map(() => 1));
    for (const a of ["rise", "beam", "revealed", "flipUp", "faceOpen", "flipDown", "crouch", "air", "land", "landed"]) expect(books(a), a).toEqual(books(a).map(() => 0));
    for (const f of RECLUSE_CHANGE_BOOK.anims.glow!.frames) expect(f.layers.filter((l) => l.part.startsWith("book:"))).toHaveLength(1);
    expect(books("pickup")).toEqual(books("pickup").map(() => 1));
    // (Where he stands in phase 2 too: the suit on his idle, the bust's as well.)
    for (const c of [RECLUSE, RECLUSE_BUST]) expect(suited(c.anims.idle2!.frames[0]!).layers.some((l) => l.part.startsWith("helmet:down:")), c.id).toBe(true);
  });
});

describe("his phase 2 lines", () => {
  it("has a line for each moment; the God King's only those about his help (none in the phase change or phase 2: he stays greyed in his place)", () => {
    for (const k of ["engine", "phase2", "boardWon", "boardLost", "beaten2", "chantSay"] as const) expect(RECLUSE_LINES[k].length, k).toBeGreaterThan(0);
    for (const p of [1, 2] as const) for (const k of ["early", "middle", "late"] as const) expect(RECLUSE_LINES.talk[p][k].length, `${p} ${k}`).toBeGreaterThan(0);
    expect(Object.keys(KING_VS_RECLUSE).sort()).toEqual(["blocked", "intro"]);
    expect(Object.keys(KING_LINES).filter((c) => c.startsWith("foe")).sort()).toEqual(["foeBlocked", "foeIntro"]);
    for (const line of RECLUSE_LINES.engine) expect(line).not.toMatch(/beautiful mind/i);
    expect(RECLUSE_LINES.engine).toEqual(expect.arrayContaining(["Fun, isn't it?", "Look how much fun we're having.", "Not so nice when the engine's on my side, is it?"]));
  });

  it("names his rivals but never their country or its people (Eric, Oct 14); his own words from the article word for word", () => {
    const all = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === "object" ? Object.values(o).flatMap(all) : []);
    for (const line of all(RECLUSE_LINES)) expect(line, line).not.toMatch(/soviet|russia/i);
    expect(all(RECLUSE_LINES.talk).some((l) => /Petrosian/.test(l) && /Keres/.test(l) && /Geller/.test(l))).toBe(true);
    // (Verified on the printed pages of his Sports Illustrated article, Aug 20, 1962: never altered.)
    expect(all(RECLUSE_LINES.talk)).toContain("They worked as a team.");
    // (Each in one phase's chatter only, so a fight never says one twice there.)
    const { 1: p1, 2: p2 } = RECLUSE_LINES.talk;
    expect(p1.middle).toEqual(expect.arrayContaining(["They consulted during the games.", "They would openly analyze my game while I was still playing it."]));
    expect(p1.late).toContain("It made me mad that they thought they could get away with it.");
    expect(p2.middle).toContain("They agreed ahead of time to draw the games they played against each other.");
    expect(p2.late).toEqual(expect.arrayContaining(["They worked as a team.", "I will never again play in one of these tournaments."]));
    const one = all(p1);
    for (const line of all(p2)) expect(one, line).not.toContain(line);
    // (Korchnoi only among the names, never with a word about a game he played.)
    for (const line of all(RECLUSE_LINES).filter((l) => /Korchnoi/.test(l))) expect(line.replace(/[.\s]/g, "")).toMatch(/^(Petrosian|Keres|Geller|Tal|Korchnoi)+$/);
  });
});

/** Pretend engines: his plays the first legal move (sorted), and counts what it's asked; the bots' the same. */
function engines() {
  const asked: { fen: string; elo: number; nodes?: number; moveMs?: number }[] = [];
  const first = (fen: string) => [...legalMoves(fen)].sort()[0]!;
  const boss = {
    playAtElo: (fen: string, elo: number, nodes?: number, moveMs?: number) => {
      asked.push({ fen, elo, nodes, moveMs });
      return Promise.resolve(first(fen));
    },
  };
  const bots = {
    playAtElo: (fen: string) => Promise.resolve(first(fen)),
    topMoves: (fen: string): Promise<MoveScore[]> => Promise.resolve(legalMoves(fen).includes("h5f7") ? [{ move: "h5f7", expected: 1 }] : [{ move: first(fen), expected: 0.5 }]),
  };
  return { boss, bots, asked };
}

describe("phase 2's four boards on this device", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (over: Partial<ConstructorParameters<typeof Phase2Game>[0]> = {}) => {
    const e = engines();
    const done = vi.fn();
    const results: string[] = [];
    const g = new Phase2Game({
      players: ["you", "b1", "b2", "b3"],
      numbers: phase2Numbers(5),
      human: "you",
      boss: e.boss,
      bots: e.bots,
      rng: () => 0.5,
      onChange: () => undefined,
      onResult: (b) => results.push(`${b.id}:${b.result!.winner}:${b.result!.how}`),
      onDone: done,
      ...over,
    });
    return { g, e, done, results };
  };

  it("the test switch: the bots mate at once, your Qxf7 mates too, and all four won beat him", async () => {
    const { g, done, results } = make({ win: true });
    g.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(g.outcome).toMatchObject({ won: 3, decided: false });
    g.move(0, "h5f7");
    await vi.advanceTimersByTimeAsync(10);
    expect(g.outcome).toMatchObject({ won: 4, beaten: true, decided: true });
    expect(done).toHaveBeenCalledTimes(1);
    expect(results.sort()).toEqual(["0:crowd:mate", "1:crowd:mate", "2:crowd:mate", "3:crowd:mate"]);
  });

  it("he answers on every board with Stockfish at his strength and budget only; your move is yours alone", async () => {
    const moved: number[] = [];
    const { g, e } = make({ onBossMove: (n) => moved.push(n) });
    g.start();
    // (Your move on a bot's board, or an illegal one, does nothing.)
    g.move(1, legalMoves(g.board(1)!.board.fen)[0]!);
    expect(g.board(1)!.board.history).toHaveLength(0);
    g.move(0, [...legalMoves(g.board(0)!.board.fen)].sort()[0]!);
    await vi.advanceTimersByTimeAsync(3000);
    expect(g.board(0)!.board.history.length).toBe(2);
    for (const b of g.state.boards) expect(b.board.history.length).toBeGreaterThanOrEqual(2);
    expect(e.asked.length).toBeGreaterThanOrEqual(4);
    for (const a of e.asked) expect(a).toMatchObject({ elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    // (Each of his moves counted, on all the boards together.)
    const his = g.state.boards.reduce((n, b) => n + Math.floor(b.board.history.length / 2), 0);
    expect(moved).toEqual(Array.from({ length: his }, (_, i) => i + 1));
    expect(g.bossMoves).toBe(his);
    g.stop();
  });

  it("your clock runs out: your board is lost on time; the others played on", async () => {
    const { g, results } = make();
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.bankSeconds * 1000 + 400);
    expect(results).toContain("0:boss:time");
    expect(g.board(0)!.result).toEqual({ winner: "boss", how: "time" });
    // (The bots moved all along, each on its own clock: their boards went on after yours stopped.)
    expect(g.state.boards.slice(1).every((b) => b.board.history.length > 2)).toBe(true);
    g.stop();
  });

  it("his ultimate (the admins' trigger): from then on, out of your few seconds, a random legal move is played for you (no loss)", async () => {
    const ult = vi.fn();
    const { g } = make({ onUlt: ult });
    g.start();
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.ultAt).not.toBeNull();
    // (Its banner first: the few seconds start as it goes, Oct 24.)
    await vi.advanceTimersByTimeAsync(bossBannerMs() + RECLUSE_PHASE2.ultMoveSeconds * 1000 + 300);
    expect(g.board(0)!.result).toBeNull();
    expect(g.board(0)!.board.history.length).toBeGreaterThanOrEqual(1);
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    g.stop();
  });

  it("slow moves count for the team, yours and the bots' (now and then a bot thinks past slowMoveSeconds), each on its board; the 10th brings his ultimate", async () => {
    const slow: [number, boolean][] = [];
    const ult = vi.fn();
    // (rng 0.05: every bot's move is a slow one.)
    const { g } = make({ onSlow: (id, u) => slow.push([id, u]), onUlt: ult, rng: () => 0.05 });
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.botSlowMs[1] + 500);
    expect(g.state.slow).toBeGreaterThanOrEqual(3);
    expect(ult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4 * RECLUSE_PHASE2.botSlowMs[1]);
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt);
    // One call a slow move, naming its board (the bots' here, never yours: you haven't moved); the last one brought it.
    expect(slow).toHaveLength(RECLUSE_PHASE2.slowMovesForUlt);
    for (const [id] of slow) expect([1, 2, 3]).toContain(id);
    expect(slow.map(([, u]) => u)).toEqual([...Array(RECLUSE_PHASE2.slowMovesForUlt - 1).fill(false), true]);
    g.stop();
  });

  it("resigning your board: lost; the battle ends only once every board is decided", async () => {
    const { g, done } = make();
    g.start();
    g.resign(0);
    expect(g.board(0)!.result?.how).toBe("resign");
    expect(done).not.toHaveBeenCalled();
    g.stop();
  });
});

describe("phase 2 without the God King's help (Eric, Nov 14: greyed in his place from the phase change on)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the boards set, a countdown before the clocks (Eric, Oct 17): nothing runs, nobody can move or resign, then every clock starts", () => {
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Record<string, (...a: unknown[]) => unknown> & { phase2: unknown; phase: { kind: string; at: number }; exit: unknown; simul: unknown };
    let started = 0;
    let moved = 0;
    m.phase2 = { start: () => started++, stop() {}, move: () => moved++, outcome: { beaten: false, won: 0, of: 4, decided: false }, state: { boards: [], slow: 0, ultAt: null } };
    const t0 = Date.now();
    m.startSimul!();
    expect(m.phase).toEqual({ kind: "simul", at: t0 + PHASE_CHANGE.countdownMs });
    expect(m.exit).toBeNull();
    m.simulMove!(0, "e2e4");
    vi.advanceTimersByTime(PHASE_CHANGE.countdownMs - 1);
    expect([started, moved]).toEqual([0, 0]);
    vi.advanceTimersByTime(1);
    expect(started).toBe(1);
    expect(m.phase).toEqual({ kind: "simul", at: t0 + PHASE_CHANGE.countdownMs });
    m.simulMove!(0, "e2e4");
    expect(moved).toBe(1);
    (m as unknown as { stop(): void }).stop?.();
  });

  it("the scoreboard (Eric's playtest, Nov 14): phase 1's end placed you, but from his fall on you're in, your board's state as it ends; the result, as placed", () => {
    type Solo = { runner: { state: Parameters<typeof finishBoss>[0] }; createRunner(): void; phase2: unknown; phase2Seats: string[]; phase: object; standings(): { out: boolean; board?: string; placement: number | null }[]; stop?(): void };
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Solo;
    // (Boss alone's runner: you alone. His battle over, phase 1's end places you, as core finishBoss does for everyone still in.)
    m.createRunner();
    m.runner.state = finishBoss(m.runner.state, () => 0.5, "crowd");
    const rows = () => m.standings().map((s) => [s.out, s.board ?? null, s.placement]);
    expect(rows()).toEqual([[true, null, 1]]);
    m.phase = { kind: "boss", boss: {}, until: 0, fall: true, toPhase2: true };
    m.phase2Seats = [HUMAN];
    expect(rows()).toEqual([[false, "playing", 1]]);
    const board = (result: object | null) => ({ boards: [{ id: 0, player: HUMAN, result }], slow: 0, ultAt: null });
    m.phase2 = { stop() {}, state: board(null) };
    m.phase = { kind: "phaseChange", at: 0, splitAt: 0 };
    expect(rows()).toEqual([[false, "playing", 1]]);
    m.phase2 = { stop() {}, state: board({ winner: "boss", how: "time" }) };
    m.phase = { kind: "simul", at: 0 };
    expect(rows()).toEqual([[false, "lost", 1]]);
    m.phase = { kind: "results", placement: 1, winner: "Ann", youWon: false, bossResult: "boss", simul: { won: 0, of: 4 } };
    expect(rows()).toEqual([[true, null, 1]]);
    m.stop?.();
  });

  it("the countdown counts from the boards' first frame on screen, so the 5 is up a whole second however long that frame takes", () => {
    // (Frames by hand: the boards' first draw takes 120 ms, then the next frame. Counted from before it, the 5 was short.)
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => frames.push(f));
    type Solo = Record<string, (...a: unknown[]) => unknown> & { phase2: unknown; phase: { kind: string; at: number } };
    const pretend = (count: () => void) => ({ start: count, stop() {}, move() {}, outcome: { beaten: false, won: 0, of: 4, decided: false }, state: { boards: [], slow: 0, ultAt: null } });
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Solo;
    let started = 0;
    m.phase2 = pretend(() => started++);
    const t0 = Date.now();
    m.startSimul!();
    expect(m.phase).toEqual({ kind: "simul", at: t0 + PHASE_CHANGE.countdownMs });
    vi.advanceTimersByTime(120);
    frames.shift()!(0);
    vi.advanceTimersByTime(16);
    frames.shift()!(0);
    expect(m.phase).toEqual({ kind: "simul", at: t0 + 136 + PHASE_CHANGE.countdownMs });
    vi.advanceTimersByTime(PHASE_CHANGE.countdownMs - 1);
    expect(started).toBe(0);
    vi.advanceTimersByTime(1);
    expect(started).toBe(1);
    // (No frames at all, a hidden tab: it starts a moment later all the same, never waits for the tab.)
    const n = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Solo;
    let nStarted = 0;
    n.phase2 = pretend(() => nStarted++);
    const t1 = Date.now();
    n.startSimul!();
    vi.advanceTimersByTime(250 + PHASE_CHANGE.countdownMs);
    expect(nStarted).toBe(1);
    expect(n.phase).toEqual({ kind: "simul", at: t1 + 250 + PHASE_CHANGE.countdownMs });
    for (const x of [m, n]) (x as unknown as { stop(): void }).stop?.();
  });

  it("says nothing as phase 2 begins, as a board is won or lost, or as all four are won; the boss still has his words", () => {
    // (White-box: the moments of SoloMatch's phase 2 that had the God King speak, driven with a pretend Phase2Game.)
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Record<string, (...a: unknown[]) => unknown> & { phase2: unknown };
    const outcome = { beaten: false, won: 0, of: 4, decided: false };
    m.phase2 = { start() {}, stop() {}, outcome, state: { boards: [], slow: 0, ultAt: null } };
    resetKingSpeech();
    bossVoice.reset();
    m.startSimul!();
    // (The countdown first: then the clocks, and his line.)
    vi.advanceTimersByTime(PHASE_CHANGE.countdownMs);
    m.phase2Result!("crowd");
    m.phase2Result!("boss");
    Object.assign(outcome, { beaten: true, won: 4, decided: true });
    m.phase2Done!();
    expect(kingLine()).toBeNull();
    expect(bossVoice.line()).not.toBeNull();
    (m as unknown as { stop(): void }).stop?.();
  });
});

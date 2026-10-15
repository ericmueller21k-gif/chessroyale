import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, menuBosses, type Settings } from "@chessroyale/core";
import { RECLUSE_FX, legalMoves, type UciEngine } from "@chessroyale/chess";
import { SoloMatch } from "../src/solo.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { RECLUSE, RECLUSE_BUST } from "../src/characters/recluse.ts";
import { KING_VS_RECLUSE, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { RECLUSE_SOUNDS, recluseSound } from "../src/characters/recluse-sounds.ts";
import { animLength } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { bossBeat, type Beat } from "../src/characters/boss-beats.ts";
import { showing } from "../src/components/BossCharacter.tsx";
import { dockLine, momentPriority, powerLine } from "../src/components/BossPowers.tsx";
import { BULLET, BULLET_ANIMS, BULLET_PLUS, bulletControl, bulletIncrementOn, bulletOn, kingBlocked, mockKingHelp } from "../src/components/Recluse.tsx";
import { CRITICAL } from "../src/speech.tsx";
import { kingLine, resetKingSpeech, turnCues } from "../src/godKing.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import { bossVoice } from "../src/speech.tsx";
import type { BossView } from "../src/game.ts";

// The Hidden Boss (code id `recluse`), phase 1 on screen: his kit (the bust in a phone's bar, his whole figure on a
// computer), his animations for each moment, his ultimate's run in place, the God King's help mocked, his fall, his
// lines (the real quotes word for word), his sounds. His rules: packages/chess/test/recluse.test.ts.
const kit = BOSS_KITS["Hidden Boss"]!;
const view = (over: Partial<BossView> = {}) =>
  ({ id: "recluse", name: "Hidden Boss", icon: "📕", startMove: 6, crowdMoves: 3, crowdSide: "w", board: { fen: "", history: [] }, powers: { ultimate: "bullet", ultAt: null }, ...over }) as unknown as BossView;

describe("the Hidden Boss's kit", () => {
  it("is his roster entry's (hidden from players: never in a player's menu), his whole figure, the bust in a phone's bar", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "recluse")!;
    expect(def.kit).toBe("Hidden Boss");
    expect(isPlayable(def)).toBe(false);
    expect(menuBosses({ admin: false, raid: false }).some((b) => b.id === "recluse")).toBe(false);
    expect(menuBosses({ admin: true, raid: false }).some((b) => b.id === "recluse")).toBe(true);
    expect(kit.ch).toBe(RECLUSE);
    expect(kit.bar).toBe(RECLUSE_BUST);
    expect(kit.wide).toBe(true);
    expect(powersLine(def)).toBe(`${POWER_WORDS.nohelp} · ${POWER_WORDS.bullet}`);
  });

  it("has an animation for every moment (the stare his entrance, the collapse beaten, the laugh winning) and a sound for every cue", () => {
    const beats: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike"];
    for (const b of beats) expect(RECLUSE.anims[kit.anims[b] ?? b], b).toBeTruthy();
    expect(kit.anims).toMatchObject({ entrance: "stare", rattled: "consult", defeat: "collapse", victory: "laugh" });
    for (const ch of [RECLUSE, RECLUSE_BUST]) for (const a of Object.values(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toMatch(/^recluse/);
    // (Thinking, as your move lands: no sound, only the board's knock.)
    expect(RECLUSE.anims[kit.anims.thinking!]!.frames.some((f) => f.cue)).toBe(false);
  });

  it("beaten: the collapse once, then he stays slumped, mumbling (collapseLoop), never back on his feet", () => {
    const beat = bossBeat(kit, { stage: "over", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", history: [], crowdSide: "w", lastMove: null, result: "crowd" });
    expect(beat).toMatchObject({ anim: "defeat", loop: "defeat" });
    const collapse = animLength(RECLUSE.anims.collapse!);
    expect(showing(kit, beat, 1000 + collapse - 10, 1000).anim).toBe("collapse");
    for (const t of [collapse + 10, collapse + 5000, collapse + 60_000]) expect(showing(kit, beat, 1000 + t, 1000).anim).toBe("collapseLoop");
    expect(kit.fall).toEqual(RECLUSE_LINES.fall);
    expect(kit.fall!.length).toBeGreaterThanOrEqual(3);
    // (Another boss without a loop of its own still rests in its idle, as before.)
    expect(showing(BOSS_KITS["Wrangler"]!, beat, 100_000, 0).anim).toBe("idle");
  });
});

describe("his ultimate, the bullet clock, on screen", () => {
  it("plays where he stands: the book consulted, opened like a spell book, the spell held, slammed shut, within its moment", () => {
    expect(BULLET_ANIMS).toEqual(["consult", "spellbook", "spellLoop", "spellClose"]);
    for (const n of BULLET_ANIMS) expect(RECLUSE_BUST.anims[n], n).toBeTruthy();
    expect(BULLET.runMs).toBeLessThanOrEqual(RECLUSE_FX.bullet);
    expect(BULLET.bannerAt + BULLET.bannerMs).toBeLessThanOrEqual(RECLUSE_FX.bullet);
    // "BULLET!" as the book falls open (after the consult).
    expect(BULLET.bannerAt).toBeGreaterThan(animLength(RECLUSE.anims.consult!));
  });

  it("says one line as it comes (placeholders for Eric's own, no warning), the same for everyone", () => {
    const line = powerLine(kit, { kind: "bullet", key: "recluse:bullet:7" });
    expect(RECLUSE_LINES.bullet).toContain(line);
    expect(powerLine(kit, { kind: "bullet", key: "recluse:bullet:7" })).toBe(line);
  });

  it("is on from the turn it came to the end of the battle", () => {
    expect(bulletOn(view())).toBe(false);
    expect(bulletOn(view({ powers: { ultimate: "bullet", ultAt: 7 } } as Partial<BossView>))).toBe(true);
    expect(bulletOn(view({ powers: { ultimate: "bullet", ultAt: 7 }, result: "crowd" } as Partial<BossView>))).toBe(false);
    expect(bulletOn(view({ id: "pig", powers: { ultimate: "showdown", ultAt: 7 } } as Partial<BossView>))).toBe(false);
  });
});

describe("then he adds time per move (Eric, Oct 14)", () => {
  it("his moment: one grudging line as it begins (it cuts in), consulting the book, then the increment across the board until the clock starts", () => {
    const line = powerLine(kit, { kind: "bulletPlus", key: "recluse:bulletPlus:10" });
    expect(RECLUSE_LINES.bulletPlus).toContain(line);
    expect(powerLine(kit, { kind: "bulletPlus", key: "recluse:bulletPlus:10" }), "the same for everyone").toBe(line);
    expect(RECLUSE_LINES.bulletPlus.length).toBeGreaterThanOrEqual(2);
    // (The number is the board's text, from the setting, never in his line.)
    for (const l of RECLUSE_LINES.bulletPlus) expect(l).not.toMatch(/\d/);
    expect(momentPriority({ kind: "bulletPlus" })).toBe(CRITICAL);
    expect(BULLET_PLUS.text()).toBe("+2 s a move from now on");
    // (The board says it: the dock keeps the turn's own line, never the increment a second time.)
    expect(dockLine({ kind: "bulletPlus" })).toBeNull();
    // Within its moment: the consult, and the text up for a couple of seconds before the clock starts.
    expect(BULLET_PLUS.anims).toEqual(["consult"]);
    expect(animLength(RECLUSE_BUST.anims.consult!)).toBeLessThanOrEqual(RECLUSE_FX.bulletPlus);
    expect(animLength(RECLUSE.anims.consult!)).toBeLessThanOrEqual(RECLUSE_FX.bulletPlus);
    expect(RECLUSE_FX.bulletPlus - BULLET_PLUS.textAt).toBeGreaterThanOrEqual(2000);
  });

  it("the dock's time control once it applies (\"Bullet 1+2\"), from bulletPlainMoves turns after the bullet clock came", () => {
    expect(BOSS_POWERS.bulletPlainMoves).toBe(3);
    const at = (turn: number, extra: Partial<BossView> = {}) => bulletIncrementOn(view({ powers: { ultimate: "bullet", ultAt: 7, turn }, ...extra } as Partial<BossView>));
    expect([7, 8, 9, 10, 30].map((t) => at(t))).toEqual([0, 0, 0, 2, 2]);
    expect(bulletIncrementOn(view())).toBe(0);
    expect(at(12, { result: "crowd" })).toBe(0);
    expect(bulletControl(2)).toBe("1+2");
  });
});

describe("the God King's help, blocked and mocked", () => {
  it("tried (his move or his strike): the boss mocks it and the God King says it won't take hold, each in their own voice", () => {
    resetKingSpeech();
    bossVoice.reset();
    expect(kingBlocked(view())).toBe(true);
    expect(kingBlocked({ id: "pig" })).toBe(false);
    mockKingHelp(view());
    expect(RECLUSE_LINES.mock).toContain(bossVoice.line()?.text);
    expect(KING_VS_RECLUSE.blocked).toContain(kingLine()?.text);
    // Tried again: another of his lines, in turn.
    const first = bossVoice.line()!.text;
    bossVoice.reset();
    mockKingHelp(view());
    expect(bossVoice.line()!.text).not.toBe(first);
  });

  it("his own opening line in this fight (Eric's first), and nothing about calling him", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const cues = turnCues({ fen, side: "w", charges: 3, ply: 20, ours: 0.1, noHelp: true }).map((c) => c.cue);
    expect(cues).toContain("foeIntro");
    for (const c of ["intro", "nudge", "losing", "spent"] as const) expect(cues).not.toContain(c);
    expect(KING_VS_RECLUSE.intro[0]).toBe("I sense a tremendous power within this foe.");
    // (Every other boss: as before.)
    expect(turnCues({ fen, side: "w", charges: 3, ply: 20, ours: 0.1 }).map((c) => c.cue)).toEqual(expect.arrayContaining(["intro", "nudge", "losing"]));
  });
});

describe("his lines: real quotes word for word, the rest placeholders", () => {
  it("keeps every verified quote exactly as first published (Eric, Oct 14: never altered), each in its slot", () => {
    expect(RECLUSE_LINES.introE4).toBe("Best by test.");
    expect(RECLUSE_LINES.mock).toEqual(expect.arrayContaining(["I don't believe in psychology. I believe in good moves.", "A genuine beginner's move"]));
    expect(RECLUSE_LINES.victory).toContain("He played book lines, but didn't know them very well.");
    expect(RECLUSE_LINES.fall).toContain("Morphy, I think everyone agrees, was probably the greatest genius of them all.");
    // (Eric, Oct 14: the Weaver Adams quote, a board he won in phase 2, "doesn't fit the rest": gone.)
    expect(JSON.stringify(RECLUSE_LINES)).not.toMatch(/Weaver|merely loses differently/);
    expect(RECLUSE_LINES.boardWon.length).toBeGreaterThan(0);
  });

  it("says 'Best by test.' as his entrance only when he's White and the game opened 1.e4", () => {
    const e4 = { board: { fen: "", history: ["e2e4", "c7c5"] } } as Partial<BossView>;
    expect(kit.lineOf!("entrance", view({ ...e4, crowdSide: "b" }))).toBe("Best by test.");
    expect(kit.lineOf!("entrance", view({ ...e4, crowdSide: "w" }))).toBeUndefined();
    expect(kit.lineOf!("entrance", view({ board: { fen: "", history: ["d2d4"] }, crowdSide: "b" } as Partial<BossView>))).toBeUndefined();
    expect(kit.lineOf!("victory", view({ ...e4, crowdSide: "b" }))).toBeUndefined();
  });
});

describe("his sounds", () => {
  it("no louder than a piece's move, and the same every time", () => {
    for (const name of RECLUSE_SOUNDS) {
      const s = recluseSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(recluseSound(name, 44100));
    }
  });
});

/** The God King's help tried in Boss alone against him (SoloMatch.callKing, what the dock calls after his mock). */
describe("the God King's help tried in Boss alone: blocked, and the charge spent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("each try (his strike, his move) takes a charge from the dock's count and your move goes on; none left, a try does nothing", async () => {
    // (A stand-in engine: its searches answer with the legal moves; the boss never gets to move here.)
    const engine = {
      topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
      scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
      topMovesAt: async () => [{ move: "0000", expected: 0.5 }],
      playAtElo: async (fen: string) => legalMoves(fen)[0]!,
    } as unknown as UciEngine;
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "recluse", bossHidden: true } as Settings);
    m.start();
    // (Before your move: nothing.)
    m.callKing(true);
    expect(m.boss!.kingCharges).toBe(3);
    // (Maia's loading step first: this stand-in worker never answers, so it ends at BOSS_BRAIN.loadGateMs; then the intro.)
    for (let i = 0; i < 120 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    expect(m.phase.kind).toBe("play");
    expect(m.boss!.id).toBe("recluse");
    m.callKing(true);
    expect(m.boss!.kingCharges).toBe(2);
    m.callKing();
    expect(m.boss!.kingCharges).toBe(1);
    // (He didn't play your move: it's still yours to make, your clock running as it was.)
    expect(m.phase.kind).toBe("play");
    expect(m.kingCalled).toBe(false);
    expect(m.boss!).toMatchObject({ kingMoves: [], kingStrikes: [], staggerNext: false });
    m.callKing();
    m.callKing(true);
    expect(m.boss!.kingCharges).toBe(0);
    expect(m.phase.kind).toBe("play");
    m.dispose();
  });
});

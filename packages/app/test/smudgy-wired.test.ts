import { afterEach, describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, isPlayable, menuBosses, playableBosses, type PowerEvent } from "@chessroyale/core";
import { KING_ATTACKERS, POWER_FX, SMUDGY_BEATS, START_FEN, pieceAt } from "@chessroyale/chess";
import { momentsOf, noMoveLine, powerLine } from "../src/components/BossPowers.tsx";
import { REPAINT_LINE, SMUDGY_UI, TAKEN_LINE, UNMASK_LINE, pawnSquares, rookTakenMoment, smudgyFen, splashItems, splashRow } from "../src/components/Smudgy.tsx";
import { SMUDGY, SMUDGY_ATTACK, SMUDGY_CHANCE, SMUDGY_LINES } from "../src/characters/smudgy.ts";
import { SMUDGY_SOUNDS, smudgySound } from "../src/characters/smudgy-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { CHARACTERS } from "../src/characters/index.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { bossKit } from "../src/characters/kits.ts";
import { BOSS_BLOCKS } from "../src/faq/content.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import { seenFen, trackCamo, type CamoBoss } from "../src/camo.ts";
import { readPieces } from "../src/board/logic.ts";
import { moveKnock } from "../src/move-sound.ts";
import type { BossView } from "../src/game.ts";
import type { Moment } from "../src/components/PowerParts.tsx";

/**
 * Smudgy in the game (Oct 19: live, his art wired in): his kit, lines, sounds, his moments timed by his animations' cues
 * (SMUDGY_BEATS), the board under them and the select screen (docs/decisions/2026-10-19-smudgy-wired.md). The masked
 * board's own tests: camo.test.ts; the art's: smudgy.test.ts.
 */
afterEach(() => trackCamo(null));

const A = SMUDGY.anims;
const B = SMUDGY_BEATS;
/** The kit's name for him, and a boss view for the moments (the parts the moments read). */
const NAME = "Smudgy";
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): BossView =>
  ({ id: "smudgy", name: NAME, crowdSide: "w", crowdMoves: 4, startMove: 1, lastMove: null, board: { fen: START_FEN, history: [] }, powers: { events, turn: 5, ...powers }, ...extra }) as unknown as BossView;

describe("Smudgy is live", () => {
  it("is playable: his kit (every moment, his powers' moments, lines, a portrait), his power words, and the character tests cover him", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "smudgy")!;
    expect(def.kit).toBe(NAME);
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("smudgy");
    expect(menuBosses({ admin: false, raid: true }).map((b) => b.id)).toContain("smudgy");
    const kit = bossKit(NAME)!;
    expect(kit.ch).toBe(SMUDGY);
    expect(CHARACTERS).toContain(SMUDGY);
    // (`strike` the beat is his periodic strike on a piece: his capture cheer; his reveal is `powerHit`'s animation.)
    expect(kit.anims).toMatchObject({ strike: "capture", power: "camouflage", powerHit: "strike", ultimateWarn: "check", ultimate: "repaint", ultimateHit: "hurt" });
    for (const a of Object.values(kit.anims)) expect(SMUDGY.anims[a!], a).toBeTruthy();
    // (The phone bar's wider box: in the usual one his beret and brush reach his name.)
    expect(kit.wide).toBe(true);
    expect(powersLine(def)).toBe(`${POWER_WORDS.camouflage} · ${POWER_WORDS.repaint}`);
    expect(POWER_MOMENTS[NAME]!.power.anim).toBe("camouflage");
    expect(POWER_MOMENTS[NAME]!.powerHit!.anim).toBe("strike");
    expect(KING_ATTACKERS).toContain("smudgy");
    expect(kit.kingAttack).toMatchObject({ ch: SMUDGY_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true });
  });

  it("says every line of the director's draft as written, each at most 48 characters (the three over 42 named here: the entrance lines 'Every chameleon blends in. I'd rather stand out.' (48) and 'Hold still. I'm painting you into a corner.' (43), and the king attack's 'Hold still, your majesty. You need a touch-up.' (46))", () => {
    const all = Object.values(SMUDGY_LINES).flat() as string[];
    // (42 lines in the draft; the three select lines are three of them.)
    expect(all).toHaveLength(42);
    const counts = Object.fromEntries(Object.entries(SMUDGY_LINES).map(([k, v]) => [k, v!.length]));
    expect(counts).toEqual({ entrance: 3, move: 4, capture: 3, hurt: 3, strike: 2, power: 3, camoStrike: 2, rookTaken: 2, thinking: 2, check: 2, smug: 2, rattled: 2, victory: 2, defeat: 2, ultimateWarn: 2, ultimate: 3, kingAttack: 3 });
    for (const l of all) {
      expect(l.length, l).toBeLessThanOrEqual(48);
      // (The "…" is the ellipsis character, as the other bosses' lines.)
      expect(l, l).not.toMatch(/\.\.\./);
    }
    expect(all.filter((l) => l.length > 42)).toEqual(["Every chameleon blends in. I'd rather stand out.", "Hold still. I'm painting you into a corner.", "Hold still, your majesty. You need a touch-up."]);
    expect(SMUDGY_LINES.camoStrike).toEqual(["Surprise! A rook all along!", "Ta-da! Nobody ever notices me. Until now."]);
    expect(SMUDGY_LINES.rookTaken).toEqual(["Hey! How did you know?!", "My masterpiece!"]);
    expect(SMUDGY_LINES.power).toContain("Now you see it…");
    expect(SMUDGY_LINES.ultimate).toContain("Let's switch things up.");
    expect(SMUDGY_LINES.strike).toEqual(["Brush stroke!", "Splat!"]);
    // The chances: Chub & Chirp's, plus his own moments' always.
    expect(SMUDGY_CHANCE).toMatchObject({ move: 0.12, capture: 0.6, check: 0.75, hurt: 0.6, thinking: 0.08, smug: 0.8, rattled: 0.8, defeat: 1, victory: 1, strike: 0.8, kingAttack: 1, entrance: 1, camoStrike: 1, rookTaken: 1, power: 1, ultimate: 1 });
  });

  it("has a sound of his own for every cue but none of a piece's, each quieter than a move and the same every time", () => {
    const kit = bossKit(NAME)!;
    for (const ch of [SMUDGY, SMUDGY_ATTACK]) for (const [name, a] of Object.entries(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toMatch(/^smudgy/);
    // (The paint on the board: the splash, the drip and the stroke each have one of his.)
    expect(EFFECTS.paintSplash.sounds).toEqual({ splat: "smudgySplash" });
    expect(EFFECTS.paintDrip.sounds).toEqual({ drip: "smudgyDrip" });
    expect(EFFECTS.brushStroke.sounds).toEqual({ swoosh: "smudgySwish" });
    expect(kit.sounds).toMatchObject({ splash: "smudgySwish", dab: "smudgyDab", drip: "smudgyDrip", thump: "smudgyThump", oof: "smudgyOof", giggle: "smudgyGiggle", swish: "smudgySwish" });
    for (const name of SMUDGY_SOUNDS) {
      const s = smudgySound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(smudgySound(name, 44100));
    }
    expect([...SMUDGY_SOUNDS].sort()).toEqual(["dab", "drip", "giggle", "oof", "splash", "swish", "thump"]);
  });

  it("on the select screen: his splash, the draft's three select lines (all of them his own lines), and full size on the stage", () => {
    expect(SELECT_SOUND.smudgy).toBe("smudgySplash");
    expect(SELECT_LINES.smudgy).toEqual(["Every chameleon blends in. I'd rather stand out.", "Smudgy, artist. Don't touch the wet parts.", "A masterpiece, if I say so myself."]);
    const own = new Set(Object.values(bossKit(NAME)!.lines).flat());
    for (const l of SELECT_LINES.smudgy!) expect(own.has(l), l).toBe(true);
  });

  it("has his FAQ block, from the settings, and says what the board shows at the end", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "smudgy")!;
    const text = BOSS_BLOCKS.smudgy!(BOSS_POWERS, def);
    expect(text).toContain("**Camouflage** (passive, once a battle)");
    expect(text).toContain("**Repaint** (ultimate");
    expect(text).toContain("once it's over, the board shows the real position");
  });
});

describe("his moments, timed by his animations' cues", () => {
  it("the moments' lengths are the beats' (the server waits for them)", () => {
    for (const k of ["camouflage", "unmask", "rookTaken", "repaint"] as const) expect(POWER_FX[k]).toBe(B[k].total);
  });

  it("Camouflage: his `splash` cue is the paint leaving his brush at the banner's end; the swap comes once the last square is covered, the paint fades after a beat", () => {
    const c = B.camouflage;
    const since = c.splashAt - cueAt(A.camouflage!, "splash")!;
    expect(since).toBeGreaterThanOrEqual(0);
    expect(since + animLength(A.camouflage!)).toBeLessThanOrEqual(c.total);
    // (The banner is the usual 1.5 s.)
    expect(c.splashAt).toBe(1500);
    // Nine squares at most (eight pawns and the rook drawn as one): the last one's splash has landed (and held its look) at the swap.
    const last = c.splashAt + c.flyMs + 8 * c.stagger + animLength(EFFECTS.paintSplash.ch.anims.landA!);
    expect(c.swapAt).toBeGreaterThanOrEqual(last);
    expect(c.swapAt + c.holdMs + 8 * c.stagger + animLength(EFFECTS.paintSplash.ch.anims.fadeA!)).toBeLessThanOrEqual(c.total);
    expect(animLength(EFFECTS.paintSplash.ch.anims.landA!)).toBeLessThanOrEqual(c.landMs + 20);
    expect(animLength(EFFECTS.paintSplash.ch.anims.fadeA!)).toBeLessThanOrEqual(c.fadeMs + 20);
  });

  it("the reveal: his `drip` cue is the paint dripping off the piece; his strike's animation and the drip are done inside the moment", () => {
    const u = B.unmask;
    const since = u.dripAt - cueAt(A.strike!, "drip")!;
    expect(since).toBeGreaterThanOrEqual(0);
    expect(since + animLength(A.strike!)).toBeLessThanOrEqual(u.total);
    expect(animLength(EFFECTS.paintDrip.ch.anims.drip!)).toBe(u.dripMs);
    expect(u.dripAt + u.dripMs).toBeLessThanOrEqual(u.total);
  });

  it("the rook taken: its drip is inside the moment, which fits the shortest thinking (1200 ms)", () => {
    const t = B.rookTaken;
    expect(t.dripAt + t.dripMs).toBeLessThanOrEqual(t.total);
    expect(t.total).toBeLessThanOrEqual(1200);
  });

  it("Repaint: his `stroke1` and `stroke2` cues are the two strokes, in his pawn's square (cream) then the piece's (charcoal), his whole animation inside the moment", () => {
    const r = B.repaint;
    expect(r.stroke2At - r.stroke1At).toBe(cueAt(A.repaint!, "stroke2")! - cueAt(A.repaint!, "stroke1")!);
    const since = r.stroke1At - cueAt(A.repaint!, "stroke1")!;
    expect(since).toBeGreaterThanOrEqual(0);
    expect(since + animLength(A.repaint!)).toBeLessThanOrEqual(r.total);
    expect(r.stroke2At + animLength(EFFECTS.brushStroke.ch.anims.strokeN!)).toBeLessThanOrEqual(r.total);
    expect(POWER_MOMENTS[NAME]!.ultimate).toMatchObject({ anim: "repaint", hit: "stroke1" });
  });

  it("the screen plays them: the moments of a turn in order, each with his line (the reveal's his `camoStrike`, the rook taken's `rookTaken`) and its dock words", () => {
    const kit = bossKit(NAME)!;
    const events: PowerEvent[] = [
      { kind: "warn", turn: 5 },
      { kind: "camouflage", turn: 5, square: "a6" },
    ];
    const moments = momentsOf(view(events), 20_000);
    expect(moments.map((m) => m.kind)).toEqual(["camouflage", "warn"]);
    expect(moments[0]!.ms).toBe(B.camouflage.total);
    for (const m of moments) expect(m.at).toBeGreaterThanOrEqual(0);
    const m = (kind: Moment["kind"]): Moment => ({ kind, key: `smudgy:${kind}:5`, at: 0, ms: 1 });
    expect(SMUDGY_LINES.power).toContain(powerLine(kit, m("camouflage"))!);
    expect(SMUDGY_LINES.camoStrike).toContain(powerLine(kit, m("unmask"))!);
    expect(SMUDGY_LINES.rookTaken).toContain(powerLine(kit, m("rookTaken"))!);
    expect(SMUDGY_LINES.ultimate).toContain(powerLine(kit, m("repaint"))!);
    expect(SMUDGY_LINES.ultimateWarn).toContain(powerLine(kit, m("warn"))!);
    expect(SMUDGY_UI.moments.unmask.dock!({ kind: "unmask" })).toBe(UNMASK_LINE);
    expect(SMUDGY_UI.moments.rookTaken.dock!({ kind: "rookTaken" })).toBe(TAKEN_LINE);
    expect(TAKEN_LINE).toBe("That was his rook!");
    expect(SMUDGY_UI.ultimate).toEqual({ name: "Repaint", when: "After your move" });
  });

  it("a Repaint is his whole turn: the dock says so where there's no move to show", () => {
    const boss = view([{ kind: "repaint", turn: 5, squares: ["e5", "c4"] }], { repaint: { at: 4, pawn: "e5", piece: "c4", type: "b", gain: 2 } });
    expect(noMoveLine(boss)).toBe(REPAINT_LINE);
    expect(REPAINT_LINE).toBe("Smudgy spent his turn repainting.");
    expect(noMoveLine({ ...boss, lastMove: { move: "e7e6", san: "e6" } } as BossView)).toBeNull();
  });

  it("the rook your move took plays while he thinks, once, from when this device first saw it", () => {
    const boss = view([{ kind: "rookTaken", turn: 5, square: "d6" }], { camo: { reveal: { at: 4, square: "d6", how: "taken" }, square: null } });
    const a = rookTakenMoment(boss, 1000);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "rookTaken", at: 1000, ms: B.rookTaken.total, square: "d6" });
    // (Drawn again later: it carries on, it doesn't start over.)
    expect(rookTakenMoment(boss, 2500)[0]!.at).toBe(1000);
    // None for another turn's, or another boss.
    expect(rookTakenMoment(view([{ kind: "rookTaken", turn: 4, square: "d6" }]), 0)).toEqual([]);
    expect(rookTakenMoment({ ...boss, id: "hopper" } as BossView, 0)).toEqual([]);
  });
});

describe("the board under his moments", () => {
  const his = "b" as const;
  it("shows his rook where he lifted it until the splash has covered his pawns, then the position as it is (drawn with the rook a pawn)", () => {
    // After the swap: a real pawn on a6, his rook on e7; before it: the rook on a6, the pawn on e7.
    const post = "1nbqkbnr/pppprppp/p7/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 1 2";
    const pre = "1nbqkbnr/pppppppp/r7/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 1 2";
    const boss = view([{ kind: "camouflage", turn: 5, square: "a6" }], { camo: { square: "e7", swap: { at: 4, rook: "a6", pawn: "e7" }, reveal: null } }, { board: { fen: post, history: [] } });
    const at = 10_000;
    const moments: Moment[] = [{ kind: "camouflage", key: "k", at, ms: B.camouflage.total, square: "a6" }];
    const before = smudgyFen(boss, moments, at + 100, post)!;
    expect(before.fen).toBe(pre);
    expect(pieceAt(before.fen, "a6")).toEqual({ color: his, type: "r" });
    // (The whole time before the swap, including the boss's move before the moment starts.)
    expect(smudgyFen(boss, moments, at - 1500, post)!.fen).toBe(pre);
    const swapAt = at + B.camouflage.swapAt;
    expect(smudgyFen(boss, moments, swapAt - 10, post)).toMatchObject({ fen: pre, still: true });
    // At the swap (under the paint): the board holds still as it changes; then the plain position.
    const after = smudgyFen(boss, moments, swapAt + 100, post)!;
    expect(after).toMatchObject({ fen: post, still: true });
    expect(smudgyFen(boss, moments, swapAt + 1000, post)).toBeNull();
    // (The plain position is drawn with his rook a pawn: the board does that, camo.ts.)
    trackCamo({ id: "smudgy", crowdSide: "w", board: { fen: post, history: [], bases: [] }, powers: { camo: { side: "a", step: 2, off: false, square: "e7", swap: null, strikeAt: null, reveal: null } as never } });
    expect(pieceAt(seenFen(post), "e7")).toEqual({ color: his, type: "p" });
  });

  it("shows a revealed rook as a pawn until the paint drips off it, naming no move meanwhile", () => {
    // He struck e7 to e1 (a rook's move): the position after.
    const fen = "4k3/8/8/8/8/8/8/4rK2 w - - 0 1";
    const boss = view([{ kind: "unmask", turn: 5, square: "e1", squares: ["e7", "e1"], reveal: "move" }], { camo: { square: null, reveal: { at: 4, square: "e1", how: "move", from: "e7" } } }, { board: { fen, history: [] }, lastMove: { move: "e7e1", san: "Re1+" } });
    const at = 5000;
    const moments: Moment[] = [{ kind: "unmask", key: "k", at, ms: B.unmask.total, square: "e1" }];
    const pre = smudgyFen(boss, moments, at + 100, fen)!;
    // (A pawn of his on the back rank, which only the board's own parser reads: chess can't, so the board and its knock cope.)
    expect(readPieces(pre.fen).get("e1")).toBe("bp");
    expect(pre.hush).toBe(true);
    // The board's knock for it copes with the position chess can't read (no sound, no crash).
    expect(moveKnock(fen, pre.fen, "e7e1")).toBeNull();
    expect(moveKnock(pre.fen, fen, "e7e1")).toBeNull();
    // The drip: the rook shows (the board holds still as it changes).
    const drip = at + B.unmask.dripAt;
    expect(smudgyFen(boss, moments, drip - 10, fen)!.still).toBe(true);
    expect(smudgyFen(boss, moments, drip + 100, fen)).toMatchObject({ fen, hush: false, still: true });
    expect(smudgyFen(boss, moments, drip + 1000, fen)).toBeNull();
  });

  it("paints a Repaint's pieces in their old colors until each stroke: his pawn his, your piece yours", () => {
    // After it: his e5 pawn is yours (white), your bishop on c4 is his (black).
    const fen = "4k3/8/8/4P3/2b5/8/8/4K3 w - - 0 1";
    const boss = view([{ kind: "repaint", turn: 5, squares: ["e5", "c4"] }], { repaint: { at: 4, pawn: "e5", piece: "c4", type: "b", gain: 2 } }, { board: { fen, history: [] } });
    const at = 7000;
    const moments: Moment[] = [{ kind: "repaint", key: "k", at, ms: B.repaint.total }];
    const first = smudgyFen(boss, moments, at + 100, fen)!;
    expect(pieceAt(first.fen, "e5")).toEqual({ color: his, type: "p" });
    expect(pieceAt(first.fen, "c4")).toEqual({ color: "w", type: "b" });
    const mid = smudgyFen(boss, moments, at + B.repaint.stroke1At + 100, fen)!;
    expect(pieceAt(mid.fen, "e5")).toEqual({ color: "w", type: "p" });
    expect(pieceAt(mid.fen, "c4")).toEqual({ color: "w", type: "b" });
    const done = smudgyFen(boss, moments, at + B.repaint.stroke2At + 400, fen);
    expect(done?.fen ?? fen).toBe(fen);
    // (The board holds still as each piece changes color.)
    expect(smudgyFen(boss, moments, at + B.repaint.stroke1At - 10, fen)!.still).toBe(true);
    expect(smudgyFen(boss, moments, at + B.repaint.stroke2At + 10, fen)!.still).toBe(true);
  });
});

describe("the paint over his pawns says nothing of the rook", () => {
  it("covers every square with one of his pawns on the board as the crowd sees it: the same squares, the same order and the same shapes whichever of them the rook is", () => {
    // The same board as the crowd sees it (nine pawns of his in a row), the rook on e7 or on d7.
    const a = "rnbqkbnr/pppprppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const b = "rnbqkbnr/ppprpppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const boss = (fen: string, square: string): CamoBoss & { crowdSide: "w" } => ({
      id: "smudgy",
      crowdSide: "w",
      board: { fen, history: [], bases: [] },
      powers: { camo: { side: "a", step: 2, off: false, square, swap: null, strikeAt: null, reveal: null } as never },
    });
    const rows: string[][] = [];
    for (const [fen, sq] of [[a, "e7"], [b, "d7"]] as const) {
      trackCamo(boss(fen, sq));
      // (Both boards are drawn the same: eight pawns in a row.)
      expect(seenFen(fen).split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
      rows.push(splashRow({ crowdSide: "w", board: { fen } }, "white"));
      trackCamo(null);
    }
    expect(rows[0]).toEqual(rows[1]);
    expect(rows[0]).toHaveLength(8);
    expect(new Set(rows[0]!.map((sq) => sq[1]))).toEqual(new Set(["7"]));
    // The splash's items: the same squares and shapes at every moment of it.
    const moment = { at: 0 };
    for (const now of [1800, 2000, 2300, 2900, 3100]) expect(splashItems(rows[0]!, moment, now)).toEqual(splashItems(rows[1]!, moment, now));
    // No item before it lands, one on every square once it's all down.
    expect(splashItems(rows[0]!, moment, 100)).toEqual([]);
    expect(splashItems(rows[0]!, moment, B.camouflage.swapAt).map((i) => i.square).sort()).toEqual([...rows[0]!].sort());
    // Three shapes in turn.
    expect(new Set(splashItems(rows[0]!, moment, B.camouflage.swapAt).map((i) => i.anim!.slice(-1)))).toEqual(new Set(["A", "B", "C"]));
  });

  it("lists a side's pawns from a position", () => {
    expect(pawnSquares(START_FEN, "b")).toEqual(["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"]);
    expect(pawnSquares(START_FEN, "w")).toEqual(["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"]);
  });
});

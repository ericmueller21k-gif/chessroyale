import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable, playableBosses } from "@chessroyale/core";
import { FOLIO_FX, KING_ATTACK, KING_ATTACKERS, POWER_BANNERS, START_FEN, fenAfter, kingAttackHits } from "@chessroyale/chess";
import { FOLIO, FOLIO_PALETTE } from "../src/characters/folio.ts";
import { FOLIO_ATTACK } from "../src/characters/folio-attack.ts";
import { FOLIO_LINES } from "../src/characters/folio-lines.ts";
import { FOLIO_SOUNDS, folioSound } from "../src/characters/folio-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND, SELECT_TINT } from "../src/characters/boss-select.ts";
import { bossKit } from "../src/characters/kits.ts";
import { EFFECTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { BLOT_MS, CREASE_OUT_MS, FOLD_MS } from "../src/characters/effects/folio.ts";
import { bossBeat } from "../src/characters/boss-beats.ts";
import { FOLIO_BEATS, FOLIO_UI, FOLIO_WORDS, creaseSquares, crossedOut, folioItems, lineDir, movesLeft, revisionFen } from "../src/components/Folio.tsx";
import { powerLine } from "../src/components/BossPowers.tsx";
import type { Moment } from "../src/components/PowerParts.tsx";
import type { BossView } from "../src/game.ts";
import { lineSounds } from "../src/speech.tsx";
import { HOUSES } from "../src/town/houses/index.ts";
import { HOMES } from "../src/town/world.ts";
import { SLIDE_MS } from "../src/board/logic.ts";

/**
 * Folio, the paper crane, in the game (Oct 27: live, its art wired in): its kit, its seven lines, its sounds and voice, the art's
 * timing against FOLIO_FX, its marks' drawing data from the view, Revision's held board, and its home
 * (docs/decisions/2026-10-27-folio-wired.md). Its rules' tests: packages/chess/test/folio.test.ts.
 */

const len = (a: { frames: readonly { ms: number }[] }) => a.frames.reduce((t, f) => t + f.ms, 0);
const kit = bossKit("Folio")!;

describe("Folio: playable", () => {
  it("is on the roster with its kit, met like every other boss, with its attack on a king", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "folio")!;
    expect(def).toMatchObject({ name: "Folio", kit: "Folio" });
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("folio");
    expect(kit.ch).toBe(FOLIO);
    expect(KING_ATTACKERS).toContain("folio");
    expect(kit.kingAttack?.ch).toBe(FOLIO_ATTACK);
  });

  it("says its seven lines as written, each on its own beat, every time; its select line is its entrance", () => {
    expect(FOLIO_LINES).toEqual({
      entrance: ["Every game is a draft. Shall we write one?"],
      power: ["I'll be honest: that piece is next."],
      fold: ["Folded. It'll keep."],
      ultimateWarn: ["Mind the crease."],
      revision: ["Let me write that again."],
      victory: ["Well played. Keep the crane."],
      defeat: ["Beautifully written. I'll fold this one away."],
    });
    expect(kit.lines).toBe(FOLIO_LINES);
    for (const beat of Object.keys(FOLIO_LINES)) expect(kit.chance[beat as keyof typeof kit.chance], beat).toBe(1);
    expect(SELECT_LINES.folio).toEqual(FOLIO_LINES.entrance);
    expect(SELECT_SOUND.folio).toBe("folioHello");
    expect(Object.values(FOLIO_PALETTE)).toContain(SELECT_TINT.folio);
    for (const lines of Object.values(FOLIO_LINES)) for (const l of lines!) expect(l).not.toMatch(/\b(he|him|his)\b/i);
  });

  it("its moments reach their own lines: the Draft's, the fold's and Revision's on their own events; the warning's once (the RAGE warning's)", () => {
    const m = (kind: Moment["kind"]) => ({ kind, key: `folio:${kind}:3` });
    expect(powerLine(kit, m("draft"))).toBe("I'll be honest: that piece is next.");
    expect(powerLine(kit, m("fold"))).toBe("Folded. It'll keep.");
    expect(powerLine(kit, m("revision"))).toBe("Let me write that again.");
    expect(powerLine(kit, m("warn"))).toBe("Mind the crease.");
    expect(powerLine(kit, m("creaseWarn"))).toBeNull();
    expect(powerLine(kit, m("crease"))).toBeNull();
    expect(powerLine(kit, m("creaseEnd"))).toBeNull();
    expect(FOLIO_UI.ultimate).toEqual({ name: "Crease" });
  });

  it("names the banners after its powers, with what each means for you under them; the dock says the crease unfolds", () => {
    expect(POWER_BANNERS).toMatchObject({ draft: [[0, 1500]], fold: [[0, 1500]], crease: [[0, 1500]], revision: [[0, 1500]] });
    expect("creaseEnd" in POWER_BANNERS).toBe(false);
    expect(FOLIO_WORDS).toEqual({
      draft: "End the attack in 2 moves, or it folds",
      fold: "It can't move for 4 turns",
      crease: "Your pieces can't cross it for 4 turns",
      revision: "Both moves crossed out",
      creaseEnd: "The crease unfolds. Your pieces may cross again.",
    });
    expect(FOLIO_UI.moments.creaseEnd.dock!({ kind: "creaseEnd" })).toBe(FOLIO_WORDS.creaseEnd);
  });
});

describe("its art against FOLIO_FX", () => {
  const A = FOLIO.anims;
  it("each moment holds until its animation has played from its cue, and what it draws is down before its end", () => {
    // The Draft: the `check` from its `ink` cue at the banner's end; the blot spread; the line after it.
    expect(kit.anims.power).toBe("check");
    expect(FOLIO_FX.draft).toBeGreaterThanOrEqual(FOLIO_BEATS.draft.inkAt + len(A.check!) - cueAt(A.check!, "ink")!);
    expect(FOLIO_BEATS.draft.lineAt).toBe(FOLIO_BEATS.draft.inkAt + BLOT_MS);
    expect(BLOT_MS).toBe(animLength(EFFECTS.inkMark.ch.anims.blot!));
    // The fold: the `smug` from its `glint`; the paper over.
    expect(kit.anims.fold).toBe("smug");
    expect(FOLIO_FX.fold).toBeGreaterThanOrEqual(FOLIO_BEATS.fold.foldAt + len(A.smug!) - cueAt(A.smug!, "glint")!);
    expect(FOLD_MS).toBe(animLength(EFFECTS.foldPaper.ch.anims.fold!));
    // The Crease: the `move` from its `sweep`.
    expect(kit.anims.ultimate).toBe("move");
    expect(FOLIO_FX.crease).toBeGreaterThanOrEqual(FOLIO_BEATS.crease.pressAt + len(A.move!) - cueAt(A.move!, "sweep")!);
    // Its unfolding inside creaseEnd.
    expect(CREASE_OUT_MS).toBe(animLength(EFFECTS.creaseEdge.ch.anims.outE!));
    expect(CREASE_OUT_MS).toBeLessThanOrEqual(FOLIO_FX.creaseEnd);
    // Revision: the `rattled` from its first stroke; the strokes, then the pieces back (their slide) before its end.
    expect(kit.anims.revision).toBe("rattled");
    expect(FOLIO_FX.revision).toBeGreaterThanOrEqual(FOLIO_BEATS.revision.strikeAt[0] + len(A.rattled!));
    expect(FOLIO_BEATS.revision.backAt).toBeGreaterThan(FOLIO_BEATS.revision.strikeAt[3] + animLength(EFFECTS.inkStrike.ch.anims.strike!));
    expect(FOLIO_BEATS.revision.backAt + SLIDE_MS).toBeLessThanOrEqual(FOLIO_FX.revision);
    // The warning: its thinking, which plays no sound (your plain move's screen has only the board's knock).
    expect(kit.anims.ultimateWarn).toBe("thinking");
    expect(A.thinking!.frames.some((f) => f.cue)).toBe(false);
  });

  it("strikes the king with ink on every shared hit, a scratch and a dab in turn, and lasts the attack exactly", () => {
    const a = FOLIO_ATTACK.anims.kingAttack!;
    expect(len(a)).toBe(KING_ATTACK.ms);
    let t = 0;
    const hits: [number, string][] = [];
    for (const f of a.frames) {
      if (f.cue === "ink" || f.cue === "dab") hits.push([t, f.cue]);
      t += f.ms;
    }
    expect(hits.map(([at]) => at)).toEqual(kingAttackHits());
    expect(hits.map(([, c]) => c)).toEqual(kingAttackHits().map((_, i) => (i % 2 ? "dab" : "ink")));
    expect(a.frames[0]!.layers).toEqual([]);
    expect(a.frames.at(-1)!.layers).toEqual([]);
  });
});

describe("its sounds and its voice", () => {
  const measure = (s: Float32Array) => {
    let peak = 0;
    let sum = 0;
    for (const v of s) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    return { peak, db: 10 * Math.log10(sum / s.length) };
  };

  it("each stay under a piece's move, in peak and loudness (the #271 rule), and are the same every time", () => {
    for (const n of FOLIO_SOUNDS) {
      const m = measure(folioSound(n, 44100));
      expect(m.peak, n).toBeLessThan(MOVE_PEAK / 2);
      expect(m.db, n).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(folioSound(n, 22050).length, n).toBeGreaterThan(0);
    }
  });

  it("wire every cue of its figure, its attack and its board art to one of its sounds", () => {
    for (const ch of [FOLIO, FOLIO_ATTACK]) for (const [anim, a] of Object.entries(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${anim} ${f.cue}`).toMatch(/^folio[A-Z]/);
    for (const name of ["inkMark", "foldPaper", "creaseEdge", "inkStrike"] as const) for (const a of Object.values(EFFECTS[name].ch.anims)) for (const f of a.frames) if (f.cue) expect(EFFECTS[name].sounds[f.cue], `${name} ${f.cue}`).toMatch(/^folio[A-Z]/);
  });

  it("keeps its attack's ten strokes together under a move", () => {
    const rate = 44100;
    const hits = kingAttackHits();
    const mix = new Float32Array(Math.ceil(((hits.at(-1)! - hits[0]! + 1000) / 1000) * rate));
    hits.forEach((t, i) => {
      const w = folioSound(i % 2 ? "dab" : "scratch", rate);
      const at = Math.round(((t - hits[0]!) / 1000) * rate);
      for (let j = 0; j < w.length && at + j < mix.length; j++) mix[at + j]! += w[j]!;
    });
    const m = measure(mix.subarray(0, Math.round(((hits.at(-1)! - hits[0]!) / 1000) * rate)));
    expect(m.peak).toBeLessThan(MOVE_PEAK);
    expect(m.db).toBeLessThan(MOVE_MEAN_DB);
  });

  it("speaks each of its lines with its chirp, one short sound whatever the line (Eric, Oct 27), in the battle's voice only", () => {
    for (const lines of Object.values(FOLIO_LINES)) for (const l of lines!) expect(lineSounds.get(l), l).toBe("folioVoice");
    // (Short: the whisper it replaced ran 0.6 to 1.6 s, as long as the line.)
    expect(folioSound("voice", 44100).length / 44100).toBeLessThan(0.4);
    // Its town sounds (a tap on it in the town square): a murmur and a soft "mm-hm", each under 0.6 s.
    for (const n of ["murmur", "hum"] as const) expect(folioSound(n, 44100).length / 44100, n).toBeLessThan(0.6);
  });
});

/** A battle's view, as the screens read it. */
function view(powers: Record<string, unknown>, extra: Partial<BossView> = {}): BossView {
  return { id: "folio", name: "Folio", startMove: 1, crowdSide: "w", crowdMoves: 2, board: { id: 0, fen: START_FEN, history: [], ply: 0, lastMove: null, bases: [], generation: 0 }, powers: { events: [], turn: 3, draft: null, folded: [], crease: null, creaseNext: null, revision: null, ...powers }, ...extra } as unknown as BossView;
}
const names = (items: { name: string; square: string; anim?: string }[]) => items.map((i) => `${i.name}@${i.square}:${i.anim}`);

describe("its marks, drawn from the view", () => {
  it("the ink mark under the piece with your moves left at its corner, and the attack's line on the squares between", () => {
    const b = view({ draft: { square: "a1", attacker: "a8", line: ["a7", "a6", "a5"], until: 4 } });
    const { under, over } = folioItems(b, [], 1000, "white");
    expect(names(under)).toEqual(["inkMark@a1:mark2", "inkLine@a7:v", "inkLine@a6:v", "inkLine@a5:v"]);
    expect(over).toEqual([]);
    expect(movesLeft(4, 2)).toBe(2);
    expect(movesLeft(4, 3)).toBe(1);
    expect([lineDir("a8", "a1"), lineDir("h4", "c4"), lineDir("f6", "c3"), lineDir("b7", "e4"), lineDir("c3", "f6")]).toEqual(["v", "h", "d1", "d2", "d1"]);
  });

  it("on its moment's screen, nothing until its ink lands, then the blot spreading, the line once it has", () => {
    const b = view({ draft: { square: "e3", attacker: "c4", line: [], until: 4 } }, { id: "folio", startMove: 7 });
    const m: Moment = { kind: "draft", key: "folio:draft:3", at: 10_000, ms: FOLIO_FX.draft };
    expect(folioItems(b, [m], 10_000 + FOLIO_BEATS.draft.inkAt - 1, "white").under).toEqual([]);
    expect(names(folioItems(b, [m], 10_000 + FOLIO_BEATS.draft.inkAt + 10, "white").under)).toEqual(["inkMark@e3:blot"]);
    expect(names(folioItems(b, [m], 10_000 + FOLIO_BEATS.draft.inkAt + BLOT_MS + 10, "white").under)).toEqual(["inkMark@e3:mark2"]);
  });

  it("the paper over a folded piece, and the mark drying away as it goes", () => {
    const b = view({ draft: { square: "c3", attacker: "f6", line: ["e5", "d4"], until: 4 } }, { startMove: 11 });
    folioItems(b, [], 1000, "white");
    const f = view({ folded: ["c3"] }, { startMove: 11 });
    const { under, over } = folioItems(f, [], 2000, "white");
    expect(names(over)).toEqual(["foldPaper@c3:folded"]);
    expect(names(under)).toEqual(["inkMark@c3:fade"]);
    // Dried a moment later; and the paper opens when the piece is free.
    expect(folioItems(f, [], 2000 + animLength(EFFECTS.inkMark.ch.anims.fade!) + 1, "white").under).toEqual([]);
    expect(names(folioItems(view({}, { startMove: 11 }), [], 3000, "white").over)).toEqual(["foldPaper@c3:unfold"]);
  });

  it("the fold's moment, while it thinks (the view's `folded` empty until your next turn): nothing until its fold, then the paper folding over its square", () => {
    const b = view({}, { startMove: 31 });
    const m: Moment = { kind: "fold", key: "folio:fold:12", at: 20_000, ms: FOLIO_FX.fold, square: "a5" };
    expect(folioItems(b, [m], 20_000 + FOLIO_BEATS.fold.foldAt - 1, "white").over).toEqual([]);
    expect(names(folioItems(b, [m], 20_000 + FOLIO_BEATS.fold.foldAt + 10, "white").over)).toEqual(["foldPaper@a5:fold"]);
    expect(names(folioItems(b, [m], 20_000 + FOLIO_BEATS.fold.foldAt + FOLD_MS + 10, "white").over)).toEqual(["foldPaper@a5:folded"]);
  });

  it("the crease's squares: both sides of its line, either way up, the light side (left or top as drawn) its highlight and the pencil's", () => {
    const de = creaseSquares("d|e", "white");
    expect(de).toHaveLength(16);
    expect(de.filter((s) => s.square.startsWith("d")).every((s) => s.side === "E" && s.lit)).toBe(true);
    expect(de.filter((s) => s.square.startsWith("e")).every((s) => s.side === "W" && !s.lit)).toBe(true);
    const deB = creaseSquares("d|e", "black");
    expect(deB.filter((s) => s.square.startsWith("d")).every((s) => s.side === "W" && !s.lit)).toBe(true);
    const r45 = creaseSquares("4|5", "white");
    expect(r45.filter((s) => s.square.endsWith("5")).every((s) => s.side === "S" && s.lit)).toBe(true);
    expect(r45.filter((s) => s.square.endsWith("4")).every((s) => s.side === "N")).toBe(true);
    expect(creaseSquares("4|5", "black").filter((s) => s.square.endsWith("4")).every((s) => s.side === "S")).toBe(true);
    // Warned of: the pencil line on its light side; holding: the crease on both sides; unfolding with creaseEnd.
    expect(names(folioItems(view({ creaseNext: "g|h" }, { startMove: 21 }), [], 0, "white").under)).toEqual(Array.from({ length: 8 }, (_, i) => `creasePencil@g${i + 1}:E`));
    const held = folioItems(view({ crease: { line: "4|5", at: 3, until: 6, side: "w" } }, { startMove: 22 }), [], 0, "white").under;
    expect(held).toHaveLength(16);
    expect(held.every((i) => i.name === "creaseEdge" && i.anim!.startsWith("held"))).toBe(true);
    const end: Moment = { kind: "creaseEnd", key: "folio:creaseEnd:7", at: 5000, ms: FOLIO_FX.creaseEnd };
    const out = folioItems(view({ events: [{ kind: "creaseEnd", turn: 7, line: "4|5" }] }, { startMove: 23 }), [end], 5100, "white").under;
    expect(out.every((i) => i.anim!.startsWith("out"))).toBe(true);
    expect(out.filter((i) => !i.quiet)).toHaveLength(1);
  });
});

describe("Revision on the board and in the move list", () => {
  // Its move e7e5 and your reply d4e5 crossed out: a base at ply 4 back to after ply 2.
  const history = ["d2d4", "g8f6", "e7e5", "d4e5"].slice(0);
  const real = ["d2d4", "g8f6", "c2c4", "e7e5", "d4e5"];
  const base = { ply: 5, fen: fenAfter(real.slice(0, 3)), from: 3 };
  const b = view({ revision: { at: 3, moves: ["e7e5", "d4e5"], sans: ["e5", "dxe5"], move: null, san: null } }, { board: { id: 0, fen: base.fen, history: real, ply: 5, lastMove: null, bases: [base], generation: 0 } as unknown as BossView["board"] });
  const m: Moment = { kind: "revision", key: "folio:revision:3", at: 1000, ms: FOLIO_FX.revision, squares: ["e7e5", "d4e5"] };

  it("holds the position after your move until the page turns, then the board's own (already back)", () => {
    expect(history).toHaveLength(4);
    expect(revisionFen(b, [m], 1000 + FOLIO_BEATS.revision.backAt - 1)).toEqual({ fen: fenAfter(real), lastMove: "d4e5" });
    expect(revisionFen(b, [m], 1000 + FOLIO_BEATS.revision.backAt)).toBeNull();
    expect(revisionFen(b, [], 1000)).toBeNull();
  });

  it("strikes its move's squares, then yours, until the page turns", () => {
    const at = (t: number) => folioItems(b, [m], 1000 + t, "white").over.map((i) => i.square);
    expect(at(FOLIO_BEATS.revision.strikeAt[0] - 1)).toEqual([]);
    expect(at(FOLIO_BEATS.revision.strikeAt[1])).toEqual(["e7", "e5"]);
    expect(at(FOLIO_BEATS.revision.strikeAt[3])).toEqual(["e7", "e5", "d4", "e5"]);
    expect(at(FOLIO_BEATS.revision.backAt)).toEqual([]);
  });

  it("crosses out the two plies in the move list (the base's `from` to its ply), none for another base", () => {
    expect([...crossedOut([base])]).toEqual([3, 4]);
    expect([...crossedOut([{ ply: 4, fen: START_FEN }])]).toEqual([]);
  });

  it("its thinking after Revision isn't hurt, whatever the crossed-out moves took", () => {
    const beat = bossBeat(kit, { stage: "thinking", fen: base.fen, history: real, bases: [base], crowdSide: "w", lastMove: null });
    expect(beat.anim).toBe("thinking");
  });
});

describe("its home: Folio's Folded House", () => {
  it("stands on the town square with its name, its picture in Folio's own colors (its faded ink its own), its lights in its picture", () => {
    const home = HOMES.find((h) => h.id === "folio")!;
    expect(home).toMatchObject({ boss: "Folio", name: "Folio's Folded House", cx: 33, cy: 30 });
    const art = HOUSES.folio;
    expect([art.ch.w, art.ch.h, art.ch.foot]).toEqual([144, 136, [72, 132]]);
    for (const [k, c] of Object.entries(FOLIO_PALETTE)) if (k in art.ch.palette && !"ij123".includes(k)) expect(art.ch.palette[k], k).toBe(c);
    expect([art.ch.palette.i, art.ch.palette.j]).toEqual(["#b0b4c8", "#9497aa"]);
    expect(art.lights.length).toBeGreaterThan(0);
    for (const l of art.lights) expect(l.x >= 0 && l.y >= 0 && l.x + l.w <= art.ch.w && l.y + l.h <= art.ch.h).toBe(true);
    expect(art.pools).toHaveLength(1);
  });
});

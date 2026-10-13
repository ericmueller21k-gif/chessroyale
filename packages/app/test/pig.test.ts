import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, SPEECH, isPlayable, type ShowdownResult } from "@chessroyale/core";
import { DRAG, PULL, SHOWDOWN, START_FEN, applyMove, checkLineup, lineups, pieceAt } from "@chessroyale/chess";
import { CHARACTERS } from "../src/characters/index.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { CATCH, CATCH_AT, HAUL_FISTS, PIG, PIG_LEAP, PIG_LINES, PIG_PORTRAIT } from "../src/characters/pig.ts";
import { PIG_SOUNDS, pigSound } from "../src/characters/pig-sounds.ts";
import { POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { duelCount, duelTurn, lassoStand, pigBoard, showdownFen } from "../src/components/Pig.tsx";
import { powerLine } from "../src/components/BossPowers.tsx";
import { squareXY } from "../src/components/GodKing.tsx";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import { holdMs } from "../src/speech.tsx";
import type { BossView } from "../src/game.ts";

// Wrangler (code id `pig`): his art (the checks characters.test.ts makes of every character, and his own), his kit, his
// moments on the board, his lines and his sounds.
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const idle = PIG.anims.idle!;
const kit = BOSS_KITS["Wrangler"]!;

describe("Wrangler, the cowboy pig", () => {
  it("is the roster's pig (Wrangler), playable, his kit under his name, wide on a phone like Sawyer", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "pig")!;
    expect(def).toMatchObject({ name: "Wrangler", kit: "Wrangler" });
    expect(isPlayable(def)).toBe(true);
    expect(kit.ch).toBe(PIG);
    expect(kit.wide).toBe(true);
    expect(CHARACTERS).toContain(PIG);
    expect(POWER_MOMENTS["Wrangler"]).toBeTruthy();
    expect(powersLine(def)).toBe(`${POWER_WORDS.drag} · ${POWER_WORDS.showdown}`);
    expect(BOSS_ROSTER.some((b) => b.id === "wrangler")).toBe(false);
  });

  it("draws every part only with colours in his palette", () => {
    for (const [name, part] of Object.entries(PIG.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(PIG.palette, `${name}: "${k}"`).toHaveProperty(k);
  });

  it("idles silently in a loop; his one-shots fire cues, each wired to a sound of his own", () => {
    expect(idle.loop).toBe(true);
    expect(idle.frames.some((f) => f.cue)).toBe(false);
    for (const name of ["lasso", "taunt", "windup", "leap"]) {
      const a = PIG.anims[name]!;
      expect(a.loop, name).toBe(false);
      expect(a.frames.some((f) => f.cue), name).toBe(true);
    }
    const cues = (name: string) => PIG.anims[name]!.frames.map((f) => f.cue).filter(Boolean);
    expect(cues("lasso")).toEqual(["whirl", "throw", "catch", "tug"]);
    expect(cues("taunt")).toEqual(["tip", "laugh", "snort", "stomp"]);
    for (const [name, an] of Object.entries(PIG.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toMatch(/^pig/);
    for (const sound of Object.values(kit.sounds)) expect(sound).toMatch(/^pig/);
  });

  it("renders every frame without anything cut off at the frame's edge", () => {
    for (const [name, anim] of Object.entries(PIG.anims))
      anim.frames.forEach((f, i) => {
        expect(renderFrame(PIG, f).data.length).toBe(PIG.w * PIG.h * 4);
        const keys = frameKeys(PIG, f);
        const edge = [...keys[0]!, ...keys[PIG.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[PIG.w - 1])];
        expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
      });
  });

  it("never rises above his spinning loop at rest, so on a phone he stays under the boss bar's heading", () => {
    const highest = Math.min(...idle.frames.map((f) => top(frameKeys(PIG, f))));
    for (const [name, anim] of Object.entries(PIG.anims))
      anim.frames.forEach((f, i) => expect(top(frameKeys(PIG, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
    expect(PIG.foot[1] - highest).toBeLessThanOrEqual(70);
  });

  it("stands his feet on the ground point; spins his loop the whole idle", () => {
    const keys = frameKeys(PIG, idle.frames[0]!);
    const [fx, fy] = PIG.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
    const loops = idle.frames.map((f) => f.layers.find((l) => l.part.startsWith("loop:"))!.part);
    expect(loops.every((l, i) => l !== loops[(i + 1) % loops.length])).toBe(true);
  });

  it("throws his loop out to our right and it lands on the ground at CATCH (CATCH_AT in his frame)", () => {
    const land = PIG.anims.lasso!.frames.find((f) => f.cue === "catch")!;
    const keys = frameKeys(PIG, land);
    expect(keys[CATCH_AT[1]]![CATCH_AT[0] - 9]).toBeTruthy();
    expect(CATCH_AT[0] - CATCH[0]).toBe(PIG.foot[0] - 40);
    expect(CATCH[0]).toBeGreaterThan(80);
  });

  it("has a portrait inside his frame that shows his hat, eyes, snout and teeth", () => {
    const p = PIG_PORTRAIT;
    expect(kit.portrait).toMatchObject(p);
    expect(p.x + p.w).toBeLessThanOrEqual(PIG.w);
    expect(p.y + p.h).toBeLessThanOrEqual(PIG.h);
    const keys = frameKeys(PIG, idle.frames[0]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    for (const k of ["j", "y", "w", "x", "n", "e"]) expect(inside, k).toContain(k);
  });
});

describe("his moments' animations", () => {
  it("leaps: off the ground at upAt (his boots tucked up), down at landAt with a hop's thump", () => {
    const leap = PIG.anims.leap!;
    expect(cueAt(leap, "hop")).toBe(PIG_LEAP.landAt);
    expect(leap.frames[0]!.ms).toBe(PIG_LEAP.upAt);
    expect(animLength(leap)).toBeLessThan(900);
  });

  it("hauls with empty hands (the board draws his ropes from his fists), a heave and a tug cue every half second, in a loop", () => {
    const haul = PIG.anims.haul!;
    expect(haul.loop).toBe(true);
    expect(haul.frames.filter((f) => f.cue === "tug").length).toBe(2);
    for (const f of haul.frames) expect(f.layers.some((l) => l.part.startsWith("loop:"))).toBe(false);
    // His fists are where the board starts the ropes: inside his frame, low and in front of him.
    for (const [x, y] of HAUL_FISTS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(PIG.w);
      expect(y).toBeGreaterThan(PIG.foot[1] - 40);
    }
  });

  it("the drag's beats follow his lasso: the piece slides on his tug, after his loop lands", () => {
    const lasso = PIG.anims.lasso!;
    expect(DRAG.tugAt - DRAG.catchAt).toBe(cueAt(lasso, "tug")! - cueAt(lasso, "catch")!);
    expect(PULL).toBe(DRAG);
    // He lands from his hop before the throw starts, and is back before the moment ends.
    expect(DRAG.landAt).toBe(DRAG.hopAt + PIG_LEAP.landAt - PIG_LEAP.upAt);
    expect(DRAG.catchAt - cueAt(lasso, "catch")!).toBeGreaterThanOrEqual(DRAG.landAt);
    expect(DRAG.backAt + PIG_LEAP.landAt - PIG_LEAP.upAt).toBeLessThanOrEqual(DRAG.total);
    expect(SHOWDOWN.landAt).toBe(SHOWDOWN.dropAt + PIG_LEAP.landAt - PIG_LEAP.upAt);
    expect(SHOWDOWN.cornerAt).toBe(SHOWDOWN.throwAt + PIG_LEAP.landAt - PIG_LEAP.upAt);
  });
});

describe("on the board", () => {
  const centre = (sq: string, o: "white" | "black") => {
    const { x, y } = squareXY(sq, o);
    return { x: x / 8, y: y / 8 };
  };
  /** Where his loop lands for a stand (the art's CATCH from his feet, mirrored when he faces left). */
  const loopAt = (s: { feet: { x: number; y: number }; flip: boolean }) => {
    const px = 47 / PIG.w;
    const dx = (CATCH_AT[0] - PIG.foot[0]) * px;
    const dy = (CATCH_AT[1] - PIG.foot[1]) * px;
    return { x: s.feet.x + (s.flip ? -dx : dx), y: s.feet.y + dy };
  };

  it("his lasso's CATCH lands exactly on the piece he drags, from wherever he can stand on the board", () => {
    for (const o of ["white", "black"] as const)
      for (const f of "abcdefgh")
        for (const r of [2, 4, 7])
          for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const fromSq = `${f}${r}`;
            const ff = f.charCodeAt(0) - 97 + df;
            if (ff < 0 || ff > 7) continue;
            const toSq = `${"abcdefgh"[ff]}${r + dr}`;
            const s = lassoStand(centre(fromSq, o), centre(toSq, o));
            const at = loopAt(s);
            expect(at.x, `${fromSq}-${toSq} ${o}`).toBeCloseTo(centre(fromSq, o).x, 6);
            expect(at.y).toBeCloseTo(centre(fromSq, o).y, 6);
            expect(s.feet.x).toBeGreaterThanOrEqual(4);
            expect(s.feet.x).toBeLessThanOrEqual(96);
          }
  });

  it("he stands on the side the piece is hauled towards (it comes to him), room allowing", () => {
    const o = "white";
    expect(lassoStand(centre("e4", o), centre("d4", o)).flip).toBe(false);
    expect(lassoStand(centre("d4", o), centre("e4", o)).flip).toBe(true);
    // Near the left edge, hauled left: no room on that side, so the other.
    expect(lassoStand(centre("b4", o), centre("a4", o)).flip).toBe(true);
  });

  /** A boss view with his powers as the moment shows them. */
  const view = (fen: string, powers: Record<string, unknown>): BossView =>
    ({ id: "pig", name: "Wrangler", crowdSide: "w", startMove: 1, board: { fen, history: [], generation: 0 }, powers: { turn: 3, events: [], ...powers } }) as unknown as BossView;

  it("a drag: the piece where it was until his tug, off the board (the moment draws it) as it slides, then on its new square", () => {
    const before = applyMove(applyMove(START_FEN, "e2e4"), "e7e5");
    const after = before.replace("4P3", "3P4");
    const p = { drag: { turn: 3, from: "e4", to: "d4", piece: "p" } };
    const m = { kind: "drag" as const, key: "k", at: 1000, ms: DRAG.total, square: "d4", squares: ["e4", "d4"] };
    const at = (t: number) => pigBoard(view(after, p), [m], 1000 + t, after);
    // (Before the moment too: his move shows first.)
    expect(pieceAt(at(-500)!.fen, "e4")).toEqual({ color: "w", type: "p" });
    expect(pieceAt(at(-500)!.fen, "d4")).toBeNull();
    expect(at(-500)!.still).toBe(false);
    const slide = DRAG.tugAt;
    expect(pieceAt(at(slide + 50)!.fen, "e4")).toBeNull();
    expect(pieceAt(at(slide + 50)!.fen, "d4")).toBeNull();
    expect(at(slide + 50)!.still).toBe(true);
    expect(at(slide + 50)!.evalFen).toBe(at(-500)!.fen);
    expect(at(DRAG.total + 500)).toBeNull();
  });

  it("the long pull: his double step shown (and marked) until the tug, then the pawn a square further", () => {
    const fen = applyMove(applyMove(START_FEN, "e2e4"), "d7d5").replace("3p4/4P3", "8/3pP3");
    const p = { pull: { turn: 2, from: "d7", via: "d5", to: "d4" } };
    const m = { kind: "pull" as const, key: "k", at: 0, ms: PULL.total, square: "d4", squares: ["d7", "d5", "d4"] };
    const b = pigBoard(view(fen, p), [m], 100, fen)!;
    expect(pieceAt(b.fen, "d5")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(b.fen, "d4")).toBeNull();
    expect(b.lastMove).toBe("d7d5");
  });

  it("the showdown: the pairs yanked in one at a time, each off the board on its way; at the end, the line-up", () => {
    const fen = "r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 w - - 0 10";
    const l = [...lineups(fen, 3, 3, 3000)].find(Boolean)!;
    const sd: ShowdownResult = { turn: 3, pairs: l.pairs, before: fen, edge: null };
    expect(showdownFen(sd, 0)).toBe(fen);
    const [t0] = SHOWDOWN.pairs;
    const mid = showdownFen(sd, t0! + 100);
    expect(pieceAt(mid, l.pairs[0]!.crowdFrom)).toBeNull();
    expect(pieceAt(mid, l.pairs[0]!.crowd)).toBeNull();
    expect(pieceAt(mid, l.pairs[1]!.crowdFrom)).not.toBeNull();
    const placed = showdownFen(sd, t0! + SHOWDOWN.yankMs + 100);
    expect(pieceAt(placed, l.pairs[0]!.crowd)).toEqual({ color: "w", type: l.pairs[0]!.piece });
    expect(pieceAt(placed, l.pairs[0]!.boss)).toEqual({ color: "b", type: l.pairs[0]!.piece });
    expect(showdownFen(sd, SHOWDOWN.total).split(" ")[0]).toBe(l.fen.split(" ")[0]);
    expect(checkLineup(fen, l.spec)!.fen).toBe(l.fen);
    // In the moment: still from the first yank, the eval bar on the position before.
    const m = { kind: "showdown" as const, key: "k", at: 0, ms: SHOWDOWN.total };
    const b = pigBoard(view(l.fen, { showdown: sd }), [m], t0! + 100, l.fen)!;
    expect(b.still).toBe(true);
    expect(b.evalFen).toBe(fen);
    // The duel's turn (the dock's rule, and how many duels it names): only while the crowd must pick one.
    const duel = view(l.fen, { showdown: sd, allowed: l.duels });
    expect(duelTurn(duel)).toBe(true);
    expect(duelCount(duel)).toBe(3);
    expect(duelCount(view(l.fen, { showdown: { ...sd, pairs: sd.pairs.slice(0, 2) }, allowed: l.duels.slice(0, 2) }))).toBe(2);
    expect(duelTurn(view(l.fen, { showdown: sd, allowed: l.duels, turn: 4 }))).toBe(false);
    expect(duelCount(view(l.fen, { showdown: sd, turn: 4 }))).toBe(0);
  });
});

describe("his lines", () => {
  it("in a cowboy pig's voice, each held whole by the speech rule (none cut short by its cap)", () => {
    for (const [beat, lines] of Object.entries(PIG_LINES)) {
      expect(lines!.length, beat).toBeGreaterThan(0);
      for (const line of lines!) {
        expect(SPEECH.readMs + SPEECH.perCharMs * line.length, `${beat}: ${line}`).toBeLessThan(SPEECH.maxReadMs);
        expect(holdMs(line)).toBeGreaterThan(SPEECH.readMs);
      }
    }
    expect(PIG_LINES.hold).toContain("Not yet...");
    expect(PIG_LINES.ultimate).toContain("This board ain't big enough for the six of us.");
    expect(PIG_LINES.smug!.some((l) => /snort/i.test(l))).toBe(true);
  });

  it("his powers' lines: the pull's, a drag's, the drag standing in for a showdown, \"Not yet...\" only while he holds it", () => {
    const line = (kind: string, ult?: true) => powerLine(kit, { kind: kind as never, key: `pig:${kind}:5`, ...(ult ? { ult } : {}) });
    expect(PIG_LINES.pull).toContain(line("pull"));
    expect(PIG_LINES.power).toContain(line("drag"));
    expect(PIG_LINES.tug).toContain(line("drag", true));
    expect(PIG_LINES.hold).toContain(line("hold"));
    // (His showdown spent with neither a line-up nor a drag: not "Not yet...", since there's no next try.)
    expect(PIG_LINES.spent).toContain(line("hold", true));
    expect(PIG_LINES.ultimate).toContain(line("showdown"));
  });
});

describe("his sounds", () => {
  it("no louder than a piece's move, and the same every time", () => {
    for (const name of PIG_SOUNDS) {
      const s = pigSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(pigSound(name, 44100));
    }
  });

  it("have no chimes or bright dings: rope, boots, snorts and a low twang, their energy low", () => {
    for (const name of PIG_SOUNDS) {
      const s = pigSound(name, 44100);
      let e = 0;
      let d = 0;
      for (let i = 1; i < s.length; i++) {
        e += s[i]! ** 2;
        d += (s[i]! - s[i - 1]!) ** 2;
      }
      expect((Math.sqrt(d / e) * 44100) / (2 * Math.PI), name).toBeLessThan(2500);
    }
  });
});

import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, isPlayable, playableBosses, type PowerEvent } from "@chessroyale/core";
import { ALFIL_BEATS, ALFIL_FX, POWER_FX, START_FEN, pieceAt } from "@chessroyale/chess";
import { momentsOf, noMoveLine, dockLine } from "../src/components/BossPowers.tsx";
import { ALFIL_UI, FUSION_LINE, alfilFen, alfilJolt, earlyLanding, landingBeats } from "../src/components/Alfil.tsx";
import { ALFIL, ALFIL_LINES } from "../src/characters/alfil.ts";
import { ALFIL_SOUNDS, alfilSound } from "../src/characters/alfil-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { CHARACTERS } from "../src/characters/index.ts";
import { POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys } from "../src/characters/sprite.ts";
import { bossKit } from "../src/characters/kits.ts";
import { BOSS_BLOCKS } from "../src/faq/content.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import type { BossView } from "../src/game.ts";
import type { Moment } from "../src/components/PowerParts.tsx";

/**
 * Alfil in the game (Oct 17: live, his art wired in): his kit, his sounds and lines, his moments timed by his
 * animations' cues (ALFIL_BEATS), the board under them, and the select screen (docs/decisions/2026-10-17-alfil-wired.md).
 */
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, crowdMoves = 4, fen = START_FEN, extra: Record<string, unknown> = {}): BossView =>
  ({ id: "alfil", name: "Alfil", crowdSide: "w", crowdMoves, startMove: 1, lastMove: null, board: { fen, history: [] }, powers: { events, turn: 4, ...powers }, ...extra }) as unknown as BossView;
const moment = (kind: Moment["kind"], at = 10_000, squares?: string[]): Moment => ({ kind, key: `alfil:${kind}:4`, at, ms: POWER_FX[kind as keyof typeof POWER_FX], ...(squares ? { squares } : {}) });

describe("Alfil is live", () => {
  it("is playable: his kit (every moment, his powers' moments, lines, a portrait), his power words, and the character tests cover him", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "alfil")!;
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("alfil");
    const kit = bossKit(def.name)!;
    expect(kit.ch).toBe(ALFIL);
    expect(CHARACTERS).toContain(ALFIL);
    expect(kit.anims).toMatchObject({ power: "tusksCast", powerHit: "tusksFuse", ultimate: "mammothSlam", ultimateWarn: "check" });
    for (const a of Object.values(kit.anims)) expect(ALFIL.anims[a!], a).toBeTruthy();
    expect(kit.wide).toBe(true);
    expect(powersLine(def)).toBe(`${POWER_WORDS.tusks} · ${POWER_WORDS.slam}`);
    expect(POWER_MOMENTS.Alfil!.power.anim).toBe("tusksCast");
  });

  it("says Eric's lines (the sheet's, the fusion's three) and a line for every power's moment", () => {
    expect(ALFIL_LINES.entrance).toContain("Before your bishops, there was me.");
    expect(ALFIL_LINES.power).toContain("Two little pawns make one big problem.");
    expect(ALFIL_LINES.ultimateWarn).toContain("Hold on to something.");
    expect(ALFIL_LINES.ultimate).toContain("What goes up…");
    expect(ALFIL_LINES.powerHit).toEqual(["Worth the wait.", "I'll skip my move. You'll wish I hadn't.", "Patience. Something old is coming back."]);
    for (const beat of ["power", "powerHit", "ultimateWarn", "ultimate", "ultimateHit"] as const) expect(ALFIL_LINES[beat]?.length, beat).toBeGreaterThan(0);
    for (const lines of Object.values(ALFIL_LINES)) for (const l of lines!) expect(l.length, l).toBeLessThanOrEqual(42);
  });

  it("has a sound of his own for every cue but none of a piece's, each quieter than a move and the same every time", () => {
    const kit = bossKit("Alfil")!;
    for (const [name, a] of Object.entries(ALFIL.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toMatch(/^alfil/);
    // (The sheet's: a grinding crunch, then a short trumpet, for the fusion; the big trumpet on the Slam's leap, the thud
    // as he lands it, a whoosh for the pieces flying up.)
    expect(kit.sounds).toMatchObject({ flash: "alfilCrunch", trumpet: "alfilTrumpet", leap: "alfilLeap", slam: "alfilThud", fly: "alfilWhoosh", swing: "alfilWhoosh" });
    expect(cueAt(ALFIL.anims.tusksFuse!, "trumpet")!).toBeGreaterThan(cueAt(ALFIL.anims.tusksFuse!, "flash")!);
    for (const name of ALFIL_SOUNDS) {
      const s = alfilSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(alfilSound(name, 44100));
    }
  });

  it("on the select screen: his trumpet, lines that read outside a match, and full size on the stage (70 px tall or less)", () => {
    expect(SELECT_SOUND.alfil).toBe("alfilTrumpet");
    expect(SELECT_LINES.alfil).toContain("Before your bishops, there was me.");
    const rows = frameKeys(ALFIL, ALFIL.anims.idle!.frames[0]!);
    const top = rows.findIndex((r) => r.some((k) => k !== null));
    // (The stage draws every boss at 0.8 a pixel up to 56 / 0.8 = 70 px tall: BossSelect.tsx.)
    expect(ALFIL.foot[1] - top).toBeLessThanOrEqual(70);
  });
});

describe("his moments, timed by his animations' cues", () => {
  const A = ALFIL.anims;
  const B = ALFIL_BEATS;
  it("the moments' lengths are the beats' (the server waits for them)", () => {
    expect(ALFIL_FX).toEqual({ tusks: B.tusks.total, fuse: B.fuse.total, slam: B.slam.total, land: B.land.total });
    for (const k of ["tusks", "fuse", "slam", "land"] as const) expect(POWER_FX[k]).toBe(ALFIL_FX[k]);
  });

  it("the cast: the banner's end is his `cast`, the glow's start; his animation inside the moment", () => {
    const start = B.tusks.castAt - cueAt(A.tusksCast!, "cast")!;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start + animLength(A.tusksCast!)).toBeLessThanOrEqual(B.tusks.total);
    expect(ALFIL_UI.moments.tusks.appearAt!(moment("tusks", 1000, ["a7", "c7"]), "a7", "white")).toBe(1000 + B.tusks.castAt);
    expect(ALFIL_UI.moments.tusks.appearAt!(moment("tusks", 1000, ["a7", "c7"]), "e4", "white")).toBeUndefined();
  });

  it("the fusion: `rise` as the pawns lift, `flash` as they meet; the elephant lands after the flash, inside the moment", () => {
    expect(cueAt(A.tusksFuse!, "flash")! - cueAt(A.tusksFuse!, "rise")!).toBe(B.fuse.flashAt - B.fuse.riseAt);
    expect(B.fuse.riseAt - cueAt(A.tusksFuse!, "rise")! + animLength(A.tusksFuse!)).toBeLessThanOrEqual(B.fuse.total);
    expect(B.fuse.landAt).toBeGreaterThan(B.fuse.flashAt);
    expect(B.fuse.landAt).toBeLessThan(B.fuse.total);
  });

  it("the Slam: `leap` as the banner goes, `slam` (the shake), `fly`, `shadows` on their beats; the pieces gone inside the moment", () => {
    const start = B.slam.slamAt - cueAt(A.mammothSlam!, "slam")!;
    expect(start + cueAt(A.mammothSlam!, "leap")!).toBe(B.slam.leapAt);
    expect(start + cueAt(A.mammothSlam!, "fly")!).toBe(B.slam.flyAt);
    expect(start + cueAt(A.mammothSlam!, "shadows")!).toBe(B.slam.shadowsAt);
    expect(start + animLength(A.mammothSlam!)).toBeLessThanOrEqual(B.slam.total);
    expect(B.slam.goneAt + 2 * 60).toBeLessThanOrEqual(B.slam.total);
    const m = moment("slam", 1000, ["e2", "f2", "c3"]);
    expect(alfilJolt(m, 1000 + B.slam.slamAt - 1)).toBeNull();
    expect(alfilJolt(m, 1000 + B.slam.slamAt + 10)).toBe("crash");
    expect(alfilJolt(m, 1000 + B.slam.slamAt + 400)).toBeNull();
    expect(ALFIL_UI.moments.slam.appearAt!(m, "f2", "white")).toBe(1000 + B.slam.shadowsAt);
  });

  it("the landing: one after another, each down on its own square, then a short slide if that was taken; all inside the moment", () => {
    const beats = landingBeats([
      { from: "e2", to: "e2" },
      { from: "f2", to: "f2" },
      { from: "c3", to: "d3" },
    ]);
    expect(beats.map((b) => b.drop)).toEqual([0, B.land.stagger, 2 * B.land.stagger]);
    expect(beats.map((b) => b.down - b.drop)).toEqual([B.land.fallMs, B.land.fallMs, B.land.fallMs]);
    expect(beats[2]!.settled - beats[2]!.down).toBe(B.land.slideMs);
    expect(beats[0]!.settled).toBe(beats[0]!.down);
    expect(beats.at(-1)!.settled).toBeLessThanOrEqual(B.land.total);
  });

  it("which moment plays where: each step at the start of his turn on its own screen; the fusion and the landing with the crowd turn's", () => {
    const cast = momentsOf(view([{ kind: "warn", turn: 4 }, { kind: "tusks", turn: 4, squares: ["a7", "b7"] }], { tusks: { turn: 4, at: 4, pawns: ["a7", "b7"] } }), 10_000);
    expect(cast.map((m) => [m.kind, m.ms])).toEqual([["tusks", POWER_FX.tusks]]);
    const slam = momentsOf(
      view([{ kind: "tusks", turn: 4 }, { kind: "slam", turn: 4, squares: ["a2"] }], { tusks: { turn: 4, at: 4, pawns: ["a7", "b7"] }, slam: { at: 4, pieces: [], lands: 8, loss: null } }),
      10_000,
    );
    expect(slam.map((m) => m.kind)).toEqual(["slam"]);
    const fuse = momentsOf(view([{ kind: "warn", turn: 5 }, { kind: "fuse", turn: 5, squares: ["a7", "b7"], square: "b7" }], { fusion: { at: 4, from: ["a7", "b7"], to: "b7" } }), 10_000);
    expect(fuse.map((m) => [m.kind, m.ms])).toEqual([["fuse", POWER_FX.fuse], ["warn", POWER_FX.warn]]);
    const land = momentsOf(view([{ kind: "warn", turn: 5 }, { kind: "land", turn: 5, squares: ["a2"] }]), 10_000);
    expect(land.map((m) => m.kind).sort()).toEqual(["land", "warn"]);
  });

  it("the dock: the fusion was his move (Eric's line, through his whole turn); the pieces back", () => {
    expect(FUSION_LINE).toBe("Alfil spent his move on the fusion.");
    expect(dockLine({ kind: "fuse" })).toBe(FUSION_LINE);
    expect(noMoveLine(view([], { fusion: { at: 4, from: ["a7", "b7"], to: "b7" } }))).toBe(FUSION_LINE);
    // (Not once he has moved, nor for a fusion that failed, nor an old one.)
    expect(noMoveLine(view([], { fusion: { at: 4, from: ["a7", "b7"], to: "b7" } }, 4, START_FEN, { lastMove: { san: "e5" } }))).toBeNull();
    expect(noMoveLine(view([], { fusion: { at: 4, from: ["a7", "b7"], to: null, why: "taken" } }))).toBeNull();
    expect(noMoveLine(view([], { fusion: { at: 2, from: ["a7", "b7"], to: "b7" } }))).toBeNull();
    expect(dockLine({ kind: "land", squares: ["a2", "b2", "c3"] })).toBe("Your pieces are back.");
    expect(dockLine({ kind: "land", squares: ["a2"] })).toBe("Your piece is back.");
    expect(dockLine({ kind: "tusks", squares: ["a7", "b7"] })).toBeNull();
  });
});

describe("the board under his moments (alfilFen)", () => {
  const B = ALFIL_BEATS;
  it("the fusion: both pawns on their squares until they lift, then neither, and the elephant only once it has landed", () => {
    // After the fusion: his pawns off a7 and b7, the elephant on b7.
    const after = "rnbqkbnr/1bpppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 3";
    const b = view([{ kind: "fuse", turn: 5, squares: ["a7", "b7"], square: "b7" }], { fusion: { at: 4, from: ["a7", "b7"], to: "b7" } }, 4, after);
    const m = moment("fuse", 10_000);
    const at = (t: number) => alfilFen(b, [m], 10_000 + t, after)!;
    // (Before the moment too: the screen shows his turn before its moments.)
    for (const t of [-500, 0, B.fuse.riseAt - 1]) {
      expect(pieceAt(at(t), "a7"), `${t}`).toMatchObject({ color: "b", type: "p" });
      expect(pieceAt(at(t), "b7"), `${t}`).toMatchObject({ color: "b", type: "p" });
    }
    expect(pieceAt(at(B.fuse.riseAt + 10), "a7")).toBeNull();
    expect(pieceAt(at(B.fuse.landAt - 1), "b7")).toBeNull();
    expect(at(B.fuse.landAt)).toBe(after);
    expect(alfilFen(b, [m], 10_000 + m.ms, after)).toBeNull();
    expect(alfilFen(b, [], 10_000, after)).toBeNull();
  });

  it("the Slam: the pieces on their squares until they fly; the landing: each only once it's down (and slid)", () => {
    const lifted = "rnbqkbnr/pppppppp/8/8/8/8/PPPP2PP/RN1QKBNR b KQkq - 0 3";
    const s = view([{ kind: "slam", turn: 4, squares: ["e2", "f2", "c1"] }], { slam: { at: 4, pieces: [{ piece: "p", square: "e2" }, { piece: "p", square: "f2" }, { piece: "b", square: "c1" }], lands: 8, loss: 0.5 } }, 4, lifted);
    const sm = moment("slam", 10_000);
    expect(pieceAt(alfilFen(s, [sm], 10_000 + B.slam.flyAt - 1, lifted)!, "c1")).toMatchObject({ color: "w", type: "b" });
    expect(alfilFen(s, [sm], 10_000 + B.slam.flyAt, lifted)).toBe(lifted);
    const down = "rnbqkbnr/pppppppp/8/8/8/3B4/PPPPPPPP/RN1QKBNR w KQkq - 0 3";
    const l = view([{ kind: "land", turn: 8, squares: ["e2", "f2", "d3"] }], { landed: { turn: 8, at: 7, pieces: [{ piece: "p", from: "e2", to: "e2" }, { piece: "p", from: "f2", to: "f2" }, { piece: "b", from: "c1", to: "d3" }] } }, 7, down);
    const lm = moment("land", 10_000);
    const beats = landingBeats([
      { from: "e2", to: "e2" },
      { from: "f2", to: "f2" },
      { from: "c1", to: "d3" },
    ]);
    expect(pieceAt(alfilFen(l, [lm], 10_000 + beats[0]!.down - 1, down)!, "e2")).toBeNull();
    expect(pieceAt(alfilFen(l, [lm], 10_000 + beats[0]!.down, down)!, "e2")).toMatchObject({ color: "w", type: "p" });
    expect(pieceAt(alfilFen(l, [lm], 10_000 + beats[2]!.down + 10, down)!, "d3")).toBeNull();
    expect(alfilFen(l, [lm], 10_000 + beats[2]!.settled, down)).toBe(down);
  });

  it("their early landing (a mate in one only while they were up) plays while he thinks, from when it's first seen", () => {
    const early = view([{ kind: "land", turn: 7, squares: ["e2"] }], { landed: { turn: 7, at: 7, pieces: [{ piece: "p", from: "e2", to: "e2" }], early: true } }, 7);
    const m = earlyLanding(early, 5000)!;
    expect(m).toMatchObject({ kind: "land", at: 5000, ms: POWER_FX.land, squares: ["e2"] });
    expect(earlyLanding(early, 9000)!.at).toBe(5000);
    // (None for a landing as a turn began, nor once a step of his has played since.)
    expect(earlyLanding(view([], { landed: { turn: 8, at: 7, pieces: [{ piece: "p", from: "e2", to: "e2" }] } }, 7))).toBeNull();
    expect(earlyLanding(view([{ kind: "land", turn: 7 }, { kind: "tusks", turn: 7 }], { landed: { turn: 7, at: 7, pieces: [{ piece: "p", from: "e2", to: "e2" }], early: true } }, 7))).toBeNull();
  });
});

describe("his FAQ block", () => {
  it("his powers in the settings' numbers", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "alfil")!;
    const p = BOSS_POWERS;
    const words = BOSS_BLOCKS.alfil!(p, def);
    expect(words).toContain(`on his ${p.tusksFirst}rd turn, then every ${p.tusksEvery} turns`);
    expect(words).toContain(`At most ${p.tusksMax} elephants a battle`);
    expect(words).toContain(`${p.slamPawns} of your pawns and ${p.slamMinors} of your knights or bishops fly up`);
    expect(words).toContain(`gone for ${p.slamTurns} of your turns`);
    expect(words).toContain(`about ${p.slamTarget} of a pawn (from ${p.slamLoss[0]} to ${p.slamLoss[1]})`);
    expect(words).toContain(`plays ${Math.abs(def.offset)} under the usual strength`);
    expect(words).toContain("the fusion is his whole move that turn");
    // (The review round, #267: a fusion due in check waits; a strike before it puts the elephant on the worse square; a
    // Slam that lifts nothing comes again.)
    expect(words).toContain("If he's in check when it's due, it waits until he isn't");
    expect(words).toContain("the elephant lands on the worse of the two squares for him");
    expect(words).toContain("he tries again at the start of his next turn");
  });
});
